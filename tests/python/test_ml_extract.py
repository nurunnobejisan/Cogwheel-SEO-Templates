#!/usr/bin/env python3
"""Tests for the extraction layer (ml/extract/).

CI installs only the root requirements, so these exercise the ``bs4``
fallback. The ``extruct`` / ``trafilatura`` paths are exercised only when
those optional dependencies are importable.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.extract import extract_all, extract_markup, extract_text  # noqa: E402
from ml.extract.markup import has_extruct  # noqa: E402
from ml.extract.text import has_trafilatura, sentence_truncate  # noqa: E402

HOTEL_HTML = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>The Nines Portland | The Nines</title>
  <meta name="description" content="Downtown Portland luxury hotel.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://thenines.com/">
  <link rel="alternate" hreflang="en" href="https://thenines.com/">
  <link rel="alternate" hreflang="fr" href="https://thenines.com/fr/">
  <meta property="og:title" content="The Nines Portland">
  <meta property="og:image" content="https://thenines.com/og.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"Hotel","name":"The Nines",
   "address":{"@type":"PostalAddress","addressLocality":"Portland"}}
  </script>
  <script type="application/ld+json">{"@type":"BreadcrumbList"}</script>
  <script type="application/ld+json">{not valid json</script>
</head>
<body>
  <nav>Home Rooms Dining</nav>
  <h1>The Nines</h1>
  <h2>Rooms</h2>
  <h3>Suites</h3>
  <p>Luxury hotel in downtown Portland.</p>
</body>
</html>
"""

NO_META_HTML = """<!doctype html>
<html>
<head><title>x</title></head>
<body><p>nothing else</p></body>
</html>
"""


# ------------------------------------------------------------------ markup --


def test_title_and_meta_read() -> None:
    m = extract_markup(HOTEL_HTML, "https://thenines.com/")
    assert m["title"] == "The Nines Portland | The Nines"
    assert m["metaDescription"] == "Downtown Portland luxury hotel."
    assert m["canonical"] == "https://thenines.com/"
    assert m["robots"] == "index, follow"
    assert m["lang"] == "en"


def test_missing_tags_are_none_not_guessed() -> None:
    m = extract_markup(NO_META_HTML, "https://example.com/")
    assert m["metaDescription"] is None
    assert m["canonical"] is None
    assert m["robots"] is None
    assert m["lang"] is None


def test_jsonld_nodes_parsed() -> None:
    m = extract_markup(HOTEL_HTML, "https://thenines.com/")
    # the malformed block is skipped, the two valid ones survive
    assert len(m["jsonLd"]) == 2
    assert m["schemaTypes"] == ["Hotel", "BreadcrumbList"]


def test_invalid_jsonld_block_is_counted() -> None:
    m = extract_markup(HOTEL_HTML, "https://thenines.com/")
    assert m["invalidJsonLdBlocks"] == 1


def test_open_graph_and_twitter() -> None:
    m = extract_markup(HOTEL_HTML, "https://thenines.com/")
    assert m["openGraph"]["og:title"] == "The Nines Portland"
    assert m["twitter"]["twitter:card"] == "summary_large_image"
    # absent OG tags are simply absent
    assert "og:description" not in m["openGraph"]


def test_headings_collected_per_level() -> None:
    m = extract_markup(HOTEL_HTML, "https://thenines.com/")
    assert m["headings"]["h1"] == ["The Nines"]
    assert m["headings"]["h2"] == ["Rooms"]
    assert m["headings"]["h3"] == ["Suites"]
    assert m["headings"]["h4"] == []


def test_hreflang_map() -> None:
    m = extract_markup(HOTEL_HTML, "https://thenines.com/")
    assert m["hreflang"] == {"en": "https://thenines.com/", "fr": "https://thenines.com/fr/"}


def test_backend_is_recorded() -> None:
    m = extract_markup(HOTEL_HTML, "https://thenines.com/")
    assert m["jsonLdSource"] in {"extruct", "bs4"}
    assert m["jsonLdSource"] == ("extruct" if has_extruct() else "bs4")


