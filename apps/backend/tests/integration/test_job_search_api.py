"""Integration tests for the external job search endpoint."""

from collections.abc import AsyncIterator

import httpx
import pytest
import respx
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services.job_search import FREEHIRE_SEARCH_URL

SEARCH_PATH = "/api/v1/jobs/search"


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


async def set_provider(client: AsyncClient, provider: str) -> None:
    response = await client.put(
        "/api/v1/config/features", json={"job_search_provider": provider}
    )
    assert response.status_code == 200


def freehire_payload() -> dict:
    return {
        "data": [
            {
                "public_slug": "senior-go-engineer-acme-1a2b",
                "title": "Senior Go Engineer",
                "company": "Acme",
                "location": "Berlin, Germany",
                "url": "https://jobs.example/senior-go",
                "description": "## About the role\nBuild the payments API.",
                "source": "greenhouse",
                "external_id": "gh-42",
                "posted_at": "2026-11-01T00:00:00Z",
                "skills": ["go", "postgresql"],
                "work_mode": "remote",
            }
        ],
        "meta": {"total": 137, "limit": 10, "offset": 0},
    }


class TestJobSearch:
    """POST /api/v1/jobs/search"""

    @respx.mock
    async def test_freehire_search_maps_full_posting_and_filters(
        self, client: AsyncClient
    ):
        await set_provider(client, "freehire")
        route = respx.get(FREEHIRE_SEARCH_URL).mock(
            return_value=httpx.Response(200, json=freehire_payload())
        )

        response = await client.post(
            SEARCH_PATH,
            json={
                "query": "golang",
                "limit": 5,
                "offset": 10,
                "country": "de",
                "work_mode": "remote",
                "skills": ["go", "rust"],
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["provider"] == "freehire"
        assert data["total"] == 137
        assert data["limit"] == 10
        assert data["offset"] == 0
        assert len(data["jobs"]) == 1

        job = data["jobs"][0]
        assert job["id"] == "senior-go-engineer-acme-1a2b"
        assert job["title"] == "Senior Go Engineer"
        assert job["company"] == "Acme"
        assert job["description"] == "## About the role\nBuild the payments API."
        assert job["source"] == "greenhouse"
        assert job["source_id"] == "gh-42"
        assert job["skills"] == ["go", "postgresql"]

        assert route.called
        params = route.calls.last.request.url.params
        assert params["q"] == "golang"
        assert params["limit"] == "5"
        assert params["offset"] == "10"
        assert params["countries"] == "de"
        assert params["work_mode"] == "remote"
        assert params["skills"] == "go,rust"
        assert params["description_format"] == "markdown"

    async def test_off_provider_returns_409_without_a_request(
        self, client: AsyncClient
    ):
        response = await client.post(SEARCH_PATH, json={"query": "python"})

        assert response.status_code == 409
        assert "off" in response.json()["detail"].lower()

    async def test_unimplemented_provider_returns_501_without_a_request(
        self, client: AsyncClient
    ):
        await set_provider(client, "jsearch")
        response = await client.post(SEARCH_PATH, json={"query": "python"})

        assert response.status_code == 501
        assert "not available" in response.json()["detail"].lower()

    @respx.mock
    async def test_rate_limit_becomes_generic_502(self, client: AsyncClient):
        await set_provider(client, "freehire")
        respx.get(FREEHIRE_SEARCH_URL).mock(
            return_value=httpx.Response(429, json={"error": "slow down"})
        )

        response = await client.post(SEARCH_PATH, json={"query": "python"})

        assert response.status_code == 502
        assert "rate limiting" in response.json()["detail"].lower()

    @respx.mock
    async def test_timeout_becomes_generic_502(self, client: AsyncClient):
        await set_provider(client, "freehire")
        respx.get(FREEHIRE_SEARCH_URL).mock(
            side_effect=httpx.TimeoutException("timed out")
        )

        response = await client.post(SEARCH_PATH, json={"query": "python"})

        assert response.status_code == 502
        assert "did not respond" in response.json()["detail"].lower()

    @respx.mock
    async def test_unexpected_payload_becomes_502(self, client: AsyncClient):
        await set_provider(client, "freehire")
        respx.get(FREEHIRE_SEARCH_URL).mock(
            return_value=httpx.Response(200, json={"data": "not-a-list"})
        )

        response = await client.post(SEARCH_PATH, json={"query": "python"})

        assert response.status_code == 502
        assert "unexpected response" in response.json()["detail"].lower()

    async def test_pagination_is_bounded_before_calling_upstream(
        self, client: AsyncClient
    ):
        response = await client.post(
            SEARCH_PATH, json={"query": "python", "offset": 9_990, "limit": 50}
        )

        assert response.status_code == 422
