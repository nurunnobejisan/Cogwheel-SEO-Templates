"""Measured on-page audit for the WordPress companion plugin.

The plugin sends only ``{url, post_id}``. We fetch that URL through the repo's
SSRF-guarded helper, derive facts from the returned HTML, and score those facts
with the existing scoring function. A fetch or validation failure returns an
explicit ``not_measured`` result: no score is invented.
"""

from __future__ import annotations

import importlib.util
from collections.abc import Callable
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup

from python.scripts.batch_portfolio_audit import calculate_seo_scores

PROJECT_ROOT = Path(__file__).resolve().parent.parent
_SAFETY_PATH = PROJECT_ROOT / "src" / "core" / "claude-seo" / "scripts" / "url_safety.py"
MAX_AUDIT_HTML_BYTES = 2 * 1024 * 1024
USER_AGENT = "SEO-Studio-Audit/1.0 (+https://github.com/nurunnobejisan/SEO-Studio)"
_FETCH_TIMEOUT_SECONDS = 12


def _safety_module() -> Any:
    """Load the canonical SSRF guard (its directory contains a hyphen)."""
    spec = importlib.util.spec_from_file_location("seo_studio_url_safety", _SAFETY_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("SSRF guard is unavailable at " + str(_SAFETY_PATH))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def fetch_html(url: str) -> str:
    """Fetch a public URL with DNS pinning, redirect checks and a body cap."""
    safety = _safety_module()
    response = safety.safe_requests_get(
        url,
        timeout=_FETCH_TIMEOUT_SECONDS,
        headers={"User-Agent": USER_AGENT},
    )
    response.raise_for_status()
    content_type = response.headers.get("content-type", "").lower()
    if "html" not in content_type:
        raise ValueError("target did not return HTML")
    if int(response.headers.get("content-length", "0") or "0") > MAX_AUDIT_HTML_BYTES:
        raise ValueError("target response is too large")
    return response.content[:MAX_AUDIT_HTML_BYTES].decode("utf-8", errors="replace")


def _meta_content(soup: BeautifulSoup, key: str, attribute: str) -> str:
    tag = soup.find("meta", attrs={attribute: key})
    return str(tag.get("content", "")) if tag is not None else ""


def page_facts(html: str) -> dict[str, Any]:
    """Derive only facts present in the fetched HTML; no guesses."""
    soup = BeautifulSoup(html, "html.parser")
    body = soup.body or soup
    json_ld = " ".join(
        script.get_text(" ", strip=True)
        for script in soup.find_all("script", attrs={"type": "application/ld+json"})
    ).lower()
    canonical = any(
        link.get("rel") and "canonical" in [str(value).lower() for value in link.get("rel")]
        and link.get("href")
        for link in soup.find_all("link")
    )
    return {
        "title": soup.title.get_text(" ", strip=True) if soup.title else "",
        "meta_desc": _meta_content(soup, "description", "name"),
        "h1_count": len(soup.find_all("h1")),
        "has_canonical": canonical,
        "has_viewport": bool(_meta_content(soup, "viewport", "name")),
        "has_lodging_schema": '"hotel"' in json_ld or '"lodgingbusiness"' in json_ld,
        "images_without_alt": sum(
            1 for image in soup.find_all("img") if not str(image.get("alt", "")).strip()
        ),
        "words": len(body.get_text(" ", strip=True).split()),
        "has_faq_schema": '"faqpage"' in json_ld,
        "has_og": bool(
            _meta_content(soup, "og:title", "property")
            and _meta_content(soup, "og:image", "property")
        ),
    }


def measure(url: str, fetch: Callable[[str], str] | None = None) -> dict[str, Any]:
    """Return a labelled audit result for one URL."""
    source = fetch or fetch_html
    try:
        html = source(url)
    except Exception as exc:  # SSRF refusal, network error, non-HTML response
        return {
            "status": "not_measured",
            "score": None,
            "reason": f"{type(exc).__name__}: {exc}",
        }

    facts = page_facts(html)
    scores = calculate_seo_scores(
        facts["title"],
        facts["meta_desc"],
        facts["h1_count"],
        facts["has_canonical"],
        facts["has_viewport"],
        facts["has_lodging_schema"],
        facts["images_without_alt"],
        facts["words"],
        facts["has_faq_schema"],
        facts["has_og"],
    )
    return {
        "status": "measured",
        "score": scores.overall,
        "grade": scores.grade,
        "components": {
            "onPage": scores.onPage,
            "schemaTechnical": scores.schemaTechnical,
            "geoAiReadiness": scores.geoAiReadiness,
        },
        "facts": facts,
    }
