"""Fetch a public job posting URL and extract clean description text plus metadata.

The fetch is intentionally deterministic: structured JobPosting JSON-LD is
preferred, then job-board content containers, then the readable page text. No
LLM key is required. Every URL (including each redirect target) is checked
before a request is made so the endpoint cannot reach localhost/private hosts.
"""

from __future__ import annotations

import asyncio
import ipaddress
import json
import logging
import re
import socket
from html.parser import HTMLParser
from urllib.parse import urljoin

import httpx

from app.ai_limits import MAX_JOB_CHARACTERS
from app.services.queue_worker import extract_job_details

logger = logging.getLogger(__name__)

FETCH_TIMEOUT_SECONDS = 15.0
MAX_REDIRECTS = 3
MAX_RESPONSE_BYTES = 2_000_000
ALLOWED_CONTENT_TYPES = {
    "application/json",
    "application/ld+json",
    "application/xhtml+xml",
    "text/html",
    "text/plain",
}

_BLOCK_TAGS = {
    "address",
    "article",
    "blockquote",
    "br",
    "div",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "hr",
    "li",
    "main",
    "nav",
    "ol",
    "p",
    "pre",
    "section",
    "table",
    "tbody",
    "td",
    "th",
    "thead",
    "tr",
    "ul",
}
_SKIP_TAGS = {"script", "style", "noscript", "svg", "iframe", "canvas", "template"}
_VOID_TAGS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
}
_CONTENT_HINTS = (
    "job-description",
    "jobdescription",
    "job-details",
    "jobdetails",
    "job-posting",
    "jobposting",
    "posting-description",
    "job-content",
    "jobcontent",
    "jobdesc",
    "description-content",
)
_BOILERPLATE_LINES = {
    "apply",
    "apply now",
    "apply for this job",
    "back to jobs",
    "job details",
    "share this job",
    "save job",
    "similar jobs",
    "equal opportunity employer",
}
_COMMON_SKILLS = (
    "ansible",
    "aws",
    "azure",
    "ci/cd",
    "c++",
    "django",
    "docker",
    "fastapi",
    "figma",
    "flask",
    "gcp",
    "git",
    "go",
    "golang",
    "graphql",
    "java",
    "javascript",
    "kafka",
    "kubernetes",
    "kotlin",
    "linux",
    "llm",
    "machine learning",
    "mongodb",
    "mysql",
    "node.js",
    "pandas",
    "postgresql",
    "python",
    "react",
    "redis",
    "rest api",
    "rust",
    "spark",
    "spring",
    "sql",
    "swift",
    "terraform",
    "typescript",
    "vue",
)
_SKILL_RE = re.compile(
    r"(?<![a-z0-9+#.])("
    + "|".join(re.escape(skill) for skill in _COMMON_SKILLS)
    + r")(?![a-z0-9+#.])",
    re.IGNORECASE,
)
_LOCATION_RE = re.compile(r"^\s*location\s*[:\-]\s*(.+)$", re.IGNORECASE | re.MULTILINE)


class JobPostingFetchError(Exception):
    """Base class for errors safe to show to the API caller."""


class InvalidPostingUrlError(JobPostingFetchError):
    """Raised for malformed or non-web URLs."""


class UnsafePostingUrlError(JobPostingFetchError):
    """Raised when a URL points at a local or private network address."""


class PostingFetchError(JobPostingFetchError):
    """Raised when the posting cannot be downloaded."""


class PostingExtractionError(JobPostingFetchError):
    """Raised when a downloaded page contains no usable posting."""


def resolve_public_hosts(host: str) -> None:
    """Reject hostnames whose DNS answers are not globally routable.

    Kept as a module-level function so tests can replace DNS lookups without
    touching production behavior.
    """
    try:
        infos = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise InvalidPostingUrlError(
            "Could not resolve that job posting link."
        ) from exc

    addresses = {str(info[4][0]) for info in infos}
    if not addresses:
        raise InvalidPostingUrlError("Could not resolve that job posting link.")
    for address in addresses:
        candidate = address.split("%", 1)[0]
        try:
            parsed = ipaddress.ip_address(candidate)
        except ValueError:
            raise UnsafePostingUrlError(
                "That job posting link is not allowed."
            ) from None
        if not parsed.is_global:
            raise UnsafePostingUrlError("That job posting link is not allowed.")


