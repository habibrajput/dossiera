"""External job search endpoint."""

import logging

from fastapi import APIRouter, HTTPException

from app.schemas import (
    JobPostingFetchRequest,
    JobPostingFetchResponse,
    JobSearchRequest,
    JobSearchResponse,
)
from app.services.job_posting_fetch import (
    InvalidPostingUrlError,
    JobPostingFetchError,
    PostingExtractionError,
    PostingFetchError,
    UnsafePostingUrlError,
    fetch_job_posting,
)
from app.services.job_search import (
    JobSearchError,
    ProviderDisabledError,
    ProviderUnavailableError,
    UpstreamSearchError,
    perform_job_search,
)

router = APIRouter(prefix="/jobs", tags=["Jobs"])
logger = logging.getLogger(__name__)


@router.post("/search", response_model=JobSearchResponse)
async def search_jobs(request: JobSearchRequest) -> JobSearchResponse:
    """Search postings with the source selected in Settings.

    The provider is resolved server-side; callers cannot pick a different one.
    """
    try:
        result = await perform_job_search(
            query=request.query,
            limit=request.limit,
            offset=request.offset,
            country=request.country,
            work_mode=request.work_mode,
            skills=request.skills,
        )
    except ProviderDisabledError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ProviderUnavailableError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    except UpstreamSearchError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except JobSearchError as exc:
        logger.exception("Unexpected job search error")
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return JobSearchResponse(**result)


@router.post("/fetch-posting", response_model=JobPostingFetchResponse)
async def fetch_job_posting_endpoint(
    request: JobPostingFetchRequest,
) -> JobPostingFetchResponse:
    """Fetch a posting URL and fill the tracker form with extracted details.

    This endpoint is independent of the selected job search source: a user can
    paste a link from any public careers site.
    """
    try:
        result = await fetch_job_posting(request.url)
    except (InvalidPostingUrlError, UnsafePostingUrlError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except PostingExtractionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except PostingFetchError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except JobPostingFetchError as exc:
        logger.exception("Unexpected job posting fetch error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return JobPostingFetchResponse(**result)
