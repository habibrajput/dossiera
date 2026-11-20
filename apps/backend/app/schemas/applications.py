"""Pydantic schemas for the Kanban application tracker."""

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator
from pydantic.json_schema import SkipJsonSchema


class ApplicationStatus(str, Enum):
    """The eight stable tracker columns (decoupled from i18n labels)."""

    tailored_queue = "tailored_queue"
    saved = "saved"
    applied = "applied"
    no_response = "no_response"
    response = "response"
    interview = "interview"
    accepted = "accepted"
    rejected = "rejected"


# Order the board renders columns in.
APPLICATION_STATUS_ORDER: list[str] = [s.value for s in ApplicationStatus]


class ApplicationResponse(BaseModel):
    """A single tracker card."""

    application_id: str
    job_id: str
    resume_id: str
    master_resume_id: str | None = None
    status: ApplicationStatus
    company: str | None = None
    role: str | None = None
    job_url: str | None = None
    applied_at: str | None = None
    notes: str | None = None
    position: int
    created_at: str
    updated_at: str


class ApplicationDetailResponse(ApplicationResponse):
    """A card plus the embedded job description and applied resume.

    ``resume`` is null when the referenced resume has been deleted — the modal
    renders "resume unavailable" rather than 500ing.
    """

    job_content: str | None = None
    resume: dict[str, Any] | None = None


class ApplicationListResponse(BaseModel):
    """Applications grouped by column. All eight keys are always present."""

    columns: dict[str, list[ApplicationResponse]]


class ManualApplicationCreate(BaseModel):
    """Create a card from a pasted JD (no prior tailoring).

    The router creates the job from ``job_description`` then the application.
    ``company``/``role`` are optional overrides; when omitted the router runs a
    best-effort extraction.
    """

    resume_id: str
    job_description: str = Field(min_length=1)
    company: str | None = None
    role: str | None = None
    job_url: str | None = None
    status: ApplicationStatus = ApplicationStatus.applied
    notes: str | None = None

    @field_validator("job_url")
    @classmethod
    def normalize_job_url(cls, value: str | None) -> str | None:
        """Only real web links reach the rendered card."""
        if value is None:
            return None
        trimmed = value.strip()
        if not trimmed:
            return None
        if not trimmed.lower().startswith(("http://", "https://")):
            raise ValueError("Job URL must start with http:// or https://")
        return trimmed


class ApplicationUpdate(BaseModel):
    """Partial update — every field optional."""

    status: ApplicationStatus | SkipJsonSchema[None] = None
    position: int | None = None
    notes: str | None = None
    company: str | None = None
    role: str | None = None
    applied_at: str | None = None

    @field_validator("status")
    @classmethod
    def reject_null_status(cls, value: ApplicationStatus | None) -> ApplicationStatus:
        """Omission preserves status; an explicitly supplied null is invalid."""
        if value is None:
            raise ValueError("Status cannot be null")
        return value


class BulkStatusUpdate(BaseModel):
    """Move many cards to one column."""

    application_ids: list[str] = Field(min_length=1)
    status: ApplicationStatus


class BulkDelete(BaseModel):
    """Delete many cards."""

    application_ids: list[str] = Field(min_length=1)


class ApplicationActionResponse(BaseModel):
    """Generic acknowledgement for bulk/destructive actions."""

    message: str
    affected: int