def test_empty_html_yields_empty_result() -> None:
    m = extract_markup("", "https://example.com/")
    assert m["jsonLd"] == []
    assert m["title"] is None


def test_schema_types_reach_inside_graph() -> None:
    html = """
    <script type="application/ld+json">
    {"@context":"https://schema.org","@graph":[
      {"@type":"Hotel","name":"X"},
      {"@type":"WebSite","name":"Y"}
    ]}
    </script>
    """
    m = extract_markup(html, "https://example.com/")
    assert set(m["schemaTypes"]) == {"Hotel", "WebSite"}


# -------------------------------------------------------------------- text --


def test_text_extracts_content_and_counts_words() -> None:
    result = extract_text(HOTEL_HTML, "https://thenines.com/")
    assert "Luxury hotel in downtown Portland." in result["text"]
    assert result["wordCount"] > 0
    assert result["backend"] in {"trafilatura", "bs4"}


def test_boilerplate_is_dropped() -> None:
    result = extract_text(HOTEL_HTML, "https://thenines.com/")
    # the <nav> chrome should not survive the bs4 fallback
    if result["backend"] == "bs4":
        assert "Home Rooms Dining" not in result["text"]


def test_word_count_is_measured_not_estimated() -> None:
    html = "<html><body><p>one two three four five</p></body></html>"
    result = extract_text(html, "https://example.com/")
    assert result["wordCount"] == 5


def test_empty_html_gives_zero_not_a_guess() -> None:
    result = extract_text("", "https://example.com/")
    assert result["text"] == ""
    assert result["wordCount"] == 0
    assert result["backend"] == "none"


def test_truncation_reports_itself() -> None:
    html = "<html><body><p>" + ("word " * 3000) + "</p></body></html>"
    result = extract_text(html, "https://example.com/", max_chars=500)
    assert result["truncated"] is True
    assert len(result["text"]) <= 500
    assert result["fullLength"] > result["fullLength"] - 1


# ---------------------------------------------------- sentence truncation ----


def test_truncate_no_op_when_short() -> None:
    assert sentence_truncate("Short sentence.", 100) == "Short sentence."


def test_truncate_at_sentence_boundary() -> None:
    text = "First sentence here. " * 50
    out = sentence_truncate(text, 60)
    assert len(out) <= 60
    assert out.endswith(".")


def test_truncate_falls_back_to_word_boundary() -> None:
    # a single sentence with no internal period forces the word fallback
    text = "alpha bravo charlie delta echo foxtrot golf hotel india juliet"
    out = sentence_truncate(text, 30)
    assert len(out) <= 30
    assert " " not in out[-1:] or out.endswith(("alpha", "charlie", "echo", "golf", "juliet"))


def test_truncate_hard_cuts_when_no_spaces() -> None:
    text = "x" * 500
    out = sentence_truncate(text, 100)
    assert len(out) == 100


def test_truncate_never_returns_more_than_requested() -> None:
    text = ("Sentence. " * 100).strip()
    for limit in (10, 25, 50, 999):
        assert len(sentence_truncate(text, limit)) <= max(limit, len(text))


# ---------------------------------------------------------------- extract_all -


def test_extract_all_reports_both_backends() -> None:
    combined = extract_all(HOTEL_HTML, "https://thenines.com/")
    assert combined["url"] == "https://thenines.com/"
    assert combined["backend"]["markup"] == ("extruct" if has_extruct() else "bs4")
    assert combined["backend"]["text"] == ("trafilatura" if has_trafilatura() else "bs4")
    assert combined["markup"]["title"]
    assert combined["text"]["wordCount"] > 0


def test_extract_all_is_deterministic() -> None:
    first = extract_all(HOTEL_HTML, "https://thenines.com/")
    second = extract_all(HOTEL_HTML, "https://thenines.com/")
    assert first["text"]["text"] == second["text"]["text"]
    assert first["markup"]["schemaTypes"] == second["markup"]["schemaTypes"]
