"""End-to-end password login and API protection through the ASGI app."""

from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

import app.auth as auth
from app.auth import SESSION_COOKIE_NAME, hash_password
from app.main import app


@pytest.fixture
def configured_auth(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        auth.settings,
        "auth_password_hash",
        hash_password("correct horse", iterations=1_000),
    )
    auth._sessions.clear()
    yield
    auth._sessions.clear()


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as http_client:
        yield http_client


async def test_authentication_disabled_preserves_existing_behavior(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(auth.settings, "auth_password_hash", "")

    root = await client.get("/")
    status = await client.get("/api/v1/auth/session")
    login = await client.post("/api/v1/auth/login", json={"password": "anything"})

    assert root.status_code == 200
    assert status.json() == {"authenticated": True, "authRequired": False}
    assert login.status_code == 400


@pytest.mark.usefixtures("configured_auth")
async def test_protected_routes_reject_missing_and_forged_sessions(
    client: AsyncClient,
) -> None:
    health = await client.get("/api/v1/health")
    missing = await client.get("/api/v1/resumes/list")
    docs = await client.get("/docs")
    session = await client.get("/api/v1/auth/session")

    client.cookies.set(SESSION_COOKIE_NAME, "forged-token")
    forged = await client.get("/api/v1/resumes/list")

    assert health.status_code == 200
    assert missing.status_code == 401
    assert missing.json() == {"detail": "Authentication required"}
    assert docs.status_code == 401
    assert session.json() == {"authenticated": False, "authRequired": True}
    assert forged.status_code == 401


@pytest.mark.usefixtures("configured_auth", "isolated_db")
async def test_login_session_and_logout_flow(client: AsyncClient) -> None:
    wrong = await client.post("/api/v1/auth/login", json={"password": "wrong"})
    assert wrong.status_code == 401
    assert "set-cookie" not in wrong.headers

    logged_in = await client.post(
        "/api/v1/auth/login", json={"password": "correct horse"}
    )
    assert logged_in.status_code == 200
    assert logged_in.json() == {"authenticated": True, "authRequired": True}
    cookie = logged_in.headers["set-cookie"]
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie
    assert "Max-Age=604800" in cookie
    assert "Path=/" in cookie
    assert "Secure" not in cookie

    session = await client.get("/api/v1/auth/session")
    protected = await client.get("/api/v1/resumes/list?include_master=false")
    assert session.json() == {"authenticated": True, "authRequired": True}
    assert protected.status_code == 200

    logged_out = await client.post("/api/v1/auth/logout")
    assert logged_out.status_code == 204
    assert (await client.get("/api/v1/auth/session")).json()["authenticated"] is False
    assert (await client.get("/api/v1/resumes/list")).status_code == 401


@pytest.mark.usefixtures("configured_auth")
async def test_https_login_sets_secure_cookie() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as https_client:
        response = await https_client.post(
            "/api/v1/auth/login",
            json={"password": "correct horse"},
            headers={"x-forwarded-proto": "https"},
        )

    assert response.status_code == 200
    assert "Secure" in response.headers["set-cookie"]


@pytest.mark.usefixtures("configured_auth")
async def test_cors_preflight_remains_public(client: AsyncClient) -> None:
    response = await client.options(
        "/api/v1/resumes/list",
        headers={
            "origin": "http://localhost:3000",
            "access-control-request-method": "GET",
        },
    )

    assert response.status_code == 200
