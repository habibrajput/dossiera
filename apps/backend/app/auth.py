"""Password hashing, sessions, and middleware for optional app authentication."""

import base64
import hashlib
import hmac
import secrets
import threading
import time
from getpass import getpass

from starlette.datastructures import Headers
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.config import settings

SESSION_COOKIE_NAME = "resume_matcher_session"
PBKDF2_ALGORITHM = "pbkdf2_sha256"
PBKDF2_ITERATIONS = 600_000
MAX_PBKDF2_ITERATIONS = 2_000_000
PRINT_SESSION_TTL_SECONDS = 300

_sessions: dict[str, float] = {}
_sessions_lock = threading.Lock()
_PUBLIC_PATHS = frozenset(
    {
        "/api/v1/health",
        "/api/v1/auth/login",
        "/api/v1/auth/logout",
        "/api/v1/auth/session",
    }
)


def auth_enabled() -> bool:
    """Return whether password authentication has been configured."""
    return bool(settings.auth_password_hash.strip())


def hash_password(password: str, *, iterations: int = PBKDF2_ITERATIONS) -> str:
    """Hash a password with a random salt for storage in AUTH_PASSWORD_HASH."""
    if not password:
        raise ValueError("Password must not be empty")
    if not 1 <= iterations <= MAX_PBKDF2_ITERATIONS:
        raise ValueError("Invalid PBKDF2 iteration count")
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, iterations, dklen=32
    )
    encoded_salt = base64.urlsafe_b64encode(salt).decode("ascii")
    encoded_digest = base64.urlsafe_b64encode(digest).decode("ascii")
    return f"{PBKDF2_ALGORITHM}${iterations}${encoded_salt}${encoded_digest}"


def verify_password(password: str, encoded_hash: str) -> bool:
    """Compare a password with a PBKDF2 hash without exposing comparison timing."""
    try:
        algorithm, raw_iterations, encoded_salt, encoded_digest = encoded_hash.split(
            "$"
        )
        if algorithm != PBKDF2_ALGORITHM:
            return False
        iterations = int(raw_iterations)
        if not 1 <= iterations <= MAX_PBKDF2_ITERATIONS:
            return False
        salt = base64.b64decode(encoded_salt, altchars=b"-_", validate=True)
        expected = base64.b64decode(encoded_digest, altchars=b"-_", validate=True)
        if len(salt) < 8 or len(expected) != 32:
            return False
    except (ValueError, TypeError):
        return False

    actual = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, iterations, dklen=len(expected)
    )
    return hmac.compare_digest(actual, expected)


def _prune_expired_sessions(now: float) -> None:
    """Remove expired sessions. The caller must hold ``_sessions_lock``."""
    for token in [token for token, expiry in _sessions.items() if expiry <= now]:
        del _sessions[token]


def create_session(*, ttl_seconds: int | None = None) -> str:
    """Create an opaque session token and return it without persisting credentials."""
    token = secrets.token_urlsafe(32)
    lifetime = ttl_seconds or settings.auth_session_ttl_seconds
    now = time.monotonic()
    with _sessions_lock:
        _prune_expired_sessions(now)
        _sessions[token] = now + lifetime
    return token


def is_valid_session(token: str | None) -> bool:
    """Return whether an opaque session token exists and has not expired."""
    if not token:
        return False
    now = time.monotonic()
    with _sessions_lock:
        expiry = _sessions.get(token)
        if expiry is None:
            return False
        if expiry <= now:
            del _sessions[token]
            return False
        return True


def revoke_session(token: str | None) -> None:
    """Revoke a session if it exists."""
    if not token:
        return
    with _sessions_lock:
        _sessions.pop(token, None)


class AuthMiddleware:
    """Reject unauthenticated requests before they reach application routes."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] != "http"
            or not auth_enabled()
            or scope["method"] == "OPTIONS"
            or scope["path"] in _PUBLIC_PATHS
        ):
            await self.app(scope, receive, send)
            return

        headers = Headers(scope=scope)
        token = None
        for cookie in headers.get("cookie", "").split(";"):
            name, separator, value = cookie.strip().partition("=")
            if separator and name == SESSION_COOKIE_NAME:
                token = value
                break
        if is_valid_session(token):
            await self.app(scope, receive, send)
            return

        response = JSONResponse(
            status_code=401,
            content={"detail": "Authentication required"},
        )
        await response(scope, receive, send)


def main() -> None:
    """Interactively generate a password hash suitable for the backend .env file."""
    password = getpass("New password: ")
    confirmation = getpass("Confirm password: ")
    if not password:
        raise SystemExit("Password must not be empty.")
    if not hmac.compare_digest(password, confirmation):
        raise SystemExit("Passwords do not match.")
    print(f"\nAUTH_PASSWORD_HASH={hash_password(password)}")


if __name__ == "__main__":
    main()
