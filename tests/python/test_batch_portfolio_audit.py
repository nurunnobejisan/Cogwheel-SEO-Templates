"""Regression tests for the batch portfolio auditor.

Locks two defects found by enabling `ruff` (pyflakes) on `python/`:

1. F821 — `audit_property_url()` called `HotelExtractor()` without the class
   ever being imported, so every call raised `NameError` before auditing
   anything. The import now resolves and the auditor runs end to end.
2. ARG001 — the documented `property_name` argument was accepted and then
   ignored. It is now the title fallback when the page declares no title
   (the page-declared name still takes precedence).

Network is never touched: the extractor's fetch is stubbed to raise, which
drives the explicit empty-audit path.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import python.scripts.batch_portfolio_audit as auditor
from python.scraper.hotel_extractor import HotelExtractor


class _NoFetch(HotelExtractor):
    """HotelExtractor whose fetch always fails (no network in tests)."""

    def _fetch_with_urllib(self, _url: str, _timeout_sec: int) -> str:
        raise OSError("network disabled in tests")


def test_hotel_extractor_is_imported_into_the_module(monkeypatch) -> None:
    """F821 regression: `HotelExtractor` must be resolvable in the auditor.

    Before the fix the name was never imported, so the module imported
    "successfully" (the error only fired at call time) and every audit died
    with NameError.
    """
    assert hasattr(auditor, "HotelExtractor"), (
        "batch_portfolio_audit must import HotelExtractor; "
        "audit_property_url() references it directly"
    )
    monkeypatch.setattr(auditor, "HotelExtractor", _NoFetch)

    payload = auditor.audit_property_url("https://example-hotel.invalid/")

    assert payload.pageData.url == "https://example-hotel.invalid/"


def test_audit_returns_empty_scored_payload_when_fetch_fails(monkeypatch) -> None:
    """A failed fetch yields an explicit near-zero audit, never invented data."""
    monkeypatch.setattr(auditor, "HotelExtractor", _NoFetch)

    payload = auditor.audit_property_url("https://example-hotel.invalid/rooms")

    # No fabricated metrics: every content-derived field stays empty/zero.
    assert payload.pageData.totalImages == 0
    assert payload.pageData.h1Elements == []
    assert payload.pageData.schemas == []
    assert payload.pageData.metaDesc == ""
    assert payload.pageData.canonical == ""
    # Score is near-zero because nothing was actually audited.
    assert payload.scores.overall < 10
    assert payload.scores.grade == "NEEDS AUDIT"


def test_property_name_is_used_as_title_fallback(monkeypatch) -> None:
    """ARG001 regression: `property_name` must reach the payload title.

    The docstring promises an optional label; it was previously discarded.
    With no fetched page there is no page-declared title, so the label wins.
    """
    monkeypatch.setattr(auditor, "HotelExtractor", _NoFetch)

    payload = auditor.audit_property_url(
        "https://example-hotel.invalid/", property_name="Grand Example Hotel"
    )

    assert payload.pageData.title == "Grand Example Hotel"


def test_unfetched_page_without_label_has_empty_title(monkeypatch) -> None:
    """With no fetched page and no label, the title stays empty — not invented."""
    monkeypatch.setattr(auditor, "HotelExtractor", _NoFetch)

    payload = auditor.audit_property_url("https://example-hotel.invalid/")

    assert payload.pageData.title == ""
