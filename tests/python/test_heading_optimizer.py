"""Unit and Integration Tests for Heading Structure Optimization Engine."""

import json
import os
import tempfile
from pathlib import Path

import openpyxl
import pytest

from python.generators.heading_optimizer import (
    HeadingItem,
    HeadingOptimizer,
    PageHeadingAudit,
    run_heading_optimizer,
)


class TestHeadingDetectionRules:
    """Verify non-semantic heading detection, single H1 rule, and hierarchy repair."""

    def test_detect_non_semantic_stat_counters(self):
        stat_samples = [
            "331 Guest Rooms",
            "14,000 Sq Ft Event Space",
            "150+ Rooms",
            "Guest Rooms",
            "Largest Venue",
            "Total Meeting Space",
            "Square Feet",
        ]
        for s in stat_samples:
            res = HeadingOptimizer.detect_non_semantic(s)
            assert res is not None, f"Failed to detect stat counter: {s}"
            issue, _ = res
            assert issue == "non_semantic_stat"

    def test_detect_non_semantic_bed_and_view_badges(self):
        badge_samples = [
            "1 King Bed",
            "2 Queen Beds",
            "City View",
            "Mountain View",
            "Accessible",
            "Pet-Friendly",
            "Non-Smoking",
        ]
        for b in badge_samples:
            res = HeadingOptimizer.detect_non_semantic(b)
            assert res is not None, f"Failed to detect badge: {b}"
            issue, _ = res
            assert issue == "non_semantic_badge"

    def test_detect_non_semantic_quotes_and_testimonials(self):
        quote_samples = [
            '"The best hotel experience in downtown Portland."',
            "What Our Guests Say",
            "Guest Reviews",
            "Traveler Ratings",
            "Verified Guest",
        ]
        for q in quote_samples:
            res = HeadingOptimizer.detect_non_semantic(q)
            assert res is not None, f"Failed to detect testimonial: {q}"
            issue, _ = res
            assert issue == "non_semantic_quote"

    def test_detect_non_semantic_footer_headers(self):
        footer_samples = [
            "Explore",
            "Reach Us",
            "Quick Links",
            "Stay Connected",
            "Navigation",
            "Follow Us",
            "Legal",
            "Privacy & Cookies",
            "Careers",
        ]
        for f in footer_samples:
            res = HeadingOptimizer.detect_non_semantic(f)
            assert res is not None, f"Failed to detect footer header: {f}"
            issue, _ = res
            assert issue == "non_semantic_footer"

    def test_legitimate_headings_pass(self):
        legit_samples = [
            "Luxury Accommodations & Suites",
            "Downtown Portland Dining & Cocktails",
            "Curated Art Collection",
            "Historic Heritage",
            "Hotel Amenities in Portland",
        ]
        for h in legit_samples:
            assert HeadingOptimizer.detect_non_semantic(h) is None


class TestHeadingAuditAndOptimization:
    """Verify single page audit and rewrite rules."""

    @pytest.fixture
    def optimizer(self):
        return HeadingOptimizer("https://example-hotel.com")

    def test_single_h1_rule_and_duplicate_demotion(self, optimizer):
        """Page with multiple H1s must keep canonical H1 and demote sibling H1 to H2."""
        raw_headings = [
            ("H1", "WELCOME TO EXAMPLE HOTEL"),
            ("H1", "LUXURY HOTEL IN PORTLAND"),
            ("H2", "EXPERIENCE LUXURY"),
            ("H2", "331 Guest Rooms"),
            ("H2", "Explore"),
        ]

        audit = optimizer.audit_and_optimize_page(
            page_url="https://example-hotel.com/",
            keyword="Example Hotel Portland",
            category="HOME",
            raw_headings=raw_headings,
            brand_name="Example Hotel",
            location="Portland, OR",
            page_title="Luxury Hotel in Downtown Portland | Example Hotel",
        )

        assert audit.h1_count_before == 2
        assert audit.h1_count_after == 1
        assert "multiple_h1" in audit.issues_found
        assert "non_semantic_stat" in audit.issues_found
        assert "non_semantic_footer" in audit.issues_found

        h1_items = [h for h in audit.headings if h.new_level == "H1"]
        assert len(h1_items) == 1
        assert "Example Hotel Portland" in h1_items[0].new_headline

        # Check sibling H1 demotion
        demoted_h1 = [h for h in audit.headings if h.old_level == "H1" and h.new_level == "H2"]
        assert len(demoted_h1) == 1
        assert demoted_h1[0].change_type == "convert_h1_to_h2"

        # Check stat counter demotion to TEXT
        demoted_stat = [h for h in audit.headings if h.old_headline == "331 Guest Rooms"]
        assert len(demoted_stat) == 1
        assert demoted_stat[0].new_level == "TEXT"

    def test_inverted_hierarchy_and_skipped_levels(self, optimizer):
        """Inverted H2 before H1 is demoted, and skipped H3 is promoted to H2."""
        raw_headings = [
            ("H2", "OVERVIEW"),              # Inverted H2 above H1
            ("H1", "GUEST ROOMS & SUITES"),  # Canonical H1
            ("H3", "Deluxe King Room"),      # Skipped level (H1 -> H3)
            ("H3", "1 King Bed"),            # Non-semantic badge
        ]

        audit = optimizer.audit_and_optimize_page(
            page_url="https://example-hotel.com/rooms",
            keyword="Portland Hotel Rooms",
            category="PRODUCTS / ROOMS",
            raw_headings=raw_headings,
            brand_name="Example Hotel",
            location="Portland, OR",
            page_title="Guest Rooms & Suites | Example Hotel",
        )

        assert "inverted_hierarchy" in audit.issues_found
        assert "skipped_level" in audit.issues_found
        assert "non_semantic_badge" in audit.issues_found

        # Check inverted H2 demoted to TEXT
        pre_h1 = [h for h in audit.headings if h.old_headline == "OVERVIEW"]
        assert len(pre_h1) == 1
        assert pre_h1[0].new_level == "TEXT"

        # Check skipped H3 promoted to H2
        promoted_h3 = [h for h in audit.headings if h.old_headline == "Deluxe King Room"]
        assert len(promoted_h3) == 1
        assert promoted_h3[0].new_level == "H2"
        assert promoted_h3[0].change_type == "promote_to_h2"

        # Check badge demoted to TEXT
        badge = [h for h in audit.headings if h.old_headline == "1 King Bed"]
        assert len(badge) == 1
        assert badge[0].new_level == "TEXT"


