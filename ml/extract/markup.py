"""Structured markup extraction: JSON-LD, Open Graph, Twitter, meta, headings.

``extruct`` (in ``ml/requirements-ml.txt``) is preferred for JSON-LD /
Microdata / RDFa because it handles the awkward real-world cases. When it is
not installed — as in CI, which installs only the root ``requirements.txt`` —
a ``bs4`` fallback covers JSON-LD, which is what the rules engine and the
schema writer actually consume.

Every value returned here is read out of the supplied HTML. Nothing is
defaulted, inferred or filled in: a missing tag is ``None``, never a guess.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from bs4 import BeautifulSoup

__all__ = ["extract_markup", "has_extruct", "MarkupResult"]

#: Open Graph properties we keep. A hotel page that emits the rest is
#: still only useful to us through these.
OG_KEYS = (
    "og:title",
    "og:description",
    "og:image",
    "og:url",
    "og:type",
    "og:site_name",
    "og:locale",
)

TWITTER_KEYS = (
    "twitter:card",
    "twitter:title",
    "twitter:description",
    "twitter:image",
)

#: JSON-LD ``@type`` values that matter for the hospitality schema writer.
SCHEMA_TYPES_OF_INTEREST = (
    "Hotel",
    "LodgingBusiness",
    "Restaurant",
    "FAQPage",
    "BreadcrumbList",
    "Organization",
    "WebSite",
    "Product",
    "Article",
    "LocalBusiness",
    "Event",
    "Offer",
    "AggregateRating",
)


def has_extruct() -> bool:
    """True when the preferred ``extruct`` backend is importable."""
    try:
        import extruct  # noqa: F401
    except Exception:
        return False
    return True


class MarkupResult(dict):
    """A plain dict with a couple of convenience accessors."""

    @property
    def jsonld(self) -> List[Dict[str, Any]]:
        return list(self.get("jsonLd") or [])

    @property
    def schema_types(self) -> List[str]:
        """Every ``@type`` seen across all JSON-LD nodes, de-duplicated."""
        seen: List[str] = []

        def walk(node: Any) -> None:
            if isinstance(node, list):
                for item in node:
                    walk(item)
                return
            if not isinstance(node, dict):
                return
            raw = node.get("@type")
            types = raw if isinstance(raw, list) else [raw]
            for value in types:
                if isinstance(value, str) and value not in seen:
                    seen.append(value)
            for key in ("@graph", "mainEntity", "itemListElement", "item"):
                if key in node:
                    walk(node[key])

        for node in self.jsonld:
            walk(node)
        return seen


def _extract_jsonld_with_extruct(html: str, url: str) -> List[Dict[str, Any]]:
    """Preferred path — delegates JSON-LD parsing to ``extruct``."""
    import extruct

    data = extruct.extract(html, base_url=url, syntaxes=["json-ld"])
    nodes: List[Dict[str, Any]] = []
    for entry in data.get("json-ld", []) or []:
        if isinstance(entry, dict):
            nodes.append(entry)
        elif isinstance(entry, list):
            nodes.extend(item for item in entry if isinstance(item, dict))
    return nodes


def _extract_jsonld_with_bs4(html: str) -> List[Dict[str, Any]]:
    """Fallback path — pull ``<script type="application/ld+json">`` blocks."""
    soup = BeautifulSoup(html, "html.parser")
    nodes: List[Dict[str, Any]] = []
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw = script.string or script.get_text() or ""
        raw = raw.strip()
        if not raw:
            continue
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            # A malformed block is a fact about the page, not a crash: skip it
            # and let the rules engine report the invalid JSON-LD itself.
            continue
        if isinstance(parsed, dict):
            nodes.append(parsed)
        elif isinstance(parsed, list):
            nodes.extend(item for item in parsed if isinstance(item, dict))
    return nodes


def _meta_content(soup: BeautifulSoup, *, name: str = "", prop: str = "") -> Optional[str]:
    """Read a `<meta>` by `name` or `property`, returning None when absent."""
    tag = None
    if name:
        tag = soup.find("meta", attrs={"name": name})
    if tag is None and prop:
        tag = soup.find("meta", attrs={"property": prop})
    if tag is None:
        return None
    content = tag.get("content")
    if content is None:
        return None
    content = str(content).strip()
    return content or None


def _heading_levels(soup: BeautifulSoup) -> Dict[str, List[str]]:
    """Collect h1-h6 text in document order, per level."""
    levels: Dict[str, List[str]] = {f"h{i}": [] for i in range(1, 7)}
    for i in range(1, 7):
        for tag in soup.find_all(f"h{i}"):
            text = tag.get_text(" ", strip=True)
            if text:
                levels[f"h{i}"].append(text)
    return levels


def _jsonld_blocks_invalid(html: str) -> int:
    """Count JSON-LD blocks that do not parse — a measured fact, not a guess."""
    soup = BeautifulSoup(html, "html.parser")
    invalid = 0
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw = (script.string or script.get_text() or "").strip()
        if not raw:
            continue
        try:
            json.loads(raw)
        except json.JSONDecodeError:
            invalid += 1
    return invalid


def extract_markup(html: str, url: str = "") -> MarkupResult:
    """Extract structured markup from an HTML document.

    Returns a dict with (all values ``None``/``[]`` when genuinely absent):

    - ``jsonLd`` — parsed JSON-LD nodes
    - ``schemaTypes`` — every ``@type`` seen
    - ``invalidJsonLdBlocks`` — count of unparseable JSON-LD blocks
    - ``title``, ``metaDescription``, ``canonical``, ``robots``, ``lang``
    - ``openGraph``, ``twitter`` — dicts of the tags present
    - ``headings`` — ``{"h1": [...], ...}``
    - ``hreflang`` — ``{"en": "https://..."}``
    - ``jsonLdSource`` — ``"extruct"`` or ``"bs4"``
    """
    if not html:
        return MarkupResult(
            {
                "jsonLd": [],
                "schemaTypes": [],
                "invalidJsonLdBlocks": 0,
                "title": None,
                "metaDescription": None,
                "canonical": None,
                "robots": None,
                "lang": None,
                "openGraph": {},
                "twitter": {},
                "headings": {},
                "hreflang": {},
                "jsonLdSource": "none",
            }
        )

    soup = BeautifulSoup(html, "html.parser")

    source = "bs4"
    if has_extruct():
        try:
            jsonld = _extract_jsonld_with_extruct(html, url)
            source = "extruct"
        except Exception:
            # A broken extruct run must not lose the page; fall back cleanly.
            jsonld = _extract_jsonld_with_bs4(html)
            source = "bs4"
    else:
        jsonld = _extract_jsonld_with_bs4(html)

    title_tag = soup.find("title")
    title = title_tag.get_text(strip=True) if title_tag else None
    if title == "":
        title = None

    canonical_tag = soup.find("link", rel="canonical")
    canonical: Optional[str] = None
    if canonical_tag is not None:
        href = canonical_tag.get("href")
        if href:
            canonical = str(href).strip() or None

    open_graph: Dict[str, str] = {}
    for key in OG_KEYS:
        value = _meta_content(soup, prop=key)
        if value is not None:
            open_graph[key] = value

    twitter: Dict[str, str] = {}
    for key in TWITTER_KEYS:
        value = _meta_content(soup, name=key)
        if value is not None:
            twitter[key] = value

    hreflang: Dict[str, str] = {}
    for tag in soup.find_all("link", rel="alternate"):
        hreflang_value = tag.get("hreflang")
        href = tag.get("href")
        if hreflang_value and href:
            hreflang[str(hreflang_value)] = str(href)

    html_tag = soup.find("html")
    lang: Optional[str] = None
    if html_tag is not None and html_tag.get("lang"):
        lang = str(html_tag.get("lang")).strip() or None

    return MarkupResult(
        {
            "jsonLd": jsonld,
            "schemaTypes": MarkupResult({"jsonLd": jsonld}).schema_types,
            "invalidJsonLdBlocks": _jsonld_blocks_invalid(html),
            "title": title,
            "metaDescription": _meta_content(soup, name="description"),
            "canonical": canonical,
            "robots": _meta_content(soup, name="robots"),
            "lang": lang,
            "openGraph": open_graph,
            "twitter": twitter,
            "headings": _heading_levels(soup),
            "hreflang": hreflang,
            "jsonLdSource": source,
        }
    )
