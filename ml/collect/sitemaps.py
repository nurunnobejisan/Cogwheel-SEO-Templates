"""Sitemap parsing — index files, urlset files, and nested discovery.

Standard library only (``xml.etree.ElementTree``), so it runs in CI and in the
extension pipeline alike. Handles the two shapes Google actually documents:
``<sitemapindex>`` and `<urlset>`; anything else is reported rather than
guessed at.

No network I/O: callers fetch the bytes and hand them over. That keeps robots
politeness, caching and SSRF guarding in one place (the caller) instead of
being re-implemented per parser.
"""

from __future__ import annotations

import gzip
import io
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import Iterable, List, Optional, Tuple

__all__ = ["SitemapEntry", "ParsedSitemap", "parse_sitemap", "decompress"]

# Google's sitemap protocol has no namespace, but plenty of generators add one.
_NS_CANDIDATES = ("", "{http://www.sitemaps.org/schemas/sitemap/0.9}")


@dataclass(frozen=True)
class SitemapEntry:
    """One `<url>` or `<sitemap>` element."""

    loc: str
    lastmod: Optional[str] = None
    changefreq: Optional[str] = None
    priority: Optional[str] = None


@dataclass
class ParsedSitemap:
    """The result of parsing one sitemap document."""

    kind: str  # "index" | "urlset" | "empty"
    entries: List[SitemapEntry] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    @property
    def locations(self) -> List[str]:
        return [e.loc for e in self.entries]

    @property
    def is_index(self) -> bool:
        return self.kind == "index"


def decompress(payload: bytes) -> bytes:
    """Transparently gunzip ``.xml.gz`` sitemaps; pass plain bytes through."""
    if len(payload) >= 2 and payload[0] == 0x1F and payload[1] == 0x8B:
        return gzip.GzipFile(fileobj=io.BytesIO(payload)).read()
    return payload


def _tag(element: ET.Element, name: str) -> Optional[str]:
    """Read a child element, tolerating an absent or default namespace."""
    for prefix in _NS_CANDIDATES:
        child = element.find(f"{prefix}{name}")
        if child is not None and child.text:
            value = child.text.strip()
            if value:
                return value
    return None


def _root_of(payload: bytes) -> Tuple[Optional[ET.Element], List[str]]:
    """Parse XML and return the root plus any recoverable warnings."""
    warnings: List[str] = []
    try:
        root = ET.fromstring(payload)
    except ET.ParseError as exc:
        # A truncated download is common; surface it instead of raising so a
        # caller can retry rather than lose the whole crawl batch.
        return None, [f"XML parse error: {exc}"]
    if not isinstance(root.tag, str):
        return None, ["document has no element root"]
    return root, warnings


def parse_sitemap(payload: bytes) -> ParsedSitemap:
    """Parse a sitemap document.

    Returns a :class:`ParsedSitemap` whose ``kind`` is ``index`` for a
    ``<sitemapindex>``, ``urlset`` for a ``<urlset>``, or ``empty`` when the
    document has no recognised entries. Malformed XML yields ``empty`` plus a
    warning — never an exception, so one bad file cannot abort a crawl.
    """
    body = decompress(payload)
    if not body.strip():
        return ParsedSitemap(kind="empty", warnings=["empty document"])

    root, warnings = _root_of(body)
    if root is None:
        return ParsedSitemap(kind="empty", warnings=warnings)

    tag = root.tag
    for prefix in _NS_CANDIDATES:
        if tag == f"{prefix}sitemapindex":
            tag = "sitemapindex"
            break
        if tag == f"{prefix}urlset":
            tag = "urlset"
            break
    else:
        warnings.append(f"unrecognised root element <{root.tag}>")
        return ParsedSitemap(kind="empty", warnings=warnings)

    is_index = tag == "sitemapindex"
    child_name = "sitemap" if is_index else "url"
    entries: List[SitemapEntry] = []
    seen: set = set()

    for prefix in _NS_CANDIDATES:
        children = root.findall(f"{prefix}{child_name}")
        if children:
            for child in children:
                loc = _tag(child, "loc")
                if not loc:
                    warnings.append(f"<{child_name}> entry without <loc> skipped")
                    continue
                if loc in seen:
                    # Duplicate <loc> entries are common in generated sitemaps;
                    # keep the first and drop the rest so counts stay honest.
                    continue
                seen.add(loc)
                entries.append(
                    SitemapEntry(
                        loc=loc,
                        lastmod=_tag(child, "lastmod"),
                        changefreq=_tag(child, "changefreq"),
                        priority=_tag(child, "priority"),
                    )
                )
            break

    if not entries:
        warnings.append(f"<{tag}> contains no <{child_name}> entries")

    return ParsedSitemap(
        kind="index" if is_index else "urlset",
        entries=entries,
        warnings=warnings,
    )


def flatten(documents: Iterable[bytes]) -> Tuple[List[str], List[str]]:
    """Collect every ``<loc>`` across a batch of already-fetched sitemaps.

    Returns ``(locations, warnings)`` in first-seen order, de-duplicated.

    This function deliberately does **not** recurse: it never fetches, so a
    caller keeps control of robots politeness, caching and the SSRF guard.
    An index document contributes its child sitemap locations; a urlset
    contributes page URLs. Callers that need to walk an index resolve the
    index locations themselves and pass the results back in.
    """
    urls: List[str] = []
    warnings: List[str] = []
    seen: set = set()

    for doc in documents:
        parsed = parse_sitemap(doc)
        warnings.extend(parsed.warnings)
        for loc in parsed.locations:
            if loc not in seen:
                seen.add(loc)
                urls.append(loc)

    return urls, warnings
