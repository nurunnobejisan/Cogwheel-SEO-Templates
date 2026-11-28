"""Unit and Integration Tests for Image SEO Optimization and Unified Runner."""

import json
import os
import tempfile
from pathlib import Path

import openpyxl
import pytest

from python.seo_studio_auto import SeoStudioAutoRunner
from python.generators.image_optimizer import (
    ImageAssetRecord,
    ImageOptimizer,
    run_image_optimizer,
)


class TestImageOptimizationRules:
    """Verify raw filename detection and context-grounded ALT text synthesis."""

    def test_detect_raw_camera_and_hash_filenames(self):
        raw_samples = [
            "DSC00177.jpg",
            "DSC_4921.png",
            "IMG_9482.jpeg",
            "P1090234.webp",
            "image+244.avif",
            "a8f9b2c3d4e5f6a7b8c9d0e1f2.jpg",
            "123e4567-e89b-12d3-a456-426614174000.png",
        ]
        for f in raw_samples:
            assert ImageOptimizer.is_raw_or_hash_name(f), f"Expected {f} to be detected as raw/hash filename"

        legit_samples = [
            "luxury-hotel-exterior-entrance.jpg",
            "downtown-portland-dining-patio.webp",
            "corner-suite-bedroom-view.avif",
        ]
        for f in legit_samples:
            assert not ImageOptimizer.is_raw_or_hash_name(f), f"Expected {f} to NOT be detected as raw filename"

    def test_alt_text_length_and_filler_removal(self):
        optimizer = ImageOptimizer("https://example-hotel.com")
        optimizer.brand_name = "Example Hotel"
        optimizer.location = "Portland, OR"

        # Case 1: Existing alt with filler words like 'Photo of'
        alt1, subject1 = optimizer.generate_optimized_alt(
            raw_url="https://example-hotel.com/images/lobby.jpg",
            existing_alt="Photo of our beautiful modern lobby artwork",
            section_heading="Curated Contemporary Art",
            page_topic="Art Collection",
            brand_name="Example Hotel",
            city="Portland",
        )
        assert not alt1.lower().startswith("photo of")
        assert not alt1.lower().startswith("image of")
        assert len(alt1) <= 125
        assert len(alt1) >= 40
        assert "Example Hotel" in alt1
        assert "Portland" in alt1

        # Case 2: Opaque filename with only section heading cues
        alt2, subject2 = optimizer.generate_optimized_alt(
            raw_url="https://example-hotel.com/assets/DSC00177.jpg",
            existing_alt="",
            section_heading="The Steakhouse",
            page_topic="Signature Dining",
            brand_name="Example Hotel",
            city="Portland",
        )
        assert len(alt2) <= 125
        assert "The Steakhouse" in alt2
        assert "Example Hotel" in alt2


