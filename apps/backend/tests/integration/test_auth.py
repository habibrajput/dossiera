"""Integration tests for the password-only login guard."""

from collections.abc import AsyncIterator, Iterator

import bcrypt
import pytest
from httpx import ASGITransport, AsyncClient

from app.auth import SESSION_COOKIE_NAME, clear_login_failures
from app.config import settings
from app.main import app

PROTECTED_PATH = "/api/v1/config/llm-api-key"
PASSWORD = "correct horse battery staple"


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as test_client:
        yield test_client


@pytest.fixture
def auth_enabled(monkeypatch: pytest.MonkeyPatch) -> Iterator[str]:
    password_hash = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt(rounds=4)).decode()
    monkeypatch.setattr(settings, "app_password_hash", password_hash)
    clear_login_failures()
    yield password_hash
    clear_login_failures()


@pytest.mark.integration
async def test_protected_api_requires_a_session(
    client: AsyncClient, auth_enabled: str
) -> None:
    del auth_enabled
    response = await client.get(PROTECTED_PATH)

    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication required"


@pytest.mark.integration
async def test_public_health_and_session_endpoints(
    client: AsyncClient, auth_enabled: str
) -> None:
    del auth_enabled
    health = await client.get("/api/v1/health")
    session = await client.get("/api/v1/auth/session")

    assert health.status_code == 200
    assert session.status_code == 200
    assert session.json() == {"auth_enabled": True, "authenticated": False}


@pytest.mark.integration
async def test_login_sets_cookie_and_guard_allows_it(
    client: AsyncClient, auth_enabled: str
) -> None:
    del auth_enabled
    wrong = await client.post("/api/v1/auth/login", json={"password": "wrong"})
    assert wrong.status_code == 401
    assert wrong.json()["detail"] == "Invalid password."

    login = await client.post("/api/v1/auth/login", json={"password": PASSWORD})
    assert login.status_code == 200
    assert login.json() == {"auth_enabled": True, "authenticated": True}
    assert SESSION_COOKIE_NAME in login.cookies
    cookie_header = login.headers["set-cookie"]
    assert "HttpOnly" in cookie_header
    assert "SameSite=lax" in cookie_header

    token = login.cookies[SESSION_COOKIE_NAME]
    protected = await client.get(
        PROTECTED_PATH, headers={"cookie": f"{SESSION_COOKIE_NAME}={token}"}
    )
    assert protected.status_code == 200
    session = await client.get(
        "/api/v1/auth/session",
        headers={"cookie": f"{SESSION_COOKIE_NAME}={token}"},
    )
    assert session.json()["authenticated"] is True

    logout = await client.post(
        "/api/v1/auth/logout", headers={"cookie": f"{SESSION_COOKIE_NAME}={token}"}
    )
    assert logout.status_code == 200
    assert logout.json()["authenticated"] is False
    assert f'{SESSION_COOKIE_NAME}=""' in logout.headers["set-cookie"]


@pytest.mark.integration
async def test_too_many_failures_are_rate_limited(
    client: AsyncClient, auth_enabled: str
) -> None:
    del auth_enabled
    for _ in range(5):
        response = await client.post("/api/v1/auth/login", json={"password": "wrong"})
        assert response.status_code == 401

    limited = await client.post("/api/v1/auth/login", json={"password": PASSWORD})
    assert limited.status_code == 429
    assert limited.headers["retry-after"] == "60"


@pytest.mark.integration
async def test_no_password_hash_keeps_api_open(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "app_password_hash", "")

    protected = await client.get(PROTECTED_PATH)
    assert protected.status_code == 200

    session = await client.get("/api/v1/auth/session")
    assert session.json() == {"auth_enabled": False, "authenticated": True}
