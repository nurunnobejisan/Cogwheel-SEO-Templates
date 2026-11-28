"""Unit and Integration Tests for Keyword Research & Page-Mapping Engine."""

import os
import tempfile
from pathlib import Path

import pytest
from python.crawler.site_mapper import DiscoveredPage, SiteInventory, SiteMapper
from python.generators.keyword_research import (
    KeywordCandidate,
    KeywordResearchEngine,
    run_keyword_research,
)


class TestSiteMapperArchetypes:
    """Verify archetype classification logic."""

    def test_classify_archetypes(self):
        mapper = SiteMapper("https://example-hotel.com", max_pages=10)

        assert mapper._classify_page_archetype("/", "Example Hotel Hotel", "Welcome", "") == "home"
        assert mapper._classify_page_archetype("/rooms", "Guest Rooms", "Our Rooms", "") == "category_overview"
        assert mapper._classify_page_archetype("/rooms/deluxe-king", "Deluxe King Room", "Deluxe King", "") == "product_or_room"
        assert mapper._classify_page_archetype("/amenities/spa", "Luxury Spa", "Spa & Wellness", "") == "service_or_amenity"
        assert mapper._classify_page_archetype("/dining/rooftop-bistro", "Rooftop Bistro", "Fine Dining", "") == "dining_or_outlet"
        assert mapper._classify_page_archetype("/weddings", "Weddings & Celebrations", "Host Your Wedding", "") == "events_or_offers"
        assert mapper._classify_page_archetype("/about-us", "Our History", "About the Hotel", "") == "about_or_history"
        assert mapper._classify_page_archetype("/faq", "Frequently Asked Questions", "FAQs", "") == "faq"
        assert mapper._classify_page_archetype("/gallery", "Photo Gallery", "Hotel Photos", "") == "gallery"
        assert mapper._classify_page_archetype("/blog/top-attractions", "City Guide", "Top Sights", "") == "blog"


class TestKeywordResearchEngine:
    """Verify clustering, de-cannibalization, and deliverable creation."""

    def test_csv_ingestion_and_aliases(self):
        with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False) as f:
            f.write("Search Term,Search Volume,Keyword Difficulty,Position,Intent\n")
            f.write("boutique hotel portland,4200,38,12,Commercial\n")
            f.write("portland luxury suites,1600,28,4,Transactional\n")
            f.write("best rooftop bar portland,2900,42,18,Commercial\n")
            temp_path = f.name

        try:
            engine = KeywordResearchEngine("https://test-hotel.com", csv_path=temp_path)
            kws = engine._parse_csv_keywords(temp_path)
            assert len(kws) == 3
            assert kws[0].keyword == "boutique hotel portland"
            assert kws[0].volume == 4200
            assert kws[0].kd == 38
            assert kws[0].current_position == 12
            assert kws[0].is_opportunity is True  # KD 38 < 45
        finally:
            os.remove(temp_path)

    def test_seed_expansion_fallback(self):
        engine = KeywordResearchEngine("https://example-hotel.com")
        engine.inventory = SiteInventory(
            domain="example-hotel.com",
            target_url="https://example-hotel.com",
            brand_name="Example Hotel Hotel",
            primary_location="Charleston, SC",
            core_offerings=["Oceanfront Suites", "Rooftop Dining"],
            pages=[
                DiscoveredPage(url="https://example-hotel.com/", path="/", title="Home", archetype="home"),
                DiscoveredPage(url="https://example-hotel.com/rooms", path="/rooms", title="Rooms", archetype="category_overview"),
                DiscoveredPage(url="https://example-hotel.com/dining", path="/dining", title="Dining", archetype="dining_or_outlet"),
            ],
            total_pages_found=3,
        )

        kws = engine._generate_seed_expansion_keywords()
        assert len(kws) >= 20
        # Check brand and city presence
        assert any("grand palace hotel" in k.keyword.lower() for k in kws)
        assert any("charleston" in k.keyword.lower() for k in kws)
        # Check opportunity flagging
        assert any(k.is_opportunity for k in kws)

    def test_de_cannibalization_and_output(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            engine = KeywordResearchEngine(
                "https://example-hotel.com",
                output_base_dir=tmp_dir,
            )
            engine.inventory = SiteInventory(
                domain="example-hotel.com",
                target_url="https://example-hotel.com",
                brand_name="Example Hotel Hotel",
                primary_location="Charleston, SC",
                core_offerings=["Luxury Suites", "Fine Dining"],
                pages=[
                    DiscoveredPage(url="https://example-hotel.com/", path="/", title="Example Hotel Hotel Home", archetype="home"),
                    DiscoveredPage(url="https://example-hotel.com/accommodations", path="/accommodations", title="Suites & Rooms", archetype="category_overview"),
                    DiscoveredPage(url="https://example-hotel.com/dining", path="/dining", title="Rooftop Restaurant & Bar", archetype="dining_or_outlet"),
                    DiscoveredPage(url="https://example-hotel.com/weddings", path="/weddings", title="Weddings & Receptions", archetype="events_or_offers"),
                ],
                total_pages_found=4,
            )

            engine.all_keywords = engine._generate_seed_expansion_keywords()
            buckets = engine.cluster_into_buckets()
            assert len(buckets) > 0

            assignments = engine.assign_keywords_to_pages()
            assert len(assignments) == 4

            # Verify every page has a unique primary keyword (no cannibalization)
            assigned_kws = [a.primary_keyword.lower() for a in assignments]
            assert len(assigned_kws) == len(set(assigned_kws))

            # Verify rationales cite SV and KD
            for a in assignments:
                assert f"{a.volume:,}" in a.rationale
                assert f"KD {a.kd}" in a.rationale
                assert a.archetype in a.rationale

            # Verify files are generated
            docx_path = engine.generate_docx_report()
            json_path = engine.generate_json_map()

            assert docx_path.exists()
            assert json_path.exists()
            assert docx_path.stat().st_size > 5000  # valid docx file

            # Check JSON contents
            import json
            with open(json_path, encoding="utf-8") as jf:
                data = json.load(jf)
                assert data["domain"] == "example-hotel.com"
                assert len(data["pages"]) == 4
                assert "summary" in data
                assert data["summary"]["high_opportunity_threshold_kd"] == 45
