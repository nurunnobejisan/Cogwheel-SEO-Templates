"""Unified Any-Website SEO Automation Runner.

Executes Cogwheel's complete 4-command agency workflow in a single CLI command:
1. Crawl & Discovery (site_mapper.py)
2. Keyword Research & Thematic Clustering (keyword_research.py -> 01-keyword-research-report.docx)
3. Meta Title & Description Optimizer (meta_optimizer.py -> 02-meta-title-description.xlsx)
4. Heading Structure Optimization (heading_optimizer.py -> 03-heading-structure-optimization.xlsx)
5. Image SEO & Accessibility Optimization (image_optimizer.py -> 04-image-optimization.xlsx)
6. Consolidates everything into /output/<domain>/extension-bundle.json for 1-click Chrome Extension CMS Auto-Fill.

Usage:
  python -m cogwheel_auto --url <website_url> [--keywords-csv path/to/kw.csv] [--max-pages 35]
"""

from __future__ import annotations

import argparse
import datetime
import json
import logging
import os
import sys
import urllib.parse
from pathlib import Path
from typing import Any, Dict, List, Optional

from python.generators.heading_optimizer import HeadingOptimizer
from python.generators.image_optimizer import ImageOptimizer
from python.generators.keyword_research import KeywordResearchEngine
from python.generators.meta_optimizer import MetaOptimizer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("CogwheelAuto")


