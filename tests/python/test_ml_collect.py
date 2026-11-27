#!/usr/bin/env python3
"""Tests for the collection layer (ml/collect/).

Sitemaps, robots, the Common Crawl CDX query builder, and Lighthouse labelling.
No network: every test feeds bytes or dicts directly.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.collect.commoncrawl import (  # noqa: E402
    CdxQuery,
    build_cdx_url,
    iter_html,
    parse_cdx,
)
from ml.collect.lighthouse import (  # noqa: E402
    cross_check,
    labels_from_report,
    parse_report,
    to_example_input,
)
from ml.collect.robots import parse_robots, path_matches  # noqa: E402
from ml.collect.sitemaps import flatten, parse_sitemap  # noqa: E402

# ----------------------------------------------------------------- sitemaps --

URLSET = b"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc><priority>1.0</priority></url>
  <url><loc>https://example.com/rooms</loc><lastmod>2026-01-01</lastmod></url>
  <url><loc>https://example.com/</loc></url>
  <url><changefreq>daily</changefreq></url>
</urlset>
"""

INDEX = b"""<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-pages.xml</loc></sitemap>
  <sitemap><loc>https://example.com/sitemap-rooms.xml</loc></sitemap>
</sitemapindex>
"""


def test_urlset_parses_and_dedupes() -> None:
    parsed = parse_sitemap(URLSET)
    assert parsed.kind == "urlset"
    assert not parsed.is_index
    # duplicate <loc> is kept once; the entry with no <loc> is dropped
    assert parsed.locations == [
        "https://example.com/",
        "https://example.com/rooms",
    ]
    assert any("without <loc>" in w for w in parsed.warnings)


def test_urlset_reads_optional_fields() -> None:
    parsed = parse_sitemap(URLSET)
    assert parsed.entries[0].priority == "1.0"
    assert parsed.entries[1].lastmod == "2026-01-01"


def test_index_is_recognised() -> None:
    parsed = parse_sitemap(INDEX)
    assert parsed.kind == "index"
    assert parsed.is_index
    assert len(parsed.entries) == 2


def test_gzipped_sitemap_is_transparent() -> None:
    import gzip

    parsed = parse_sitemap(gzip.compress(URLSET))
    assert parsed.kind == "urlset"
    assert len(parsed.locations) == 2


def test_malformed_xml_warns_instead_of_raising() -> None:
    parsed = parse_sitemap(b"<urlset><url><loc>x")
    assert parsed.kind == "empty"
    assert parsed.warnings


def test_empty_document_is_empty_not_an_error() -> None:
    parsed = parse_sitemap(b"   ")
    assert parsed.kind == "empty"


def test_unknown_root_element_warns() -> None:
    parsed = parse_sitemap(b"<html><body/></html>")
    assert parsed.kind == "empty"
    assert any("unrecognised root" in w for w in parsed.warnings)


def test_flatten_collects_and_dedupes_across_documents() -> None:
    urls, warnings = flatten([URLSET, INDEX])
    assert urls[0] == "https://example.com/"
    assert "https://example.com/sitemap-pages.xml" in urls
    assert len(urls) == len(set(urls))


# ------------------------------------------------------------------ robots --


def test_default_allows_everything() -> None:
    rules = parse_robots(b"")
    assert rules.allowed("AnyBot", "https://example.com/private")


def test_disallow_blocks() -> None:
    rules = parse_robots(b"User-agent: *\nDisallow: /private\n")
    assert not rules.allowed("AnyBot", "https://example.com/private")
    assert rules.allowed("AnyBot", "https://example.com/public")


def test_longest_match_wins() -> None:
    # /private is longer than /, so it wins over the broad Allow.
    rules = parse_robots(b"User-agent: *\nDisallow: /\nAllow: /private\n")
    assert rules.allowed("AnyBot", "https://example.com/private/page")
    assert not rules.allowed("AnyBot", "https://example.com/elsewhere")


def test_tie_goes_to_allow() -> None:
    rules = parse_robots(b"User-agent: *\nDisallow: /x\nAllow: /x\n")
    assert rules.allowed("AnyBot", "https://example.com/x")


def test_wildcard_paths() -> None:
    assert path_matches("/static/*", "/static/img/a.png")
    assert not path_matches("/static/*", "/other/a.png")
    assert path_matches("*.php", "/index.php")
    assert path_matches("/search$", "/search")  # $ anchors the end


def test_specific_agent_group_beats_wildcard() -> None:
    body = b"User-agent: *\nDisallow: /\n\nUser-agent: GoodBot\nDisallow:\n"
    rules = parse_robots(body)
    assert rules.allowed("GoodBot", "https://example.com/anything")
    assert not rules.allowed("EvilBot", "https://example.com/anything")


def test_sitemap_directive_collected() -> None:
    rules = parse_robots(b"User-agent: *\nSitemap: https://example.com/sm.xml\n")
    assert rules.sitemaps == ["https://example.com/sm.xml"]


def test_crawl_delay_parsed() -> None:
    rules = parse_robots(b"User-agent: *\nCrawl-delay: 2.5\n")
    assert rules.delay_for("AnyBot") == 2.5


def test_bad_crawl_delay_warns_not_raises() -> None:
    rules = parse_robots(b"User-agent: *\nCrawl-delay: soon\n")
    assert rules.delay_for("AnyBot") == 0.0
    assert rules.warnings


