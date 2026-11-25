"""Unit and Integration Tests for Title & Meta Description Generator."""

import json
import os
import tempfile
from pathlib import Path

import openpyxl
import pytest

from python.crawler.site_mapper import DiscoveredPage, SiteInventory
from python.generators.keyword_research import PageAssignment
from python.generators.meta_optimizer import (
    MetaOptimizer,
    OptimizedMetaRow,
    run_meta_optimizer,
)


class TestMetaRulesAndRepair:
    """Verify Cogwheel's title & meta description constraints and repair loops."""

    @pytest.fixture
    def sample_optimizer(self):
        opt = MetaOptimizer("https://theoxfordhotel.com")
        opt.brand_name = "The Oxford Hotel"
        opt.location = "Bend, Oregon"
        return opt

    def test_title_first_half_placement_and_length(self, sample_optimizer):
        """Title must place Keyword Focus in first half, append brand, and stay <= 60 chars."""
        # Short keyword
        title = sample_optimizer.generate_title(
            keyword_focus="Boutique Hotel Bend",
            page_name="Home",
            archetype="home",
        )
        assert len(title) <= 60
        assert title.lower().startswith("boutique hotel bend")
        assert "The Oxford Hotel" in title

        # Long keyword that tests the deterministic repair loop
        long_kw = "Best Pet Friendly Boutique Hotels in Downtown Bend Oregon"
        repaired_title = sample_optimizer.generate_title(
            keyword_focus=long_kw,
            page_name="Pet Friendly Suites",
            archetype="product_or_room",
        )
        assert len(repaired_title) <= 60
        # Must not truncate mid-word
        assert not repaired_title.endswith(" ")
        last_word = repaired_title.split()[-1]
        assert not any(char in last_word for char in ["...", ".."])

    def test_meta_description_length_and_cta(self, sample_optimizer):
        """Meta description must target 145-160 chars (<= 160 hard cap), include keyword, and end with CTA."""
        page = DiscoveredPage(
            url="https://theoxfordhotel.com/amenities",
            path="/amenities",
            title="Oxford Hotel Amenities",
            archetype="service_or_amenity",
            meta_description="Standard hotel amenities.",
            topics=["organic dining", "complimentary cruiser bikes", "downtown location"],
        )

        meta, usps, cta = sample_optimizer.generate_meta_description(
            keyword_focus="hotel amenities in Bend OR",
            page=page,
        )
        assert len(meta) <= 160
        assert len(meta) >= 130  # Strong target near 145-160
        assert "hotel amenities in bend or" in meta.lower()
        # Must end with a valid CTA phrase
        assert any(
            meta.endswith(c) or meta.endswith(f"{c}.")
            for c in [
                "Book direct for best rates.",
                "Explore amenities and plan your visit.",
                "Reserve your stay today.",
                "Plan your trip today.",
                "Explore options.",
                "Book direct.",
            ]
        )

    def test_meta_repair_loop_tightens_long_content(self, sample_optimizer):
        """Excessive meta description is deterministically tightened under 160 chars without mid-word cuts."""
        excessive_meta = (
            "Experience exceptional luxury hotel Bend at The Oxford Hotel located right in the heart "
            "of downtown Bend Oregon with complimentary cruiser bikes, artisanal organic dining, and deluxe pet friendly rooms. "
            "Book direct for best rates guaranteed today."
        )
        assert len(excessive_meta) > 160

        tightened = sample_optimizer._repair_meta_length(
            meta=excessive_meta,
            keyword="luxury hotel Bend",
            cta="Book direct for best rates.",
        )
        assert len(tightened) <= 160
        assert "luxury hotel bend" in tightened.lower()
        assert not tightened.endswith("...")
        assert tightened.endswith(".")