class CogwheelAutoRunner:
    """Unified Orchestration Pipeline for Any Website URL."""

    def __init__(
        self,
        url: str,
        keywords_csv: Optional[str] = None,
        max_pages: int = 35,
        output_dir: str = "output",
    ):
        self.target_url = url.strip()
        if not self.target_url.startswith(("http://", "https://")):
            self.target_url = f"https://{self.target_url}"

        parsed = urllib.parse.urlparse(self.target_url)
        self.domain = parsed.hostname.replace("www.", "") if parsed.hostname else "target.com"

        self.keywords_csv = keywords_csv
        self.max_pages = max_pages
        self.output_base_dir = output_dir
        self.domain_output_dir = Path(self.output_base_dir) / self.domain
        self.domain_output_dir.mkdir(parents=True, exist_ok=True)

    def run_all(self) -> Dict[str, Any]:
        """Execute all four generators and produce the final Chrome Extension bundle."""
        start_time = datetime.datetime.now()
        logger.info("============================================================")
        logger.info("STARTING UNIFIED COGWHEEL AUTOMATION PIPELINE")
        logger.info("Target: %s | Domain: %s", self.target_url, self.domain)
        logger.info("============================================================")

        # -------------------------------------------------------------------
        # Step 1: Keyword Research & Page-Mapping Engine
        # -------------------------------------------------------------------
        logger.info("\n>>> STEP 1: Running Keyword Research & Page-Mapping Engine...")
        kr_engine = KeywordResearchEngine(
            target_url=self.target_url,
            csv_path=self.keywords_csv,
            max_crawl_pages=self.max_pages,
            output_base_dir=self.output_base_dir,
        )
        kr_results = kr_engine.execute()
        docx_path = kr_results.get("report_file")
        kw_map_path = self.domain_output_dir / "site-keyword-map.json"

        # -------------------------------------------------------------------
        # Step 2: Meta Title & Description Optimizer
        # -------------------------------------------------------------------
        logger.info("\n>>> STEP 2: Running Meta Title & Description Optimizer...")
        meta_engine = MetaOptimizer(
            domain_or_url=self.target_url,
            map_json_path=str(kw_map_path),
            output_base_dir=self.output_base_dir,
        )
        meta_results = meta_engine.execute()
        meta_xlsx_path = meta_results.get("excel_deliverable") or meta_results.get("xlsx_path") or str(self.domain_output_dir / "02-meta-title-description.xlsx")
        meta_json_path = meta_results.get("json_deliverable") or meta_results.get("json_path") or str(self.domain_output_dir / "site-meta-optimized.json")

        # -------------------------------------------------------------------
        # Step 3: Heading Structure Optimization
        # -------------------------------------------------------------------
        logger.info("\n>>> STEP 3: Running Heading Structure Optimizer...")
        heading_engine = HeadingOptimizer(
            domain_or_url=self.target_url,
            keyword_map_path=str(kw_map_path),
            output_base_dir=self.output_base_dir,
        )
        heading_results = heading_engine.execute()
        heading_xlsx_path = heading_results.get("excel_deliverable") or heading_results.get("xlsx_path") or str(self.domain_output_dir / "03-heading-structure-optimization.xlsx")
        heading_json_path = heading_results.get("json_deliverable") or heading_results.get("json_path") or str(self.domain_output_dir / "site-heading-optimized.json")

        # -------------------------------------------------------------------
        # Step 4: Image SEO & Accessibility Optimization
        # -------------------------------------------------------------------
        logger.info("\n>>> STEP 4: Running Image SEO & ALT Text Optimizer...")
        image_engine = ImageOptimizer(
            domain_or_url=self.target_url,
            keyword_map_path=str(kw_map_path),
            output_base_dir=self.output_base_dir,
        )
        image_results = image_engine.execute()
        image_xlsx_path = image_results.get("excel_deliverable") or image_results.get("xlsx_path") or str(self.domain_output_dir / "04-image-optimization.xlsx")
        image_json_path = image_results.get("json_deliverable") or image_results.get("json_path") or str(self.domain_output_dir / "site-images-optimized.json")

        # -------------------------------------------------------------------
        # Step 5: Consolidate Unified Chrome Extension Bundle
        # -------------------------------------------------------------------
        logger.info("\n>>> STEP 5: Consolidating Unified Chrome Extension Bundle...")
        bundle_path = self.build_extension_bundle(
            kw_map_path=kw_map_path,
            meta_json_path=meta_json_path,
            heading_json_path=heading_json_path,
            image_json_path=image_json_path,
        )

        elapsed = (datetime.datetime.now() - start_time).total_seconds()
        logger.info("============================================================")
        logger.info("UNIFIED AUTOMATION COMPLETE (%.1fs)", elapsed)
        logger.info("Deliverable 1 (Docx):  %s", docx_path)
        logger.info("Deliverable 2 (Excel): %s", meta_xlsx_path)
        logger.info("Deliverable 3 (Excel): %s", heading_xlsx_path)
        logger.info("Deliverable 4 (Excel): %s", image_xlsx_path)
        logger.info("Extension Bundle:      %s", bundle_path)
        logger.info("============================================================")

        return {
            "domain": self.domain,
            "target_url": self.target_url,
            "elapsed_seconds": elapsed,
            "deliverables": {
                "keyword_report": str(docx_path),
                "meta_titles": str(meta_xlsx_path),
                "heading_structure": str(heading_xlsx_path),
                "image_optimization": str(image_xlsx_path),
                "extension_bundle": str(bundle_path),
            },
        }

    def build_extension_bundle(
        self,
        kw_map_path: Path,
        meta_json_path: Path,
        heading_json_path: Path,
        image_json_path: Path,
    ) -> Path:
        """Combine all 4 deliverable mappings into a single extension-bundle.json for 1-click CMS auto-fill."""
        kw_map_path = Path(kw_map_path) if kw_map_path else self.domain_output_dir / "site-keyword-map.json"
        meta_json_path = Path(meta_json_path) if meta_json_path else self.domain_output_dir / "site-meta-optimized.json"
        heading_json_path = Path(heading_json_path) if heading_json_path else self.domain_output_dir / "site-heading-optimized.json"
        image_json_path = Path(image_json_path) if image_json_path else self.domain_output_dir / "site-images-optimized.json"

        # Load sub-deliverable JSONs
        kw_data = {}
        if os.path.exists(kw_map_path):
            with open(kw_map_path, "r", encoding="utf-8") as f:
                kw_data = json.load(f)

        meta_data = {}
        if os.path.exists(meta_json_path):
            with open(meta_json_path, "r", encoding="utf-8") as f:
                meta_data = json.load(f)

        heading_data = {}
        if os.path.exists(heading_json_path):
            with open(heading_json_path, "r", encoding="utf-8") as f:
                heading_data = json.load(f)

        image_data = {}
        if os.path.exists(image_json_path):
            with open(image_json_path, "r", encoding="utf-8") as f:
                image_data = json.load(f)

        brand_name = kw_data.get("brand_name") or meta_data.get("brand_name") or self.domain.title()
        primary_location = kw_data.get("primary_location") or meta_data.get("primary_location") or "United States"

        # Index meta and heading records by clean URL/path
        meta_lookup: Dict[str, Dict[str, Any]] = {}
        for p in meta_data.get("pages", []):
            url_key = p.get("url", "").rstrip("/")
            path_key = urllib.parse.urlparse(p.get("url", "")).path.rstrip("/") or "/"
            meta_lookup[url_key] = p
            meta_lookup[path_key] = p

        heading_lookup: Dict[str, Dict[str, Any]] = {}
        for p in heading_data.get("pages", []):
            url_key = p.get("url", "").rstrip("/")
            path_key = urllib.parse.urlparse(p.get("url", "")).path.rstrip("/") or "/"
            heading_lookup[url_key] = p
            heading_lookup[path_key] = p

        # Index images by associated page URLs
        image_list = image_data.get("images", [])
        page_images_map: Dict[str, List[Dict[str, Any]]] = {}
        for img in image_list:
            for p_url in img.get("page_urls", []):
                p_url_clean = p_url.rstrip("/")
                p_path_clean = urllib.parse.urlparse(p_url).path.rstrip("/") or "/"
                if p_url_clean not in page_images_map:
                    page_images_map[p_url_clean] = []
                page_images_map[p_url_clean].append(img)
                if p_path_clean not in page_images_map:
                    page_images_map[p_path_clean] = []
                page_images_map[p_path_clean].append(img)

        # Consolidate page profiles
        consolidated_pages: List[Dict[str, Any]] = []
        kw_pages = kw_data.get("pages", [])

        for kp in kw_pages:
            url = kp.get("url", "")
            path = kp.get("path", "/")
            url_key = url.rstrip("/")
            path_key = path.rstrip("/") or "/"

            meta_p = meta_lookup.get(url_key) or meta_lookup.get(path_key) or {}
            heading_p = heading_lookup.get(url_key) or heading_lookup.get(path_key) or {}
            page_imgs = page_images_map.get(url_key) or page_images_map.get(path_key) or []

            # Deduplicate images for this page
            seen_src: Set[str] = set()
            clean_page_imgs: List[Dict[str, Any]] = []
            for img in page_imgs:
                src = img.get("image_url", "")
                if src and src not in seen_src:
                    seen_src.add(src)
                    clean_page_imgs.append({
                        "image_url": src,
                        "title": img.get("title", ""),
                        "old_alt": img.get("old_alt", ""),
                        "optimized_alt": img.get("optimized_alt", ""),
                        "length": img.get("optimized_alt_length", len(img.get("optimized_alt", ""))),
                        "section_heading": img.get("surrounding_headings", [""])[0] if img.get("surrounding_headings") else "",
                    })

            # Format headings
            clean_headings = []
            for h in heading_p.get("headings", []):
                clean_headings.append({
                    "old_headline": h.get("old_headline", ""),
                    "old_level": h.get("old_level", ""),
                    "new_headline": h.get("new_headline", ""),
                    "new_level": h.get("new_level", ""),
                    "change_type": h.get("change_type", ""),
                    "issue": h.get("issue", "none"),
                })

            page_entry = {
                "page_id": kp.get("page_id", f"{self.domain}-{len(consolidated_pages) + 1}"),
                "url": url,
                "path": path,
                "archetype": kp.get("archetype", "service_or_amenity"),
                "primary_keyword": kp.get("primary_keyword", ""),
                "old_title": meta_p.get("old_title", kp.get("title", "")),
                "new_title": meta_p.get("new_title", ""),
                "title_length": meta_p.get("new_title_len", len(meta_p.get("new_title", ""))),
                "old_meta_description": meta_p.get("old_meta", ""),
                "new_meta_description": meta_p.get("new_meta", ""),
                "meta_length": meta_p.get("new_meta_len", len(meta_p.get("new_meta", ""))),
                "cta_used": meta_p.get("cta_used", ""),
                "heading_health_score": heading_p.get("health_score", 100),
                "headings": clean_headings,
                "images": clean_page_imgs,
            }
            consolidated_pages.append(page_entry)

        bundle_data = {
            "bundle_version": "3.0.0",
            "generated_at": datetime.datetime.now().isoformat(),
            "domain": self.domain,
            "target_url": self.target_url,
            "brand_name": brand_name,
            "primary_location": primary_location,
            "summary": {
                "total_pages": len(consolidated_pages),
                "total_headings": heading_data.get("total_headings_processed", 0),
                "total_images": image_data.get("total_images_audited", 0),
                "high_opportunity_keywords": kw_data.get("summary", {}).get("total_opportunity_keywords", 0),
            },
            "deliverables": {
                "01_keyword_research_docx": str(self.domain_output_dir / "01-keyword-research-report.docx"),
                "02_meta_title_description_xlsx": str(self.domain_output_dir / "02-meta-title-description.xlsx"),
                "03_heading_structure_xlsx": str(self.domain_output_dir / "03-heading-structure-optimization.xlsx"),
                "04_image_optimization_xlsx": str(self.domain_output_dir / "04-image-optimization.xlsx"),
                "site_keyword_map_json": str(kw_map_path),
                "site_meta_optimized_json": str(meta_json_path),
                "site_heading_optimized_json": str(heading_json_path),
                "site_images_optimized_json": str(image_json_path),
            },
            "pages": consolidated_pages,
        }

        bundle_path = self.domain_output_dir / "extension-bundle.json"
        with open(bundle_path, "w", encoding="utf-8") as f:
            json.dump(bundle_data, f, indent=2)

        logger.info("Saved consolidated extension bundle: %s", bundle_path)
        return bundle_path


def main():
    parser = argparse.ArgumentParser(description="Unified Cogwheel SEO Automation for Any Website URL.")
    parser.add_argument("--url", required=True, help="Target website URL or domain (e.g., https://thenines.com)")
    parser.add_argument("--keywords-csv", default=None, help="Optional CSV path containing keyword data")
    parser.add_argument("--max-pages", type=int, default=35, help="Maximum number of pages to discover & crawl (default: 35)")
    parser.add_argument("--output-dir", default="output", help="Base output directory (default: output)")

    args = parser.parse_args()
    runner = CogwheelAutoRunner(
        url=args.url,
        keywords_csv=args.keywords_csv,
        max_pages=args.max_pages,
        output_dir=args.output_dir,
    )
    runner.run_all()


if __name__ == "__main__":
    main()