def test_directives_before_any_user_agent_apply_to_all() -> None:
    rules = parse_robots(b"Disallow: /tmp\n")
    assert not rules.allowed("AnyBot", "https://example.com/tmp")


# ------------------------------------------------------------ commoncrawl ---


def test_cdx_url_contains_query_parameters() -> None:
    url = build_cdx_url(
        CdxQuery(url="example.com", match_type="domain", limit=50),
        index="https://index.commoncrawl.org/CC-MAIN-2024-51-index",
    )
    assert url.startswith("https://index.commoncrawl.org/CC-MAIN-2024-51-index?")
    assert "url=example.com" in url
    assert "matchType=domain" in url
    assert "limit=50" in url
    assert "output=json" in url


def test_cdx_query_validates_its_inputs() -> None:
    with pytest.raises(ValueError, match="match_type"):
        build_cdx_url(CdxQuery(url="x", match_type="everything"))
    with pytest.raises(ValueError, match="limit must be positive"):
        build_cdx_url(CdxQuery(url="x", limit=0))
    with pytest.raises(ValueError, match="from_year"):
        build_cdx_url(CdxQuery(url="x", from_year="last-year"))


def test_cdx_parses_line_delimited_json() -> None:
    payload = (
        b'["urlkey","timestamp","url","mime","status","digest","length"]\n'
        b'["com,example)/", "20240101000000", "https://example.com/", '
        b'"text/html", "200", "ABC123", "1024"]\n'
        b'["com,example)/x", "20240101000001", "https://example.com/x", '
        b'"text/html", "404", "DEF456", "512"]\n'
    )
    records = parse_cdx(payload)
    assert len(records) == 2
    assert records[0].url == "https://example.com/"
    assert records[0].is_success
    assert records[0].is_html
    assert records[1].status_code == 404
    assert not records[1].is_success


def test_cdx_skips_malformed_lines() -> None:
    payload = b'["urlkey","timestamp","url","mime","status","digest","length"]\nnot json\n'
    assert parse_cdx(payload) == []


def test_cdx_empty_payload() -> None:
    assert parse_cdx(b"") == []


def test_iter_html_filters_to_success_html() -> None:
    payload = (
        b'["urlkey","timestamp","url","mime","status","digest","length"]\n'
        b'["a","1","https://example.com/","text/html","200","D","1"]\n'
        b'["b","2","https://example.com/a","application/pdf","200","D","1"]\n'
        b'["c","3","https://example.com/b","text/html","500","D","1"]\n'
    )
    kept = list(iter_html(parse_cdx(payload)))
    assert [r.url for r in kept] == ["https://example.com/"]


# ------------------------------------------------------------- lighthouse ---


def _report(scores=None, audits=None) -> dict:
    return {
        "categories": {
            name: {"score": (scores or {}).get(name, 0.9)}
            for name in ("performance", "accessibility", "best-practices", "seo")
        },
        "audits": audits or {},
        "finalDisplayedUrl": "https://example.com/",
        "fetchTime": "2026-11-27T00:00:00.000Z",
    }


def test_labels_extract_scores() -> None:
    labels = labels_from_report(_report(scores={"seo": 0.5}))
    assert labels.scores["seo"] == 0.5
    assert labels.final_url == "https://example.com/"
    assert not labels.warnings


def test_missing_score_is_none_not_zero() -> None:
    """A missing score must never become 0 — that would be an invented metric."""
    report = {"categories": {"seo": {"score": None}}, "audits": {}}
    labels = labels_from_report(report)
    assert labels.scores["seo"] is None
    assert labels.warnings


def test_failed_audits_map_to_issue_ids() -> None:
    report = _report(
        audits={
            "meta-description": {"score": 0},
            "image-alt": {"score": 0},
            "viewport": {"score": 1},  # passing audits are not failures
        }
    )
    labels = labels_from_report(report)
    assert sorted(labels.failed_audits) == ["image-alt", "meta-description"]
    assert "iss_meta_description_missing" in labels.implied_issues
    assert "iss_viewport_missing" not in labels.implied_issues


def test_cross_check_discards_disagreements() -> None:
    labels = labels_from_report(
        _report(audits={"meta-description": {"score": 0}, "image-alt": {"score": 0}})
    )
    agreed, discarded = cross_check(labels, ["iss_meta_description_missing"])
    assert agreed == ["iss_meta_description_missing"]
    assert discarded == ["iss_img_alt_missing"]


def test_cross_check_keeps_everything_when_rules_agree() -> None:
    labels = labels_from_report(
        _report(audits={"meta-description": {"score": 0}, "image-alt": {"score": 0}})
    )
    agreed, discarded = cross_check(
        labels, ["iss_meta_description_missing", "iss_img_alt_missing"]
    )
    assert len(agreed) == 2
    assert discarded == []


def test_parse_report_handles_bad_json() -> None:
    labels = parse_report("{not json")
    assert labels.warnings
    assert labels.scores == {}


def test_to_example_input_hashes_the_domain() -> None:
    labels = labels_from_report(_report())
    payload = to_example_input(labels, domain="thenines.com", url="https://thenines.com/")
    assert "thenines" not in payload["domainHash"]
    assert len(payload["domainHash"]) == 16
    assert payload["url"] == "https://thenines.com/"
    assert "lighthouseScores" in payload["measured"]
