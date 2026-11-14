"""Tests for Content Engine & Similarity Scorer in api/content_engine.py"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from api.content_engine import (
    clean_text,
    count_words,
    calculate_jaccard_similarity,
    batch_similarity_audit,
    generate_internal_link_graph
)


def test_clean_text_and_count():
    html = "<h1>Denver Hotel</h1><p>Luxury suites with mountain views.</p>"
    cleaned = clean_text(html)
    assert "h1" not in cleaned
    assert count_words(html) == 7


def test_jaccard_similarity_calculation():
    text1 = "luxury boutique hotel in downtown denver colorado with rooftop pool"
    text2 = "luxury boutique hotel in downtown denver colorado with rooftop patio"
    text3 = "beachfront cabana in miami florida"

    sim12 = calculate_jaccard_similarity(text1, text2)
    sim13 = calculate_jaccard_similarity(text1, text3)

    assert sim12 > 0.4
    assert sim13 == 0.0


def test_batch_similarity_audit_blocks_duplicates():
    base = "The Curtis Denver provides pop culture themed guest rooms with retro arcade games and dining. " * 30
    clone = base + "Book online."

    pages = [
        {"id": "page-1", "url": "https://example.com/1/", "content": base},
        {"id": "page-2", "url": "https://example.com/2/", "content": clone},
        {"id": "page-thin", "url": "https://example.com/thin/", "content": "Thin content."}
    ]

    audit = batch_similarity_audit(pages, max_similarity=0.70, min_words=100)
    assert not audit["all_passed"]

    page1_res = next(r for r in audit["results"] if r["id"] == "page-1")
    assert page1_res["is_duplicate_blocked"] is True

    thin_res = next(r for r in audit["results"] if r["id"] == "page-thin")
    assert thin_res["is_thin_content"] is True


def test_internal_link_graph_generation():
    manifest = [
        {
            "url": "https://example.com/denver/",
            "primaryKeyword": "Denver Hub",
            "categoryHierarchy": ["Denver"]
        },
        {
            "url": "https://example.com/denver/suites/",
            "primaryKeyword": "Luxury Suites",
            "parentPage": "https://example.com/denver/",
            "categoryHierarchy": ["Denver", "Suites"]
        }
    ]

    graph_res = generate_internal_link_graph(manifest)
    assert graph_res["totalPages"] == 2
    hub_links = graph_res["graph"]["https://example.com/denver/"]
    assert len(hub_links) == 1
    assert hub_links[0]["targetUrl"] == "https://example.com/denver/suites/"
    assert hub_links[0]["relationship"] == "child"


if __name__ == "__main__":
    test_clean_text_and_count()
    test_jaccard_similarity_calculation()
    test_batch_similarity_audit_blocks_duplicates()
    test_internal_link_graph_generation()
    print("All Content Engine tests passed successfully!")
