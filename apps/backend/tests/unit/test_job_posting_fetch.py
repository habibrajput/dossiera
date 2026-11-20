"""Unit tests for deterministic job posting extraction and URL safety."""

import socket

import pytest

from app.services import job_posting_fetch as fetch_service


def _json_ld_page() -> str:
    return """
    <html>
      <head>
        <meta property="og:site_name" content="Fallback Inc">
        <script type="application/ld+json">
          {
            "@type": "JobPosting",
            "title": "Senior Go Engineer",
            "hiringOrganization": {"@type": "Organization", "name": "Acme"},
            "jobLocation": {
              "@type": "Place",
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "Berlin",
                "addressCountry": "DE"
              }
            },
            "employmentType": "FULL_TIME",
            "jobLocationType": "TELECOMMUTE",
            "identifier": {"@value": "REQ-42"},
            "skills": ["Go", "PostgreSQL", "Kubernetes"],
            "description": "<p>Build the payments API in Go.</p><p>Use PostgreSQL and Kubernetes.</p>"
          }
        </script>
      </head>
      <body><h1>Senior Go Engineer</h1></body>
    </html>
    """


def test_extracts_structured_posting_metadata() -> None:
    result = fetch_service.extract_posting(
        _json_ld_page(), final_url="https://jobs.example/role/1"
    )

    assert result["title"] == "Senior Go Engineer"
    assert result["company"] == "Acme"
    assert result["location"] == "Berlin, DE"
    assert result["work_mode"] == "remote"
    assert result["job_req_id"] == "REQ-42"
    assert result["skills"][:3] == ["Go", "PostgreSQL", "Kubernetes"]
    assert (
        result["description"]
        == "Build the payments API in Go.\n\nUse PostgreSQL and Kubernetes."
    )
    assert result["source"] == "json-ld"


def test_prefers_focused_job_description_container() -> None:
    page = """
    <html><body>
      <nav>Home Jobs Careers Sign in Apply now</nav>
      <h1>Frontend Engineer</h1>
      <div id="job-description" class="posting-content">
        <p>Build accessible React interfaces.</p>
        <p>Work with TypeScript and our design system.</p>
      </div>
      <footer>Similar jobs Equal opportunity employer</footer>
    </body></html>
    """

    result = fetch_service.extract_posting(
        page, final_url="https://jobs.example/frontend"
    )

    assert result["description"].startswith("Build accessible React interfaces.")
    assert "Sign in" not in result["description"]
    assert "Equal opportunity employer" not in result["description"]
    assert "React" in result["skills"]
    assert result["title"] == "Frontend Engineer"
    assert result["source"] == "html"


def test_rejects_page_without_readable_posting() -> None:
    with pytest.raises(fetch_service.PostingExtractionError):
        fetch_service.extract_posting(
            "<html><body><nav>Home Jobs</nav></body></html>",
            final_url="https://jobs.example/empty",
        )


@pytest.mark.parametrize(
    "url,error",
    [
        ("http://127.0.0.1/admin", fetch_service.UnsafePostingUrlError),
        ("http://localhost:3000/jobs", fetch_service.UnsafePostingUrlError),
        ("https://user:pass@jobs.example/role", fetch_service.UnsafePostingUrlError),
        ("ftp://jobs.example/role", fetch_service.InvalidPostingUrlError),
        ("not a url", fetch_service.InvalidPostingUrlError),
        ("http://[::1]/role", fetch_service.UnsafePostingUrlError),
    ],
)
def test_rejects_unsafe_urls(url: str, error: type[Exception]) -> None:
    with pytest.raises(error):
        fetch_service.validate_posting_url(url)


def test_rejects_hostname_resolving_to_private_address(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda host, port, **kwargs: [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.5", 443))
        ],
    )

    with pytest.raises(fetch_service.UnsafePostingUrlError):
        fetch_service.validate_posting_url("https://jobs.example/role")