class TestHeadingWorkbookAndJsonDeliverables:
    """Verify OpenPyXL styled workbook generation and JSON export."""

    def test_full_pipeline_workbook_and_json(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            optimizer = HeadingOptimizer("https://example-hotel.com", output_base_dir=tmp_dir)
            optimizer.brand_name = "Example Hotel"
            optimizer.location = "Portland, OR"

            custom_pages = [
                {
                    "url": "https://example-hotel.com/",
                    "path": "/",
                    "title": "Luxury Hotel in Downtown Portland",
                    "archetype": "home",
                    "primary_keyword": "Example Hotel Portland",
                    "raw_headings": [
                        ("H1", "WELCOME TO EXAMPLE HOTEL"),
                        ("H1", "PORTLAND BOUTIQUE HOTEL"),
                        ("H2", "OUR LUXURY AMENITIES"),
                        ("H2", "331 Guest Rooms"),
                        ("H2", "Explore"),
                    ],
                },
                {
                    "url": "https://example-hotel.com/amenities",
                    "path": "/amenities",
                    "title": "Hotel Amenities",
                    "archetype": "service_or_amenity",
                    "primary_keyword": "Amenities in Portland",
                    "raw_headings": [
                        ("H1", "Hotel Amenities"),
                        ("H2", "Fitness Studio"),
                        ("H2", "What Our Guests Say"),
                        ("H2", "Reach Us"),
                    ],
                },
            ]

            audits = optimizer.optimize_all(custom_pages)
            assert len(audits) == 2

            xlsx_path = optimizer.generate_excel_workbook()
            json_path = optimizer.export_downstream_json()

            assert xlsx_path.exists()
            assert json_path.exists()

            # Verify Excel Workbook Structure
            wb = openpyxl.load_workbook(xlsx_path)
            assert "Instructions" in wb.sheetnames
            assert "Heading Structure Optimization" in wb.sheetnames

            ws2 = wb["Heading Structure Optimization"]
            # Verify 6 exact headers
            headers = [ws2.cell(row=1, column=c).value for c in range(1, 7)]
            expected_headers = [
                "Page URL",
                "Keyword",
                "Old Headline",
                "Old Heading Level",
                "New Headline (optimized)",
                "New Heading Level",
            ]
            assert headers == expected_headers

            # Verify Category banner rows exist
            banner_found = False
            for r in range(2, ws2.max_row + 1):
                val = str(ws2.cell(row=r, column=1).value or "")
                if "CATEGORY:" in val:
                    banner_found = True
                    break
            assert banner_found, "Expected category grouping banner row in Excel workbook"

            # Verify JSON deliverable
            with open(json_path, encoding="utf-8") as jf:
                data = json.load(jf)
                assert data["domain"] == "example-hotel.com"
                assert data["total_pages_audited"] == 2
                assert len(data["pages"]) == 2
                assert data["pages"][0]["h1_count_after"] == 1
                assert "excel_deliverable" in data
