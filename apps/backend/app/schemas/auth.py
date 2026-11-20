"""Request and response models for password-only login."""

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    """The only credential this app accepts: the configured app password."""

    password: str = Field(min_length=1, max_length=200)


class SessionResponse(BaseModel):
    """Whether login is configured and whether this request is authenticated."""

    auth_enabled: bool
    authenticated: bool
