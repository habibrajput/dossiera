"""Integration tests for fetching job postings from a pasted URL."""

from collections.abc import AsyncIterator

import httpx
import pytest
import respx
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services import job_posting_fetch

FETCH_PATH = "/api/v1/jobs/fetch-posting"
BASE = "https://jobs.example"

PAGE = """
<html><head>
  <meta property="og:site_name" content="Jobs Example">
  <script type="application/ld+json">
    {
      "@type": "JobPosting",
      "title": "Senior Go Engineer",
      "hiringOrganization": {"name": "Acme"},
      "jobLocation": {"address": {"addressLocality": "Berlin", "addressCountry": "DE"}},
      "jobLocationType": "TELECOMMUTE",
      "description": "<p>Build the payments API in Go.</p><p>Use PostgreSQL and Kubernetes.</p>"
    }
  </script>
</head><body><h1>Senior Go Engineer</h1></body></html>
"""


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
def public_dns(monkeypatch: pytest.MonkeyPatch) -> None:
    """Avoid real DNS while keeping URL validation in the request path."""
    monkeypatch.setattr(job_posting_fetch, "resolve_public_hosts", lambda host: None)


class TestJobPostingFetch:
    """POST /api/v1/jobs/fetch-posting"""

    @respx.mock
    async def test_fetches_and_extracts_posting(
        self, client: AsyncClient, public_dns: None
    ) -> None:
        route = respx.get(f"{BASE}/role").mock(
            return_value=httpx.Response(
                200, text=PAGE, headers={"Content-Type": "text/html; charset=utf-8"}
            )
        )

        response = await client.post(FETCH_PATH, json={"url": f"{BASE}/role"})

        assert response.status_code == 200
        data = response.json()
        assert data["url"] == f"{BASE}/role"
        assert data["final_url"] == f"{BASE}/role"
        assert data["title"] == "Senior Go Engineer"
        assert data["company"] == "Acme"
        assert data["location"] == "Berlin, DE"
        assert data["work_mode"] == "remote"
        assert "Build the payments API in Go." in data["description"]
        assert data["source"] == "json-ld"
        assert route.called
        assert "text/html" in route.calls.last.request.headers["accept"]

    @respx.mock
    async def test_redirect_to_private_host_is_rejected_before_fetch(
        self, client: AsyncClient, public_dns: None
    ) -> None:
        respx.get(f"{BASE}/start").mock(
            return_value=httpx.Response(
                302, headers={"Location": "http://127.0.0.1/secret"}
            )
        )
        private = respx.get("http://127.0.0.1/secret").mock(
            return_value=httpx.Response(200, text="secret")
        )

        response = await client.post(FETCH_PATH, json={"url": f"{BASE}/start"})

        assert response.status_code == 400
        assert "not allowed" in response.json()["detail"].lower()
        assert not private.called

    async def test_invalid_url_returns_400(self, client: AsyncClient) -> None:
        response = await client.post(FETCH_PATH, json={"url": "javascript:alert(1)"})

        assert response.status_code == 400
        assert "http" in response.json()["detail"].lower()

    @respx.mock
    async def test_missing_posting_returns_502(
        self, client: AsyncClient, public_dns: None
    ) -> None:
        respx.get(f"{BASE}/missing").mock(return_value=httpx.Response(404))

        response = await client.post(FETCH_PATH, json={"url": f"{BASE}/missing"})

        assert response.status_code == 502
        assert "not found" in response.json()["detail"].lower()

    @respx.mock
    async def test_non_text_document_returns_422(
        self, client: AsyncClient, public_dns: None
    ) -> None:
        respx.get(f"{BASE}/resume.pdf").mock(
            return_value=httpx.Response(
                200, content=b"%PDF-1.7", headers={"Content-Type": "application/pdf"}
            )
        )

        response = await client.post(FETCH_PATH, json={"url": f"{BASE}/resume.pdf"})

        assert response.status_code == 422
        assert "not a text job posting" in response.json()["detail"].lower()