class TestMetaWorkbookAndJsonDeliverables:
    """Verify OpenPyXL styled workbook generation and JSON export."""

    def test_full_pipeline_workbook_and_json(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            optimizer = MetaOptimizer("https://theoxfordhotel.com", output_base_dir=tmp_dir)
            optimizer.brand_name = "The Oxford Hotel"
            optimizer.location = "Bend, OR"

            # Mock pages and assignments
            pages = [
                DiscoveredPage(
                    url="https://theoxfordhotel.com/",
                    path="/",
                    title="Old Home Title",
                    archetype="home",
                    meta_description="Old home meta description that was too brief.",
                    topics=["boutique suites", "eco-friendly luxury"],
                ),
                DiscoveredPage(
                    url="https://theoxfordhotel.com/dining",
                    path="/dining",
                    title="Old Dining Title",
                    archetype="dining_or_outlet",
                    meta_description="Old dining description.",
                    topics=["organic kitchen", "cocktails"],
                ),
            ]
            assignments = [
                PageAssignment(
                    page_id="theoxfordhotel.com-1",
                    url="https://theoxfordhotel.com/",
                    path="/",
                    title="Old Home Title",
                    archetype="home",
                    primary_keyword="Boutique Hotel Bend OR",
                    volume=3200,
                    kd=34,
                    intent="Commercial",
                    rationale="High volume primary intent.",
                ),
                PageAssignment(
                    page_id="theoxfordhotel.com-2",
                    url="https://theoxfordhotel.com/dining",
                    path="/dining",
                    title="Old Dining Title",
                    archetype="dining_or_outlet",
                    primary_keyword="Downtown Bend Restaurant",
                    volume=1800,
                    kd=29,
                    intent="Commercial",
                    rationale="Direct dining target.",
                ),
            ]

            optimizer.optimize_all(pages, assignments)
            assert len(optimizer.optimized_rows) == 2

            xlsx_path = optimizer.generate_excel_workbook()
            json_path = optimizer.export_downstream_json()

            assert xlsx_path.exists()
            assert json_path.exists()

            # Load and verify Excel sheet structure
            wb = openpyxl.load_workbook(xlsx_path)
            assert "Instructions" in wb.sheetnames
            # Tab 2 exists
            ws2 = wb[wb.sheetnames[1]]
            assert ws2.title == "Title & Meta Descriptions for Proofing"

            # Verify Tab 2 Headers (Exact 11 columns)
            headers = [ws2.cell(row=1, column=c).value for c in range(1, 12)]
            expected_headers = [
                "Pages",
                "Url",
                "Keyword Focus",
                "Old Title",
                "Length",
                "New Title",
                "Length",
                "Old Meta Description",
                "Length",
                "New Meta Description",
                "Length",
            ]
            assert headers == expected_headers

            # Verify row 2 data and formulas
            row2_new_title = ws2.cell(row=2, column=6).value
            assert len(row2_new_title) <= 60
            # Formula in Column E: =LEN(D2)
            assert ws2.cell(row=2, column=5).value == "=LEN(D2)"
            # Formula in Column G: =LEN(F2)
            assert ws2.cell(row=2, column=7).value == "=LEN(F2)"
            # Formula in Column I: =LEN(H2)
            assert ws2.cell(row=2, column=9).value == "=LEN(H2)"
            # Formula in Column K: =LEN(J2)
            assert ws2.cell(row=2, column=11).value == "=LEN(J2)"

            # Verify soft green fill (#D9EAD3) on New Title (F) and New Meta (J)
            fill_f = ws2.cell(row=2, column=6).fill.start_color.rgb
            fill_j = ws2.cell(row=2, column=10).fill.start_color.rgb
            assert fill_f in ["00D9EAD3", "D9EAD3"]
            assert fill_j in ["00D9EAD3", "D9EAD3"]

            # Verify conditional formatting rules exist on sheet
            cf_rules = list(ws2.conditional_formatting)
            assert len(cf_rules) >= 2  # Rule for column G (>60) and column K (>160)

            # Verify JSON Export content
            with open(json_path, encoding="utf-8") as f:
                data = json.load(f)
                assert data["domain"] == "theoxfordhotel.com"
                assert len(data["pages"]) == 2
                assert data["pages"][0]["keyword_focus"] == "Boutique Hotel Bend OR"
                assert data["pages"][0]["title_length"] <= 60
                assert data["pages"][0]["meta_length"] <= 160