def validate_posting_url(value: str) -> httpx.URL:
    """Return a validated http(s) URL, rejecting credentials and private hosts."""
    try:
        url = httpx.URL(value.strip())
    except Exception as exc:
        raise InvalidPostingUrlError("Enter a valid job posting link.") from exc

    if url.scheme not in ("http", "https") or not url.host:
        raise InvalidPostingUrlError("Enter a valid http or https job posting link.")
    if url.username or url.password:
        raise UnsafePostingUrlError(
            "Job posting links with credentials are not allowed."
        )

    host = url.host.strip("[]").lower().rstrip(".")
    if not host:
        raise InvalidPostingUrlError("Enter a valid job posting link.")
    if host == "localhost" or host.endswith(".localhost") or host.endswith(".local"):
        raise UnsafePostingUrlError("That job posting link is not allowed.")
    if host in {"metadata.google.internal", "metadata.goog"}:
        raise UnsafePostingUrlError("That job posting link is not allowed.")

    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        resolve_public_hosts(host)
        return url

    if not address.is_global:
        raise UnsafePostingUrlError("That job posting link is not allowed.")
    return url


async def fetch_job_posting(url: str) -> dict:
    """Download and extract one job posting. Raises caller-safe errors only."""
    current = str(url)
    timeout = httpx.Timeout(FETCH_TIMEOUT_SECONDS, connect=5.0)
    headers = {
        "Accept": (
            "text/html,application/xhtml+xml,application/json;q=0.9,"
            "text/plain;q=0.8,*/*;q=0.1"
        ),
        "User-Agent": "ResumeMatcher/1.0 (job posting fetch)",
    }

    async with httpx.AsyncClient(
        timeout=timeout, follow_redirects=False, headers=headers
    ) as client:
        for _ in range(MAX_REDIRECTS + 1):
            await asyncio.to_thread(validate_posting_url, current)

            async with client.stream("GET", current) as response:
                if 300 <= response.status_code < 400:
                    location = response.headers.get("location")
                    if not location:
                        raise PostingFetchError(
                            "That job posting redirected without a target."
                        )
                    current = urljoin(str(response.request.url), location)
                    continue

                if response.status_code >= 400:
                    logger.warning(
                        "Job posting fetch failed with status %s", response.status_code
                    )
                    if response.status_code == 404:
                        raise PostingFetchError("That job posting link was not found.")
                    raise PostingFetchError(
                        "The job posting site could not serve that link."
                    )

                content_type = (
                    response.headers.get("content-type", "")
                    .split(";")[0]
                    .strip()
                    .lower()
                )
                if content_type and content_type not in ALLOWED_CONTENT_TYPES:
                    raise PostingExtractionError(
                        "That link is not a text job posting. Paste a job description instead."
                    )

                body = await _read_limited(response)
                encoding = response.encoding or "utf-8"
                text = body.decode(encoding, errors="replace")
                result = extract_posting(text, final_url=str(response.request.url))
                result["final_url"] = str(response.request.url)
                return result

    raise PostingFetchError("That job posting redirected too many times.")


async def _read_limited(response: httpx.Response) -> bytes:
    """Read at most MAX_RESPONSE_BYTES, so a huge page cannot exhaust memory."""
    chunks: list[bytes] = []
    remaining = MAX_RESPONSE_BYTES
    async for chunk in response.aiter_bytes():
        if remaining <= 0:
            break
        kept = chunk[:remaining]
        chunks.append(kept)
        remaining -= len(kept)
    return b"".join(chunks)


def extract_posting(content: str, *, final_url: str) -> dict:
    """Extract posting text and metadata from an HTML or JSON response body."""
    parser = _PostingHTMLParser()
    try:
        parser.feed(content)
        parser.close()
    except Exception:
        logger.debug("Job posting HTML parser recovered from malformed markup")

    is_json = content.lstrip().startswith(("{", "["))
    structured: dict | None = parser.structured_posting
    json_description = ""
    if is_json:
        try:
            payload = json.loads(content)
        except ValueError:
            payload = None
        structured = structured or _find_job_posting(payload)
        if not structured and isinstance(payload, dict):
            json_description = _as_text(
                payload.get("description") or payload.get("content")
            )

    normalized = _normalize_structured(structured) if structured else {}
    raw_description = normalized.get("description") or (
        "" if is_json else parser.focused_text or parser.visible_text
    )
    raw_description = raw_description or json_description
    description = _clean_text(_html_to_text(raw_description))
    if len(description) < 40:
        raise PostingExtractionError(
            "No readable job description was found. Paste the description instead."
        )

    details = extract_job_details(description)
    title = _first_text(
        normalized.get("title"),
        parser.meta.get("og:title"),
        parser.meta.get("twitter:title"),
        parser.title,
        parser.heading,
        details.get("role"),
    )
    company = _first_text(
        normalized.get("company"),
        parser.meta.get("og:site_name"),
        parser.meta.get("author"),
        details.get("company"),
    )
    location = _first_text(
        normalized.get("location"), _first_match(_LOCATION_RE, description), None
    )
    work_mode = normalized.get("work_mode") or _detect_work_mode(description)
    skills = _merge_unique(
        normalized.get("skills"),
        _split_skills(parser.meta.get("keywords")),
        _detect_skills(description),
    )
    source = "json-ld" if normalized else "html"

    return {
        "url": final_url,
        "title": title[:200],
        "company": company[:200],
        "location": location[:200] or None,
        "work_mode": work_mode,
        "skills": skills[:20],
        "job_req_id": _first_text(
            normalized.get("job_req_id"), details.get("job_req_id")
        )[:50]
        or None,
        "description": description[:MAX_JOB_CHARACTERS],
        "source": source,
    }


