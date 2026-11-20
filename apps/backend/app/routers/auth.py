"""Password-only login endpoints."""

import logging

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from app.auth import (
    SESSION_COOKIE_NAME,
    clear_login_failures,
    clear_session_cookie,
    cookie_value,
    create_session_token,
    is_auth_enabled,
    login_rate_limit_allows,
    password_hash_is_valid,
    record_login_failure,
    set_session_cookie,
    verify_password,
    verify_session_token,
)
from app.schemas import LoginRequest, SessionResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])

_INVALID_PASSWORD = "Invalid password."
_RATE_LIMITED = "Too many login attempts. Try again shortly."
_NOT_CONFIGURED = "Login is not configured correctly. Contact the app owner."
_RETRY_AFTER = "60"


def _client_ip(request: Request) -> str:
    """Key the login rate limiter by the direct peer address."""
    return request.client.host if request.client else "unknown"


def _current_session(request: Request) -> SessionResponse:
    """Build the session status for this request."""
    enabled = is_auth_enabled()
    token = cookie_value(request.headers.get("cookie", ""), SESSION_COOKIE_NAME)
    authenticated = not enabled or bool(token and verify_session_token(token))
    return SessionResponse(auth_enabled=enabled, authenticated=authenticated)


@router.get("/session", response_model=SessionResponse)
async def get_session(request: Request) -> SessionResponse:
    """Report whether login is enabled and whether the caller is signed in.

    Always returns 200 so the frontend's route guard can distinguish an
    unauthenticated visitor from a backend failure.
    """
    return _current_session(request)


@router.post("/login")
async def login(payload: LoginRequest, request: Request) -> JSONResponse:
    """Verify the app password and set a signed, HTTP-only session cookie."""
    if not is_auth_enabled():
        return JSONResponse(
            content=SessionResponse(auth_enabled=False, authenticated=True).model_dump()
        )
    if not password_hash_is_valid():
        logger.error("Login attempted while APP_PASSWORD_HASH is invalid")
        raise HTTPException(status_code=503, detail=_NOT_CONFIGURED)

    client_ip = _client_ip(request)
    if not login_rate_limit_allows(client_ip):
        raise HTTPException(
            status_code=429,
            detail=_RATE_LIMITED,
            headers={"Retry-After": _RETRY_AFTER},
        )

    if not await run_in_threadpool(verify_password, payload.password):
        record_login_failure(client_ip)
        raise HTTPException(status_code=401, detail=_INVALID_PASSWORD)

    clear_login_failures(client_ip)
    response = JSONResponse(
        content=SessionResponse(auth_enabled=True, authenticated=True).model_dump()
    )
    set_session_cookie(response, request, create_session_token())
    return response


@router.post("/logout")
async def logout(request: Request) -> JSONResponse:
    """Clear the session cookie. Safe to call when already signed out."""
    response = JSONResponse(
        content=SessionResponse(
            auth_enabled=is_auth_enabled(), authenticated=False
        ).model_dump()
    )
    clear_session_cookie(response, request)
    return response
