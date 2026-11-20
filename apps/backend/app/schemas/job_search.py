"""Schemas for external job search results."""

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.models import JobSearchProviderLiteral


class JobPostingResponse(BaseModel):
    """One posting, normalized across job search sources."""

    id: str
    title: str
    company: str
    location: str | None = None
    url: str | None = None
    description: str = ""
    source: str | None = None
    source_id: str | None = None
    posted_at: str | None = None
    skills: list[str] = Field(default_factory=list)
    work_mode: str | None = None


class JobSearchResponse(BaseModel):
    """A page of results from the currently selected source."""

    provider: JobSearchProviderLiteral
    jobs: list[JobPostingResponse]
    total: int
    limit: int
    offset: int


class JobPostingFetchRequest(BaseModel):
    """Request to fetch and extract a public job posting by URL."""

    url: str = Field(min_length=1, max_length=2048)

    @field_validator("url", mode="before")
    @classmethod
    def strip_url(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class JobPostingFetchResponse(BaseModel):
    """Clean posting text and the details extracted from it."""

    url: str
    final_url: str
    title: str
    company: str
    location: str | None = None
    work_mode: str | None = None
    skills: list[str] = Field(default_factory=list)
    job_req_id: str | None = None
    description: str
    source: str | None = None


class JobSearchRequest(BaseModel):
    """A search against the source selected in Settings."""

    query: str = Field(min_length=1, max_length=200)
    limit: int = Field(default=10, ge=1, le=50)
    offset: int = Field(default=0, ge=0, le=9_900)
    country: str | None = Field(default=None, max_length=64)
    work_mode: str | None = Field(default=None, max_length=32)
    skills: list[str] | None = Field(default=None, max_length=10)

    @model_validator(mode="after")
    def bound_pagination(self) -> "JobSearchRequest":
        # FreeHire refuses pages that reach past 10,000 rows; fail early with a
        # deterministic 422 instead of forwarding a request it must reject.
        if self.offset + self.limit > 10_000:
            raise ValueError("offset + limit must not exceed 10000")
        return self

    @field_validator("query", "country", "work_mode", mode="before")
    @classmethod
    def strip_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("skills", mode="before")
    @classmethod
    def clean_skills(cls, value: object) -> object:
        if not isinstance(value, list):
            return value
        cleaned = [
            item.strip() for item in value if isinstance(item, str) and item.strip()
        ]
        return cleaned or None