def _html_to_text(value: str) -> str:
    """Strip markup from HTML fragments embedded in JSON-LD descriptions."""
    if "<" not in value or ">" not in value:
        return value
    parser = _PostingHTMLParser()
    try:
        parser.feed(value)
        parser.close()
    except Exception:
        return re.sub(r"<[^>]+>", " ", value)
    return parser.focused_text or parser.visible_text


def _clean_text(value: str) -> str:
    """Normalize whitespace and drop common site chrome from extracted text."""
    normalized = (
        value.replace("\u00a0", " ")
        .replace("\u200b", "")
        .replace("\r\n", "\n")
        .replace("\r", "\n")
    )
    lines: list[str] = []
    last_blank = False
    for raw_line in normalized.split("\n"):
        line = re.sub(r"[ \t]+", " ", raw_line).strip()
        if not line:
            if lines and not last_blank:
                lines.append("")
                last_blank = True
            continue
        if line.casefold() in _BOILERPLATE_LINES:
            continue
        lines.append(line)
        last_blank = False
    while lines and not lines[-1]:
        lines.pop()
    return "\n".join(lines).strip()


def _detect_work_mode(text: str) -> str | None:
    lowered = text.lower()
    if "hybrid" in lowered:
        return "hybrid"
    if "remote" in lowered:
        return "remote"
    if "on-site" in lowered or "onsite" in lowered or "in office" in lowered:
        return "onsite"
    return None


def _detect_skills(text: str) -> list[str]:
    """Collect a small set of common technologies mentioned in the posting."""
    seen: set[str] = set()
    skills: list[str] = []
    for match in _SKILL_RE.finditer(text):
        value = match.group(1)
        key = value.casefold()
        if key not in seen:
            seen.add(key)
            skills.append("Go" if key == "go" else value)
    return skills


def _split_skills(value: object) -> list[str]:
    if not isinstance(value, str):
        return []
    return [part.strip() for part in re.split(r"[,;|]", value) if part.strip()]


def _as_skill_list(value: object) -> list[str]:
    """Accept JSON-LD skills as a list or a delimited string."""
    if isinstance(value, list):
        return [
            part
            for item in value
            for part in _split_skills(_as_text(item)) or [_as_text(item)]
            if part
        ]
    return _split_skills(_as_text(value))


def _merge_unique(*groups: object) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for group in groups:
        if not isinstance(group, (list, tuple)):
            continue
        for item in group:
            if not isinstance(item, str) or not item.strip():
                continue
            key = item.strip().casefold()
            if key not in seen:
                seen.add(key)
                result.append(item.strip())
    return result


def _first_text(*values: object) -> str:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _first_match(pattern: re.Pattern[str], value: str) -> str | None:
    match = pattern.search(value)
    return match.group(1).strip() if match else None


def _as_text(value: object) -> str:
    """Flatten JSON-LD text values, which may be strings, lists or dicts."""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, list):
        return " ".join(_as_text(item) for item in value).strip()
    if isinstance(value, dict):
        for key in ("@value", "value", "name", "description"):
            if key in value:
                text = _as_text(value[key])
                if text:
                    return text
    return ""


def _find_job_posting(value: object) -> dict | None:
    """Walk JSON-LD/JSON looking for a JobPosting object."""
    if isinstance(value, list):
        for item in value:
            found = _find_job_posting(item)
            if found:
                return found
        return None
    if not isinstance(value, dict):
        return None

    types = value.get("@type")
    type_names: list[str] = []
    if isinstance(types, str):
        type_names = [types]
    elif isinstance(types, list):
        type_names = [item for item in types if isinstance(item, str)]
    if any(name.casefold() == "jobposting" for name in type_names):
        return value
    if isinstance(value.get("description"), str) and (
        isinstance(value.get("title"), str) or isinstance(value.get("jobTitle"), str)
    ):
        return value
    for nested in value.values():
        found = _find_job_posting(nested)
        if found:
            return found
    return None


