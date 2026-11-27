"""Common Crawl index access (CDX Server API) — query building, not fetching.

Standard library only. This module turns a crawl selection into a CDX request
and parses the response; it never performs the request itself, so the SSRF
guard, rate limiting and caching stay in the caller (rule: one politeness
policy for every collector).

Records read from Common Crawl are used for **structure and labels only**
(see ``ml/sources.yaml`` -> ``commoncrawl``): the markup shape and page-type
labels. Body prose is never copied into a training target.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Dict, Iterable, Iterator, List, Optional, Sequence
from urllib.parse import quote, urlencode

__all__ = ["CdxQuery", "CdxRecord", "build_cdx_url", "parse_cdx", "parse_cdx_json"]

#: Fields requested from the CDX API. `offset`/`length` are returned only when
#: `filter`/`fl` ask for them; we keep the default set plus mime/digest so
#: callers can dedupe without a second round trip.
DEFAULT_FIELDS = (
    "urlkey",
    "timestamp",
    "url",
    "mime",
    "status",
    "digest",
    "length",
)


@dataclass(frozen=True)
class CdxQuery:
    """A CDX Server API query.

    ``match_type`` is one of ``exact`` | ``prefix`` | ``host`` | ``domain``.
    ``from_year``/``to_year`` bound the crawl; ``limit`` caps rows so a broad
    ``domain`` query cannot pull an unbounded batch into memory.
    """

    url: str
    match_type: str = "prefix"
    from_year: Optional[str] = None
    to_year: Optional[str] = None
    limit: int = 1000
    collapse: Optional[str] = "digest"  # skip revisit records with identical digest
    filter_status: Optional[int] = 200
    fields: Sequence[str] = DEFAULT_FIELDS
    show_resume_key: bool = False

    def validate(self) -> None:
        if self.match_type not in {"exact", "prefix", "host", "domain"}:
            raise ValueError(f"match_type must be exact|prefix|host|domain, got {self.match_type!r}")
        if self.limit <= 0:
            raise ValueError("limit must be positive")
        if self.from_year and not self.from_year.isdigit():
            raise ValueError("from_year must be a 4-digit year string")
        if self.to_year and not self.to_year.isdigit():
            raise ValueError("to_year must be a 4-digit year string")


@dataclass(frozen=True)
class CdxRecord:
    """One row of a CDX response."""

    urlkey: str
    timestamp: str
    url: str
    mime: str
    status: str
    digest: str
    length: str

    @property
    def status_code(self) -> Optional[int]:
        try:
            return int(self.status)
        except (TypeError, ValueError):
            return None

    @property
    def is_html(self) -> bool:
        return self.mime.lower().startswith("text/html")

    @property
    def is_success(self) -> bool:
        return self.status_code == 200


def build_cdx_url(query: CdxQuery, index: str = "https://index.commoncrawl.org/collinfo.json") -> str:
    """Build a CDX query URL. Pure function — easy to unit-test and to log.

    ``index`` is normally a collection endpoint such as
    ``https://index.commoncrawl.org/CC-MAIN-2024-51-index``; the default is
    only a placeholder so the signature has a sensible value, and callers are
    expected to pass a real one.
    """
    query.validate()
    base = index.rstrip("/")
    # `collinfo.json` is the collection list, not an index — swap the suffix
    # for the conventional `-index` endpoint rather than silently querying it.
    if base.endswith("collinfo.json"):
        base = base[: -len("collinfo.json")] + "CC-MAIN-2024-51-index"
    if not base.endswith("-index"):
        base = f"{base}-index"

    params: Dict[str, Any] = {
        "url": query.url,
        "matchType": query.match_type,
        "output": "json",
        "limit": query.limit,
    }
    if query.from_year:
        params["from"] = query.from_year
    if query.to_year:
        params["to"] = query.to_year
    if query.collapse:
        params["collapse"] = query.collapse
    if query.filter_status is not None:
        params["filter"] = f"status:{query.filter_status}"
    if query.fields:
        params["fl"] = ",".join(query.fields)
    if query.show_resume_key:
        params["showResumeKey"] = "true"

    return f"{base}?{urlencode(params, quote_via=quote)}"


def parse_cdx(payload: bytes) -> List[CdxRecord]:
    """Parse a CDX response (one JSON array per line, or a single array).

    The header line (field names) is skipped. Malformed lines are skipped with
    a count rather than raised, so one bad row cannot lose a whole batch.
    """
    text = payload.decode("utf-8", errors="replace").strip()
    if not text:
        return []

    records: List[CdxRecord] = []
    header: Optional[List[str]] = None

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue

        if isinstance(row, dict):
            records.append(_record_from_mapping(row))
            continue
        if not isinstance(row, list):
            continue

        # First array is the header when it contains field names, not data.
        if header is None and row and all(isinstance(cell, str) for cell in row):
            if "url" in row or "urlkey" in row:
                header = row
                continue
        if header is None:
            header = list(DEFAULT_FIELDS)

        mapping = dict(zip(header, row))
        records.append(_record_from_mapping(mapping))

    return records


def parse_cdx_json(payload: bytes) -> List[CdxRecord]:
    """Alias for :func:`parse_cdx` — the API is JSON either way."""
    return parse_cdx(payload)


def _record_from_mapping(mapping: Dict[str, Any]) -> CdxRecord:
    def cell(key: str) -> str:
        value = mapping.get(key, "")
        return "" if value is None else str(value)

    return CdxRecord(
        urlkey=cell("urlkey"),
        timestamp=cell("timestamp"),
        url=cell("url"),
        mime=cell("mime"),
        status=cell("status"),
        digest=cell("digest"),
        length=cell("length"),
    )


def iter_html(records: Iterable[CdxRecord]) -> Iterator[CdxRecord]:
    """Yield only successful HTML records — the ones worth fetching."""
    for record in records:
        if record.is_html and record.is_success:
            yield record
