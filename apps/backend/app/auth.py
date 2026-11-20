"""Password-only login and signed session cookies.

Set ``APP_PASSWORD_HASH`` to a bcrypt hash to require a password. With no hash
configured every guard is a no-op, so local development and the test suite keep
working without a login.
"""

import base64
import binascii
import hmac
import json
import logging
import re
import secrets
import threading
import time

import bcrypt
from fastapi import Request, Response
from starlette.datastructures import Headers
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.config import settings
from app.crypto import keyed_digest

logger = logging.getLogger(__name__)

SESSION_COOKIE_NAME = "rm_session"
_BCRYPT_HASH_RE = re.compile(r"^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$")
_EXEMPT_API_PATHS: frozenset[str] = frozenset(
    {
        "/api/v1/health",
        "/api/v1/auth/login",
        "/api/v1/auth/session",
        "/api/v1/auth/logout",
    }
)
_MAX_PASSWORD_BYTES = 72
_FAILURE_WINDOW_SECONDS = 60.0
_MAX_FAILURES = 5
_failures: dict[str, tuple[int, float]] = {}
_failures_lock = threading.Lock()


def is_auth_enabled() -> bool:
    """Return whether a password has been configured for this instance."""
    return bool(settings.app_password_hash)


def password_hash_is_valid() -> bool:
    """Return whether the configured value looks like a bcrypt hash."""
    return bool(_BCRYPT_HASH_RE.fullmatch(settings.app_password_hash))


def verify_password(password: str) -> bool:
    """Check ``password`` against APP_PASSWORD_HASH without leaking config details."""
    configured = settings.app_password_hash
    if not configured:
        return False
    if not _BCRYPT_HASH_RE.fullmatch(configured):
        logger.error("APP_PASSWORD_HASH is not a valid bcrypt hash")
        return False
    try:
        candidate = password.encode("utf-8")
    except UnicodeError:
        return False
    # bcrypt 5+ rejects longer inputs rather than silently truncating them.
    if len(candidate) > _MAX_PASSWORD_BYTES:
        return False
    try:
        return bcrypt.checkpw(candidate, configured.encode("utf-8"))
    except (TypeError, ValueError) as e:
        logger.error("bcrypt password check failed: %s", e)
        return False


def login_rate_limit_allows(client_ip: str) -> bool:
    """Return whether ``client_ip`` may attempt another login."""
    now = time.monotonic()
    with _failures_lock:
        count, first = _failures.get(client_ip, (0, now))
        if now - first >= _FAILURE_WINDOW_SECONDS:
            _failures.pop(client_ip, None)
            return True
        return count < _MAX_FAILURES


def record_login_failure(client_ip: str) -> None:
    """Count one failed login for ``client_ip`` within the current window."""
    now = time.monotonic()
    with _failures_lock:
        count, first = _failures.get(client_ip, (0, now))
        if now - first >= _FAILURE_WINDOW_SECONDS:
            count, first = 0, now
        _failures[client_ip] = (count + 1, first)
        if len(_failures) > 1024:
            stale = [
                ip
                for ip, (_, started) in _failures.items()
                if now - started >= _FAILURE_WINDOW_SECONDS
            ]
            for ip in stale:
                del _failures[ip]


def clear_login_failures(client_ip: str | None = None) -> None:
    """Forget failures for one IP, or all IPs when called without one."""
    with _failures_lock:
        if client_ip is None:
            _failures.clear()
        else:
            _failures.pop(client_ip, None)


def create_session_token(ttl_seconds: int | None = None) -> str:
    """Build a signed, expiring session token using the app's at-rest secret."""
    ttl = settings.app_session_ttl_seconds if ttl_seconds is None else ttl_seconds
    now = int(time.time())
    payload = {"v": 1, "iat": now, "exp": now + ttl, "jti": secrets.token_urlsafe(18)}
    encoded = (
        base64.urlsafe_b64encode(
            json.dumps(payload, separators=(",", ":")).encode("utf-8")
        )
        .decode("ascii")
        .rstrip("=")
    )
    return f"{encoded}.{keyed_digest(f'session:{encoded}')}"


def verify_session_token(token: str) -> bool:
    """Return whether ``token`` is authentic, well formed and unexpired."""
    encoded, separator, signature = token.partition(".")
    if not separator or not encoded or not signature:
        return False
    expected = keyed_digest(f"session:{encoded}")
    if not hmac.compare_digest(signature, expected):
        return False
    try:
        padded = encoded + "=" * (-len(encoded) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded).decode("utf-8"))
    except (binascii.Error, UnicodeError, ValueError, TypeError):
        return False
    if not isinstance(payload, dict):
        return False
    version = payload.get("v")
    issued_at = payload.get("iat")
    expires_at = payload.get("exp")
    token_id = payload.get("jti")
    now = int(time.time())
    if (
        version != 1
        or not isinstance(issued_at, int)
        or not isinstance(expires_at, int)
        or not isinstance(token_id, str)
        or not token_id
        or issued_at > now + 60
        or expires_at <= now
    ):
        return False
    return True


def cookie_value(cookie_header: str, name: str) -> str:
    """Read one cookie value from a raw Cookie header."""
    for part in cookie_header.split(";"):
        key, separator, value = part.strip().partition("=")
        if separator and key == name:
            return value
    return ""


def _is_secure_request(request: Request) -> bool:
    forwarded = (
        request.headers.get("x-forwarded-proto", "").split(",")[0].strip().lower()
    )
    return forwarded == "https" or request.url.scheme == "https"


def set_session_cookie(response: Response, request: Request, token: str) -> None:
    """Attach the session cookie to a successful login response."""
    response.set_cookie(
        SESSION_COOKIE_NAME,
        token,
        max_age=settings.app_session_ttl_seconds,
        httponly=True,
        secure=_is_secure_request(request),
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response, request: Request) -> None:
    """Remove the session cookie on logout."""
    response.delete_cookie(
        SESSION_COOKIE_NAME,
        httponly=True,
        secure=_is_secure_request(request),
        samesite="lax",
        path="/",
    )


class AuthMiddleware:
    """Reject API calls without a valid cookie when a password is configured."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        path = scope.get("path", "")
        if (
            scope["type"] != "http"
            or scope.get("method") == "OPTIONS"
            or not is_auth_enabled()
            or not path.startswith("/api/v1/")
            or path in _EXEMPT_API_PATHS
        ):
            await self.app(scope, receive, send)
            return

        token = cookie_value(
            Headers(scope=scope).get("cookie", ""), SESSION_COOKIE_NAME
        )
        if token and verify_session_token(token):
            await self.app(scope, receive, send)
            return

        logger.info("Rejected unauthenticated request to %s", path)
        await JSONResponse(
            status_code=401, content={"detail": "Authentication required"}
        )(scope, receive, send)