def _normalize_structured(value: dict | None) -> dict:
    """Map the useful parts of a JobPosting object to the API response shape."""
    if not value:
        return {}

    organization = value.get("hiringOrganization")
    company = ""
    if isinstance(organization, dict):
        company = _as_text(organization.get("name"))
    elif isinstance(organization, str):
        company = _as_text(organization)

    location_value = value.get("jobLocation")
    location = ""
    if isinstance(location_value, list):
        location_value = location_value[0] if location_value else None
    if isinstance(location_value, dict):
        address = location_value.get("address")
        if isinstance(address, dict):
            location = ", ".join(
                part
                for part in (
                    _as_text(address.get("addressLocality")),
                    _as_text(address.get("addressRegion")),
                    _as_text(address.get("addressCountry")),
                )
                if part
            )
        location = location or _as_text(location_value.get("name"))
    else:
        location = _as_text(location_value)

    employment_type = _as_text(value.get("employmentType")).casefold()
    location_type = _as_text(value.get("jobLocationType")).casefold()
    if "remote" in employment_type or "telecommute" in location_type:
        work_mode = "remote"
    elif "hybrid" in employment_type:
        work_mode = "hybrid"
    else:
        work_mode = ""

    identifier = value.get("identifier")
    job_req_id = ""
    if isinstance(identifier, dict):
        job_req_id = _as_text(identifier.get("@value") or identifier.get("value"))
    elif identifier:
        job_req_id = _as_text(identifier)

    return {
        "title": _as_text(value.get("title") or value.get("jobTitle")),
        "company": company,
        "location": location,
        "description": _as_text(value.get("description")),
        "work_mode": work_mode,
        "skills": _as_skill_list(value.get("skills")),
        "job_req_id": job_req_id,
    }


class _PostingHTMLParser(HTMLParser):
    """Small HTML parser that keeps structured metadata and readable text."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.meta: dict[str, str] = {}
        self.json_ld: list[object] = []
        self.title_parts: list[str] = []
        self.heading_parts: list[str] = []
        self.visible_parts: list[str] = []
        self.focused_parts: list[str] = []
        self._stack: list[tuple[str, bool]] = []
        self._skip_depth = 0
        self._in_title = False
        self._in_heading = False
        self._ld_parts: list[str] | None = None

    @property
    def title(self) -> str:
        return _clean_text(" ".join(self.title_parts))

    @property
    def heading(self) -> str:
        return _clean_text(" ".join(self.heading_parts))

    @property
    def visible_text(self) -> str:
        return _clean_text("".join(self.visible_parts))

    @property
    def focused_text(self) -> str:
        return _clean_text("".join(self.focused_parts))

    @property
    def structured_posting(self) -> dict | None:
        return _find_job_posting(self.json_ld)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {key.lower(): value or "" for key, value in attrs}

        if tag == "meta":
            key = (
                attributes.get("property")
                or attributes.get("name")
                or attributes.get("itemprop")
            )
            if key:
                self.meta[key.strip().lower()] = attributes.get("content", "").strip()

        if tag == "script" and "ld+json" in attributes.get("type", "").lower():
            self._ld_parts = []

        if tag in _SKIP_TAGS:
            self._skip_depth += 1

        if self._skip_depth:
            if tag not in _VOID_TAGS:
                self._stack.append((tag, False))
            return

        if tag == "title":
            self._in_title = True
        if tag == "h1" and not self.heading_parts:
            self._in_heading = True

        if tag in _BLOCK_TAGS:
            self.visible_parts.append("\n")
            if self._in_focused():
                self.focused_parts.append("\n")

        focused = self._in_focused() or self._has_content_hint(attributes)
        if tag not in _VOID_TAGS:
            self._stack.append((tag, focused))

    def handle_data(self, data: str) -> None:
        if self._ld_parts is not None:
            self._ld_parts.append(data)
        if self._in_title:
            self.title_parts.append(data)
        if self._in_heading:
            self.heading_parts.append(data)
        if self._skip_depth:
            return
        self.visible_parts.append(data)
        if self._in_focused():
            self.focused_parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._ld_parts is not None:
            try:
                parsed = json.loads("".join(self._ld_parts))
            except ValueError:
                parsed = None
            if parsed is not None:
                self.json_ld.append(parsed)
            self._ld_parts = None

        if tag == "title":
            self._in_title = False
        if tag == "h1":
            self._in_heading = False

        for index in range(len(self._stack) - 1, -1, -1):
            if self._stack[index][0] == tag:
                del self._stack[index:]
                break

        if tag in _SKIP_TAGS and self._skip_depth:
            self._skip_depth -= 1

        if tag in _BLOCK_TAGS and not self._skip_depth:
            self.visible_parts.append("\n")
            if self._in_focused():
                self.focused_parts.append("\n")

    def _in_focused(self) -> bool:
        return bool(self._stack and self._stack[-1][1])

    @staticmethod
    def _has_content_hint(attributes: dict[str, str]) -> bool:
        values = " ".join(
            attributes.get(key, "")
            for key in ("id", "class", "role", "aria-label", "itemprop")
        ).casefold()
        return any(hint in values for hint in _CONTENT_HINTS)
