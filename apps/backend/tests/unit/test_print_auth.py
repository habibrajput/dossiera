"""Short-lived authentication used only by the headless print browser."""

import pytest

import app.auth as auth
from app.pdf import _add_print_session_cookie


class FakeContext:
    def __init__(self, error: Exception | None = None) -> None:
        self.cookies: list[dict] = []
        self.error = error

    async def add_cookies(self, cookies: list[dict]) -> None:
        self.cookies = cookies
        if self.error:
            raise self.error


class FakePage:
    def __init__(self, context: FakeContext) -> None:
        self.context = context


@pytest.fixture(autouse=True)
def clear_sessions():
    auth._sessions.clear()
    yield
    auth._sessions.clear()


async def test_print_page_gets_revocable_host_only_session(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(auth.settings, "auth_password_hash", "configured")
    context = FakeContext()
    page = FakePage(context)

    token = await _add_print_session_cookie(page, "https://example.com/print/resumes/1")

    assert token is not None
    assert auth.is_valid_session(token)
    assert context.cookies == [
        {
            "name": auth.SESSION_COOKIE_NAME,
            "value": token,
            "domain": "example.com",
            "path": "/",
            "httpOnly": True,
            "secure": True,
            "sameSite": "Lax",
        }
    ]

    auth.revoke_session(token)
    assert not auth.is_valid_session(token)


async def test_failed_cookie_install_revokes_session(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(auth.settings, "auth_password_hash", "configured")
    context = FakeContext(RuntimeError("browser closed"))

    with pytest.raises(RuntimeError, match="browser closed"):
        await _add_print_session_cookie(
            FakePage(context), "http://localhost:3000/print"
        )

    token = context.cookies[0]["value"]
    assert not auth.is_valid_session(token)


async def test_no_cookie_is_needed_when_auth_is_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(auth.settings, "auth_password_hash", "")
    context = FakeContext()

    token = await _add_print_session_cookie(FakePage(context), "http://localhost:3000")

    assert token is None
    assert context.cookies == []
