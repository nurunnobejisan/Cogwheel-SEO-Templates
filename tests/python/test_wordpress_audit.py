"""Unit tests for the measured WordPress audit helper."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from api import wordpress_audit  # noqa: E402


def test_page_facts_read_only_present_html():
    html = (
        "<html><head><title>Measured title</title>"
        '<meta name="description" content="Description">'
        '<script type="application/ld+json">{"@type":"FAQPage"}</script>'
        "</head><body><h1>One</h1><h1>Two</h1>"
        '<img src="a.png"><img src="b.png" alt=""></body></html>'
    )
    facts = wordpress_audit.page_facts(html)
    assert facts["title"] == "Measured title"
    assert facts["meta_desc"] == "Description"
    assert facts["h1_count"] == 2
    assert facts["images_without_alt"] == 2
    assert facts["has_faq_schema"] is True
    assert facts["has_lodging_schema"] is False
    assert facts["has_canonical"] is False
    assert facts["has_og"] is False


def test_page_facts_empty_html_does_not_invent_values():
    facts = wordpress_audit.page_facts("<html><body></body></html>")
    assert facts["title"] == ""
    assert facts["h1_count"] == 0
    assert facts["words"] == 0
    assert facts["has_canonical"] is False


def test_measure_uses_injected_fetch():
    seen = []

    def fetch(url):
        seen.append(url)
        return "<html><head><title>x</title></head><body>words here</body></html>"

    result = wordpress_audit.measure("https://example.com/post", fetch=fetch)
    assert seen == ["https://example.com/post"]
    assert result["status"] == "measured"
    assert isinstance(result["score"], int)


def test_measure_failure_is_explicitly_unmeasured():
    def refuse(_url):
        raise RuntimeError("ssrf guard refused")

    result = wordpress_audit.measure("https://example.com/post", fetch=refuse)
    assert result["status"] == "not_measured"
    assert result["score"] is None
    assert "ssrf guard refused" in result["reason"]