class TestImageWorkbookAndDeliverables:
    """Verify Excel workbook, dynamic =LEN() formulas, and extension bundle consolidation."""

    def test_image_workbook_and_json(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            optimizer = ImageOptimizer("https://example-hotel.com", output_base_dir=tmp_dir)
            optimizer.brand_name = "Example Hotel"
            optimizer.location = "Portland, OR"

            custom_pages = [
                {
                    "url": "https://example-hotel.com/",
                    "path": "/",
                    "title": "Luxury Hotel in Downtown Portland",
                    "archetype": "home",
                    "images": [
                        {
                            "src": "https://example-hotel.com/images/entrance.jpg",
                            "alt": "",
                            "title": "Hotel Exterior & Entrance",
                            "section_heading": "Distinctive Luxury in Downtown",
                        },
                        {
                            "src": "https://example-hotel.com/assets/DSC00177.jpg",
                            "alt": "hotel",
                            "title": "DSC00177",
                            "section_heading": "Elevated Dining Experiences",
                        },
                    ],
                }
            ]

            records = optimizer.audit_all_images(custom_pages)
            assert len(records) == 2

            xlsx_path = optimizer.generate_excel_workbook()
            json_path = optimizer.export_downstream_json()

            assert xlsx_path.exists()
            assert json_path.exists()

            # Verify Excel Workbook Structure
            wb = openpyxl.load_workbook(xlsx_path)
            assert "Instructions" in wb.sheetnames
            assert "Image Optimization" in wb.sheetnames

            ws2 = wb["Image Optimization"]
            # Exact 6 Columns
            headers = [ws2.cell(row=1, column=c).value for c in range(1, 7)]
            assert headers == ["Image", "URL", "Title", "Length", "Optimized ALT Text", "Length"]

            # Dynamic =LEN() formulas
            assert ws2.cell(row=2, column=4).value == "=LEN(C2)"
            assert ws2.cell(row=2, column=6).value == "=LEN(E2)"

            # Hyperlink in Col A
            assert '=HYPERLINK("https://example-hotel.com/images/entrance.jpg"' in ws2.cell(row=2, column=1).value

            # Soft green fill (#D9EAD3) on Col E
            fill_e = ws2.cell(row=2, column=5).fill.start_color.rgb
            assert fill_e in ["00D9EAD3", "D9EAD3"]

            # Verify JSON Export
            with open(json_path, encoding="utf-8") as jf:
                data = json.load(jf)
                assert data["domain"] == "example-hotel.com"
                assert data["total_images_audited"] == 2
                assert data["missing_alts_count"] == 1
                assert data["raw_filenames_count"] == 1

    def test_unified_bundle_builder(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            base = Path(tmp_dir)
            domain_dir = base / "example-hotel.com"
            domain_dir.mkdir(parents=True, exist_ok=True)

            # Create mock sub-deliverable JSONs
            kw_map = {
                "domain": "example-hotel.com",
                "brand_name": "Example Hotel",
                "primary_location": "Portland, OR",
                "summary": {"total_opportunity_keywords": 4},
                "pages": [
                    {
                        "page_id": "p1",
                        "url": "https://example-hotel.com/",
                        "path": "/",
                        "archetype": "home",
                        "primary_keyword": "Example Hotel Portland",
                        "title": "Old Home Title",
                    }
                ],
            }
            with open(domain_dir / "site-keyword-map.json", "w") as f:
                json.dump(kw_map, f)

            meta_map = {
                "pages": [
                    {
                        "url": "https://example-hotel.com/",
                        "old_title": "Old Home Title",
                        "new_title": "Example Hotel Portland | Example Hotel",
                        "new_title_len": 30,
                        "old_meta": "",
                        "new_meta": "Experience example hotel portland at Example Hotel in downtown Portland. Book direct.",
                        "new_meta_len": 77,
                    }
                ]
            }
            with open(domain_dir / "site-meta-optimized.json", "w") as f:
                json.dump(meta_map, f)

            heading_map = {
                "total_headings_processed": 5,
                "pages": [
                    {
                        "url": "https://example-hotel.com/",
                        "health_score": 85,
                        "headings": [
                            {
                                "old_headline": "Old H1",
                                "old_level": "H1",
                                "new_headline": "Example Hotel Portland | Luxury Hotel",
                                "new_level": "H1",
                                "change_type": "rewrite_h1",
                            }
                        ],
                    }
                ],
            }
            with open(domain_dir / "site-heading-optimized.json", "w") as f:
                json.dump(heading_map, f)

            image_map = {
                "total_images_audited": 1,
                "images": [
                    {
                        "image_url": "https://example-hotel.com/entrance.jpg",
                        "title": "Entrance",
                        "old_alt": "",
                        "optimized_alt": "Hotel Entrance at Example Hotel in Portland",
                        "optimized_alt_length": 39,
                        "page_urls": ["https://example-hotel.com/"],
                    }
                ],
            }
            with open(domain_dir / "site-images-optimized.json", "w") as f:
                json.dump(image_map, f)

            runner = SeoStudioAutoRunner("https://example-hotel.com", output_dir=tmp_dir)
            bundle_path = runner.build_extension_bundle(
                kw_map_path=domain_dir / "site-keyword-map.json",
                meta_json_path=domain_dir / "site-meta-optimized.json",
                heading_json_path=domain_dir / "site-heading-optimized.json",
                image_json_path=domain_dir / "site-images-optimized.json",
            )

            assert bundle_path.exists()
            with open(bundle_path, encoding="utf-8") as bf:
                bundle = json.load(bf)
                assert bundle["domain"] == "example-hotel.com"
                assert bundle["bundle_version"] == "3.0.0"
                assert len(bundle["pages"]) == 1
                page = bundle["pages"][0]
                assert page["new_title"] == "Example Hotel Portland | Example Hotel"
                assert page["new_meta_description"].startswith("Experience")
                assert len(page["headings"]) == 1
                assert len(page["images"]) == 1
                assert page["images"][0]["optimized_alt"] == "Hotel Entrance at Example Hotel in Portland"
