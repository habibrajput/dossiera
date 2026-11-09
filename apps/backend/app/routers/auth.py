"""Password-only authentication endpoints."""

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.auth import (
    SESSION_COOKIE_NAME,
    auth_enabled,
    create_session,
    is_valid_session,
    revoke_session,
    verify_password,
)
from app.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    """The only credential accepted by the application."""

    password: str = Field(min_length=1, max_length=1024)


class AuthStatusResponse(BaseModel):
    """Authentication state consumed by the frontend route guard."""

    authenticated: bool
    auth_required: bool = Field(serialization_alias="authRequired")


def _secure_cookie(request: Request) -> bool:
    """Use Secure cookies for HTTPS, including deployments behind a reverse proxy."""
    protocol = request.headers.get("x-forwarded-proto", request.url.scheme)
    return protocol.split(",", 1)[0].strip().lower() == "https"


def _session_token(request: Request) -> str | None:
    return request.cookies.get(SESSION_COOKIE_NAME)


@router.post("/login", response_model=AuthStatusResponse)
async def login(
    credentials: LoginRequest, request: Request, response: Response
) -> AuthStatusResponse:
    """Verify the configured password hash and start a new session."""
    if not auth_enabled():
        raise HTTPException(status_code=400, detail="Authentication is not configured")
    if not verify_password(credentials.password, settings.auth_password_hash):
        raise HTTPException(status_code=401, detail="Invalid password")

    token = create_session()
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=settings.auth_session_ttl_seconds,
        path="/",
        secure=_secure_cookie(request),
        httponly=True,
        samesite="lax",
    )
    return AuthStatusResponse(authenticated=True, auth_required=True)


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response) -> Response:
    """Revoke the current session and clear its browser cookie."""
    revoke_session(_session_token(request))
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        secure=_secure_cookie(request),
        httponly=True,
        samesite="lax",
    )
    response.status_code = 204
    return response


@router.get("/session", response_model=AuthStatusResponse)
async def session_status(request: Request) -> AuthStatusResponse:
    """Report auth state without exposing whether any particular session exists."""
    required = auth_enabled()
    authenticated = not required or is_valid_session(_session_token(request))
    return AuthStatusResponse(authenticated=authenticated, auth_required=required)
