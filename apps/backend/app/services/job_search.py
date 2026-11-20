"""Job search across the sources selected in Settings.

Only FreeHire is implemented today. The provider is read from the shared config
cache on every request so switching the source in Settings takes effect without
a restart. Keyless sources never read from the encrypted key store.
"""

import logging

import httpx

from app.config_cache import load_config

logger = logging.getLogger(__name__)

FREEHIRE_SEARCH_URL = "https://freehire.me/api/v1/agent/jobs/search"
FREEHIRE_TIMEOUT_SECONDS = 15.0

# FreeHire allows up to 100 rows, but full descriptions make large pages slow to
# render. The API caps this again in the request schema.
MAX_RESULTS = 50


class JobSearchError(Exception):
    """Base class for errors safe to show to the API caller."""


class ProviderDisabledError(JobSearchError):
    """Raised when job search is switched off in Settings."""


class ProviderUnavailableError(JobSearchError):
    """Raised when the selected source has no implementation yet."""


class UpstreamSearchError(JobSearchError):
    """Raised when the selected upstream search API cannot answer."""


def selected_provider() -> str:
    """Return the currently selected job search source."""
    provider = load_config().get("job_search_provider", "off")
    return provider if isinstance(provider, str) else "off"


async def perform_job_search(
    *,
    query: str,
    limit: int,
    offset: int,
    country: str | None = None,
    work_mode: str | None = None,
    skills: list[str] | None = None,
) -> dict:
    """Search postings with the source chosen in Settings.

    Returns a provider-tagged result dictionary. Raises JobSearchError subclasses
    with caller-safe messages; unexpected upstream detail is logged here only.
    """
    provider = selected_provider()
    if provider == "off":
        raise ProviderDisabledError(
            "Job search is off. Choose a source in Settings to search for postings."
        )
    if provider != "freehire":
        raise ProviderUnavailableError(
            f"The {provider} source is not available yet. Choose FreeHire in Settings to search."
        )

    return await _search_freehire(
        query=query,
        limit=limit,
        offset=offset,
        country=country,
        work_mode=work_mode,
        skills=skills,
    )


async def _search_freehire(
    *,
    query: str,
    limit: int,
    offset: int,
    country: str | None,
    work_mode: str | None,
    skills: list[str] | None,
) -> dict:
    """Call FreeHire's agent search, which includes each posting's full text."""
    params: dict[str, str | int] = {
        "q": query,
        "limit": min(limit, MAX_RESULTS),
        "offset": offset,
        # The agent endpoint is the only public search route that carries the
        # complete posting; without this the UI would have to fetch each hit.
        "description_format": "markdown",
    }
    if country:
        # FreeHire calls this facet `countries`; geography is an OR group, so a
        # single value narrows to exactly one country.
        params["countries"] = country
    if work_mode:
        params["work_mode"] = work_mode
    if skills:
        params["skills"] = ",".join(skills)

    timeout = httpx.Timeout(FREEHIRE_TIMEOUT_SECONDS, connect=5.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(
                FREEHIRE_SEARCH_URL,
                params=params,
                headers={"Accept": "application/json"},
            )
    except httpx.TimeoutException as exc:
        logger.warning("FreeHire search timed out")
        raise UpstreamSearchError(
            "FreeHire did not respond in time. Please try again."
        ) from exc
    except httpx.RequestError as exc:
        logger.warning("FreeHire search request failed: %s", type(exc).__name__)
        raise UpstreamSearchError(
            "Could not reach FreeHire. Check your connection and try again."
        ) from exc

    if response.status_code >= 400:
        raise _freehire_http_error(response)

    try:
        payload = response.json()
    except ValueError as exc:
        logger.warning(
            "FreeHire returned non-JSON content (status %s)", response.status_code
        )
        raise UpstreamSearchError(
            "FreeHire returned an unexpected response. Please try again."
        ) from exc

    if not isinstance(payload, dict) or not isinstance(payload.get("data"), list):
        logger.warning("FreeHire returned an unexpected payload shape")
        raise UpstreamSearchError(
            "FreeHire returned an unexpected response. Please try again."
        )

    jobs = [_normalize_job(item) for item in payload["data"]]
    meta = payload.get("meta") if isinstance(payload.get("meta"), dict) else {}

    return {
        "provider": "freehire",
        "jobs": jobs,
        "total": _as_int(meta.get("total"), default=len(jobs)),
        "limit": _as_int(meta.get("limit"), default=params["limit"]),
        "offset": _as_int(meta.get("offset"), default=offset),
    }


def _freehire_http_error(response: httpx.Response) -> UpstreamSearchError:
    """Map an upstream failure to a generic, caller-safe message."""
    detail = ""
    try:
        body = response.json()
        if isinstance(body, dict) and isinstance(body.get("error"), str):
            detail = body["error"]
    except ValueError:
        detail = response.text[:300]
    logger.warning(
        "FreeHire search failed with status %s: %s", response.status_code, detail
    )

    if response.status_code == 429:
        return UpstreamSearchError(
            "FreeHire is rate limiting requests. Wait a moment and try again."
        )
    if response.status_code >= 500:
        return UpstreamSearchError(
            "FreeHire is temporarily unavailable. Try again shortly."
        )
    if response.status_code == 400:
        return UpstreamSearchError(
            "FreeHire rejected the search. Try different filters."
        )
    return UpstreamSearchError(
        "FreeHire could not complete the search. Please try again."
    )


def _normalize_job(item: object) -> dict:
    """Map a FreeHire job to the provider-agnostic response shape."""
    job = item if isinstance(item, dict) else {}
    skills = job.get("skills")
    if not isinstance(skills, list):
        skills = []

    return {
        "id": str(job.get("public_slug") or ""),
        "title": str(job.get("title") or "Untitled posting"),
        "company": str(job.get("company") or "Unknown company"),
        "location": str(job.get("location") or "") or None,
        "url": str(job.get("url") or "") or None,
        "description": str(job.get("description") or ""),
        "source": str(job.get("source") or "") or None,
        "source_id": str(job.get("external_id") or "") or None,
        "posted_at": str(job.get("posted_at") or "") or None,
        "skills": [str(skill) for skill in skills],
        "work_mode": str(job.get("work_mode") or "") or None,
    }


def _as_int(value: object, *, default: int) -> int:
    """Coerce an upstream number without letting bad metadata break a search."""
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default
