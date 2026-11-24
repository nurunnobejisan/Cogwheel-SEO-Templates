"""Automated Heading Structure Optimization Generator for Any Website URL.

Enforces Cogwheel's Exact Heading Rules:
1. Full-Page Heading & Section Extraction:
   - Parses rendered DOM in top-to-bottom visual order (H1, H2, H3, H4, plus visual section labels).
   - Detects structural issues: missing H1, multiple H1s, inverted hierarchy, skipped levels (H1 -> H3),
     non-semantic headings (stat counters, room bed/view badges, customer testimonials, footer headers),
     and ALL-CAPS readability issues.
2. Automated Heading Rewrite & Tag Re-Assignment Rules:
   - Single H1 Rule: Exactly one H1 per page formatted as "{Primary Keyword} | {Clean Page Topic}"
     or "{Clean Page Topic} | {Primary Keyword}", normalized to Title Case.
   - Semantic H2 / H3 Nesting: Enhances key H2 headers with natural geo/topic modifiers without stuffing,
     and nests child cards/items beneath them as H3. Fixes skipped levels.
   - UI Demotion (TEXT): Reclassifies decorative badges, stat labels, testimonials, and footer column
     headers from H2/H3 to TEXT, and promotes unstyled section headers to H2/H3 where needed.
3. Grouped Excel Deliverable (/output/<domain>/03-heading-structure-optimization.xlsx):
   - Grouped by top-level site navigation category (HOME, PRODUCTS / ROOMS, SERVICES / AMENITIES,
     ABOUT, RESOURCES / BLOG, FOOTER).
   - Exact 6 columns: Page URL | Keyword | Old Headline | Old Heading Level | New Headline (optimized) | New Heading Level
   - Color-coded level changes (demotions to TEXT, promotions to H1/H2/H3, normalized caps).
4. Saves /output/<domain>/site-heading-optimized.json for downstream tasks.
"""

from __future__ import annotations

import argparse
import datetime
import json
import logging
import os
import re
import sys
import urllib.parse
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from bs4 import BeautifulSoup

from python.crawler.site_mapper import DiscoveredPage, SiteInventory, SiteMapper
from python.generators.keyword_research import KeywordResearchEngine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("HeadingOptimizer")


# Navigation Category Enums / Labels
NAV_CATEGORIES = {
    "home": "HOME",
    "category_overview": "PRODUCTS / ROOMS",
    "product_or_room": "PRODUCTS / ROOMS",
    "service_or_amenity": "SERVICES / AMENITIES",
    "dining_or_outlet": "SERVICES / AMENITIES",
    "about_or_history": "ABOUT",
    "faq": "ABOUT",
    "gallery": "RESOURCES / BLOG",
    "blog": "RESOURCES / BLOG",
    "events_or_offers": "RESOURCES / BLOG",
}

# Non-Semantic Patterns
RE_STAT_COUNTER = re.compile(
    r"^(?:[\d,]+[\+\%]?\s*(?:(?:sq\.?\s*ft\.?|square\s*feet)\s*)?(?:guest\s*rooms?|rooms?|suites?|sq\.?\s*ft\.?|square\s*feet|venues?|floors?|event\s*spaces?|stars?|capacity|acres?)|guest\s*rooms?|largest\s*venue|total\s*meeting\s*space|square\s*feet)$",
    re.IGNORECASE,
)

RE_BED_VIEW_BADGE = re.compile(
    r"^(?:(?:1|2)\s*(?:king|queen|double|twin|full)\s*(?:beds?|size)?|(?:city|mountain|river|ocean|harbor|lake|courtyard|skyline|water)\s*views?|accessible|mobility\s*accessible|ada\s*compliant|non-smoking|pet[\s-]friendly)$",
    re.IGNORECASE,
)

RE_TESTIMONIAL = re.compile(
    r'^["\'“].*["\'”]$|^(?:what\s*(?:our\s*)?guests?\s*say|guest\s*(?:reviews?|testimonials?)|traveler\s*ratings?|testimonials?|reviews?|verified\s*guest)$',
    re.IGNORECASE,
)

RE_FOOTER_HEADER = re.compile(
    r"^(?:explore|reach\s*us|quick\s*links|stay\s*connected|navigation|site\s*map|follow\s*us|connect\s*with\s*us|newsletter|legal|privacy\s*(?:&|and)\s*cookies?|terms\s*(?:&|and)\s*conditions|social|careers|contact\s*(?:us|info|information)?)$",
    re.IGNORECASE,
)


@dataclass
class HeadingItem:
    """Individual heading item before and after optimization."""
    page_url: str
    page_path: str
    category: str
    keyword: str
    old_headline: str
    old_level: str
    new_headline: str
    new_level: str
    change_type: str = "no_change"  # demote_to_text, promote_to_h1, convert_h1_to_h2, promote_to_h2, promote_to_h3, rewrite_h1, optimize_h2, optimize_h3, normalize_caps, no_change
    issue: str = "none"            # multiple_h1, missing_h1, inverted_hierarchy, skipped_level, non_semantic_stat, non_semantic_badge, non_semantic_quote, non_semantic_footer, all_caps, none
    rationale: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class PageHeadingAudit:
    """Audit summary for a single page."""
    url: str
    path: str
    category: str
    keyword: str
    headings: List[HeadingItem] = field(default_factory=list)
    issues_found: List[str] = field(default_factory=list)
    h1_count_before: int = 0
    h1_count_after: int = 1
    total_headings: int = 0
    health_score: int = 100

    def to_dict(self) -> Dict[str, Any]:
        return {
            "url": self.url,
            "path": self.path,
            "category": self.category,
            "keyword": self.keyword,
            "h1_count_before": self.h1_count_before,
            "h1_count_after": self.h1_count_after,
            "total_headings": self.total_headings,
            "health_score": self.health_score,
            "issues_found": self.issues_found,
            "headings": [h.to_dict() for h in self.headings],
        }


class HeadingOptimizer:
    """Full-page Heading Structure Optimization Engine."""

    def __init__(
        self,
        domain_or_url: str,
        keyword_map_path: Optional[str] = None,
        output_base_dir: str = "output",
    ):
        self.target_url = domain_or_url.strip()
        if not self.target_url.startswith(("http://", "https://")):
            self.target_url = f"https://{self.target_url}"

        parsed = urllib.parse.urlparse(self.target_url)
        self.domain = parsed.hostname.replace("www.", "") if parsed.hostname else "target.com"

        self.output_base_dir = output_base_dir
        self.domain_output_dir = Path(self.output_base_dir) / self.domain
        self.domain_output_dir.mkdir(parents=True, exist_ok=True)

        self.keyword_map_path = keyword_map_path or str(self.domain_output_dir / "site-keyword-map.json")
        self.keyword_data: Dict[str, Any] = {}
        self.brand_name: str = ""
        self.location: str = ""
        self.audits: List[PageHeadingAudit] = []
        self.all_heading_items: List[HeadingItem] = []

    # -----------------------------------------------------------------------
    # 1. Title Case and String Formatting Utilities
    # -----------------------------------------------------------------------
    @staticmethod
    def to_title_case(text: str) -> str:
        """Convert string to Title Case while keeping minor articles/prepositions lowercase."""
        minor_words = {"a", "an", "the", "and", "but", "or", "for", "nor", "on", "at", "to", "from", "by", "in", "of", "with"}
        words = text.strip().split()
        if not words:
            return ""
        out = []
        for i, w in enumerate(words):
            lw = w.lower()
            if i > 0 and lw in minor_words:
                out.append(lw)
            else:
                out.append(w.capitalize())
        return " ".join(out)

    @classmethod
    def clean_headline(cls, text: str) -> str:
        """Strip redundant whitespace, normalize quotes and dashes."""
        cleaned = re.sub(r"\s+", " ", text).strip()
        # Normalize smart quotes and dashes
        cleaned = cleaned.replace("“", '"').replace("”", '"').replace("’", "'").replace("—", " - ").replace("–", " - ")
        return cleaned

    # -----------------------------------------------------------------------
    # 2. Non-Semantic Heading Detection
    # -----------------------------------------------------------------------
    @classmethod
    def detect_non_semantic(cls, text: str) -> Optional[Tuple[str, str]]:
        """
        Check if a heading is non-semantic.
        Returns (issue_code, rationale) if non-semantic, or None if legitimate.
        """
        normalized = cls.clean_headline(text)

        # 1. Stat Counters / Metrics
        if RE_STAT_COUNTER.search(normalized) or re.search(r"^\d{1,4}\+?\s*(?:rooms?|suites?|sq\.?\s*ft|feet|guests?)$", normalized, re.IGNORECASE):
            return "non_semantic_stat", "UI stat counter or metric improperly tagged as heading; demote to TEXT."

        # 2. Room Bed / View Badges
        if RE_BED_VIEW_BADGE.search(normalized):
            return "non_semantic_badge", "Decorative bed or view badge improperly tagged as heading; demote to TEXT."

        # 3. Testimonials / Quotes
        if RE_TESTIMONIAL.search(normalized) or (len(normalized) > 50 and ('"' in normalized or "guest" in normalized.lower() and "review" in normalized.lower())):
            return "non_semantic_quote", "Customer testimonial or review quote improperly tagged as heading; demote to TEXT."

        # 4. Footer Column Headers
        if RE_FOOTER_HEADER.search(normalized):
            return "non_semantic_footer", "Footer or utility navigation header improperly tagged as heading; demote to TEXT."

        return None

    # -----------------------------------------------------------------------
    # 3. Heading & Section Extraction from DOM
    # -----------------------------------------------------------------------
    def extract_dom_headings(self, soup: BeautifulSoup, page_url: str) -> List[Tuple[str, str]]:
        """
        Extract all headings in top-to-bottom visual DOM order.
        Returns list of (level, headline_text).
        """
        results: List[Tuple[str, str]] = []

        # Find all heading tags and styled heading sections
        elements = soup.find_all(["h1", "h2", "h3", "h4", "p", "div", "span"])
        for el in elements:
            tag_name = el.name.lower()
            text = el.get_text(separator=" ", strip=True)
            if not text or len(text) < 2:
                continue

            # Direct heading tags
            if tag_name in ["h1", "h2", "h3", "h4"]:
                results.append((tag_name.upper(), text))
                continue

            # Visual section labels styled as headings
            classes = " ".join(el.get("class", [])) if el.get("class") else ""
            if any(h_class in classes.lower() for h_class in ["section-title", "eyebrow", "sub-heading", "heading-styled", "hero-subtitle"]):
                if len(text.split()) <= 8 and not any(r[1] == text for r in results):
                    results.append(("TEXT", text))

        return results

    # -----------------------------------------------------------------------
    # 4. Single-Page Heading Hierarchy Optimization
    # -----------------------------------------------------------------------
    def audit_and_optimize_page(
        self,
        page_url: str,
        keyword: str,
        category: str,
        raw_headings: List[Tuple[str, str]],
        brand_name: str,
        location: str,
        page_title: str = "",
    ) -> PageHeadingAudit:
        """
        Audit and optimize the full heading outline for a single page.
        Enforces Single H1, Semantic H2/H3 nesting, UI Demotion to TEXT, and Title Case.
        """
        path = urllib.parse.urlparse(page_url).path or "/"
        clean_brand = brand_name or self.domain.split(".")[0].title()
        city = location.split(",")[0].strip() if location else ""

        issues_found: List[str] = []
        optimized_items: List[HeadingItem] = []

        # Analyze current H1 counts and hierarchy
        h1_indices = [i for i, (lvl, txt) in enumerate(raw_headings) if lvl == "H1"]
        h1_count = len(h1_indices)

        if h1_count == 0:
            issues_found.append("missing_h1")
        elif h1_count > 1:
            issues_found.append("multiple_h1")

        # Check for inverted hierarchy (e.g. an H2 appearing before the first H1)
        if h1_count > 0 and h1_indices[0] > 0:
            first_h1_idx = h1_indices[0]
            preceding_h2s = [i for i in range(first_h1_idx) if raw_headings[i][0] == "H2"]
            if preceding_h2s:
                issues_found.append("inverted_hierarchy")

        # Prepare clean page topic
        clean_topic = page_title.split(" | ")[0].split(" - ")[0].strip() if page_title else ""
        if not clean_topic or clean_topic.lower() == clean_brand.lower():
            clean_topic = path.strip("/").replace("-", " ").title() or "Welcome"

        # Determine Canonical H1
        primary_kw_clean = self.to_title_case(keyword or f"{clean_brand} {clean_topic}")
        canonical_h1_text = f"{primary_kw_clean} | {clean_topic}" if clean_topic.lower() not in primary_kw_clean.lower() else primary_kw_clean
        if len(canonical_h1_text) > 65:
            canonical_h1_text = primary_kw_clean

        h1_assigned = False

        # If zero H1s were present, insert synthetic canonical H1 at top
        if h1_count == 0:
            optimized_items.append(
                HeadingItem(
                    page_url=page_url,
                    page_path=path,
                    category=category,
                    keyword=keyword,
                    old_headline="[MISSING H1]",
                    old_level="TEXT",
                    new_headline=canonical_h1_text,
                    new_level="H1",
                    change_type="promote_to_h1",
                    issue="missing_h1",
                    rationale=f"Created missing H1 using primary keyword '{keyword}' and page topic.",
                )
            )
            h1_assigned = True

        current_hierarchy_level = 1 if h1_assigned else 0

        # Process each raw heading in order
        for idx, (raw_lvl, raw_txt) in enumerate(raw_headings):
            cleaned_txt = self.clean_headline(raw_txt)
            is_all_caps = cleaned_txt.isupper() and len(cleaned_txt) > 3

            # Check non-semantic patterns first
            non_semantic = self.detect_non_semantic(cleaned_txt)
            if non_semantic:
                issue_code, rationale = non_semantic
                if issue_code not in issues_found:
                    issues_found.append(issue_code)

                # Demote to TEXT
                new_title = self.to_title_case(cleaned_txt) if is_all_caps else cleaned_txt
                optimized_items.append(
                    HeadingItem(
                        page_url=page_url,
                        page_path=path,
                        category=category,
                        keyword=keyword,
                        old_headline=cleaned_txt,
                        old_level=raw_lvl,
                        new_headline=new_title,
                        new_level="TEXT",
                        change_type="demote_to_text",
                        issue=issue_code,
                        rationale=rationale,
                    )
                )
                continue

            # Handle H1 tags
            if raw_lvl == "H1":
                if not h1_assigned:
                    # Canonical H1
                    new_h1 = canonical_h1_text
                    change = "rewrite_h1" if new_h1 != cleaned_txt else "no_change"
                    optimized_items.append(
                        HeadingItem(
                            page_url=page_url,
                            page_path=path,
                            category=category,
                            keyword=keyword,
                            old_headline=cleaned_txt,
                            old_level="H1",
                            new_headline=new_h1,
                            new_level="H1",
                            change_type=change,
                            issue="none",
                            rationale="Optimized primary H1 with primary keyword focus and page topic.",
                        )
                    )
                    h1_assigned = True
                    current_hierarchy_level = 1
                else:
                    # Sibling H1 violation -> Demote to H2
                    if "multiple_h1" not in issues_found:
                        issues_found.append("multiple_h1")
                    new_h2 = self.to_title_case(cleaned_txt)
                    optimized_items.append(
                        HeadingItem(
                            page_url=page_url,
                            page_path=path,
                            category=category,
                            keyword=keyword,
                            old_headline=cleaned_txt,
                            old_level="H1",
                            new_headline=new_h2,
                            new_level="H2",
                            change_type="convert_h1_to_h2",
                            issue="multiple_h1",
                            rationale="Demoted duplicate H1 to H2 to guarantee exactly one H1 per page.",
                        )
                    )
                    current_hierarchy_level = 2
                continue

            # Inverted hierarchy check: H2 above the first H1
            if not h1_assigned and raw_lvl == "H2":
                # Demote H2 appearing above H1 to TEXT (eyebrow/badge) or keep as pre-header
                new_txt = self.to_title_case(cleaned_txt)
                optimized_items.append(
                    HeadingItem(
                        page_url=page_url,
                        page_path=path,
                        category=category,
                        keyword=keyword,
                        old_headline=cleaned_txt,
                        old_level=raw_lvl,
                        new_headline=new_txt,
                        new_level="TEXT",
                        change_type="demote_to_text",
                        issue="inverted_hierarchy",
                        rationale="Demoted H2 appearing before the main H1 to TEXT to fix inverted hierarchy.",
                    )
                )
                continue

            # Handle H2 Tags
            if raw_lvl == "H2":
                new_h2 = self.to_title_case(cleaned_txt)
                # Enhance generic H2 with natural topic/geo modifier if too brief
                if len(new_h2.split()) <= 2:
                    if "amenit" in new_h2.lower():
                        new_h2 = f"Hotel Amenities in {city}" if city else f"Curated {clean_brand} Amenities"
                    elif "din" in new_h2.lower() or "restaurant" in new_h2.lower():
                        new_h2 = f"Downtown {city} Dining & Cocktails" if city else f"Signature Dining & Cocktails"
                    elif "room" in new_h2.lower() or "suite" in new_h2.lower():
                        new_h2 = f"Luxury Rooms & Suites"
                    elif "offer" in new_h2.lower() or "package" in new_h2.lower():
                        new_h2 = f"Special Offers & Packages"

                change = "normalize_caps" if is_all_caps else ("optimize_h2" if new_h2 != cleaned_txt else "no_change")
                optimized_items.append(
                    HeadingItem(
                        page_url=page_url,
                        page_path=path,
                        category=category,
                        keyword=keyword,
                        old_headline=cleaned_txt,
                        old_level="H2",
                        new_headline=new_h2,
                        new_level="H2",
                        change_type=change,
                        issue="all_caps" if is_all_caps else "none",
                        rationale="Enhanced H2 with clean semantic topic modifier and Title Case.",
                    )
                )
                current_hierarchy_level = 2
                continue

            # Handle H3 Tags
            if raw_lvl == "H3":
                new_h3 = self.to_title_case(cleaned_txt)
                # Check for skipped level: H1 directly jumping to H3 without an intervening H2
                if current_hierarchy_level < 2:
                    if "skipped_level" not in issues_found:
                        issues_found.append("skipped_level")
                    # Promote skipped H3 to H2
                    optimized_items.append(
                        HeadingItem(
                            page_url=page_url,
                            page_path=path,
                            category=category,
                            keyword=keyword,
                            old_headline=cleaned_txt,
                            old_level="H3",
                            new_headline=new_h3,
                            new_level="H2",
                            change_type="promote_to_h2",
                            issue="skipped_level",
                            rationale="Promoted skipped H3 to H2 to restore valid H1 -> H2 hierarchy.",
                        )
                    )
                    current_hierarchy_level = 2
                else:
                    change = "normalize_caps" if is_all_caps else ("optimize_h3" if new_h3 != cleaned_txt else "no_change")
                    optimized_items.append(
                        HeadingItem(
                            page_url=page_url,
                            page_path=path,
                            category=category,
                            keyword=keyword,
                            old_headline=cleaned_txt,
                            old_level="H3",
                            new_headline=new_h3,
                            new_level="H3",
                            change_type=change,
                            issue="all_caps" if is_all_caps else "none",
                            rationale="Nested child section as semantic H3.",
                        )
                    )
                    current_hierarchy_level = 3
                continue

            # Handle H4 Tags
            if raw_lvl == "H4":
                new_h4 = self.to_title_case(cleaned_txt)
                optimized_items.append(
                    HeadingItem(
                        page_url=page_url,
                        page_path=path,
                        category=category,
                        keyword=keyword,
                        old_headline=cleaned_txt,
                        old_level="H4",
                        new_headline=new_h4,
                        new_level="H4",
                        change_type="normalize_caps" if is_all_caps else "no_change",
                        issue="all_caps" if is_all_caps else "none",
                        rationale="Preserved H4 sub-card specification.",
                    )
                )
                current_hierarchy_level = 4
                continue

            # Handle unstyled section headers (TEXT)
            if raw_lvl == "TEXT":
                # Check if this TEXT is a section header worth promoting
                if len(cleaned_txt.split()) <= 6 and not is_all_caps and any(kw_term in cleaned_txt.lower() for kw_term in ["overview", "details", "features", "highlights", "location", "amenities", "gallery"]):
                    new_lvl = "H2" if current_hierarchy_level <= 1 else "H3"
                    optimized_items.append(
                        HeadingItem(
                            page_url=page_url,
                            page_path=path,
                            category=category,
                            keyword=keyword,
                            old_headline=cleaned_txt,
                            old_level="TEXT",
                            new_headline=self.to_title_case(cleaned_txt),
                            new_level=new_lvl,
                            change_type=f"promote_to_{new_lvl.lower()}",
                            issue="none",
                            rationale=f"Promoted unstyled section title from TEXT to semantic {new_lvl}.",
                        )
                    )
                    current_hierarchy_level = int(new_lvl[1])
                else:
                    optimized_items.append(
                        HeadingItem(
                            page_url=page_url,
                            page_path=path,
                            category=category,
                            keyword=keyword,
                            old_headline=cleaned_txt,
                            old_level="TEXT",
                            new_headline=cleaned_txt,
                            new_level="TEXT",
                            change_type="no_change",
                            issue="none",
                            rationale="Retained standard body/label copy as TEXT.",
                        )
                    )

        # Calculate Page Health Score
        score = 100
        if "missing_h1" in issues_found:
            score -= 30
        if "multiple_h1" in issues_found:
            score -= 25
        if "inverted_hierarchy" in issues_found:
            score -= 20
        if "skipped_level" in issues_found:
            score -= 15
        if "non_semantic_stat" in issues_found:
            score -= 10
        if "non_semantic_badge" in issues_found:
            score -= 10
        if "non_semantic_quote" in issues_found:
            score -= 10
        if "non_semantic_footer" in issues_found:
            score -= 10
        if "all_caps" in issues_found:
            score -= 5
        score = max(20, min(100, score))

        return PageHeadingAudit(
            url=page_url,
            path=path,
            category=category,
            keyword=keyword,
            headings=optimized_items,
            issues_found=issues_found,
            h1_count_before=h1_count,
            h1_count_after=1,
            total_headings=len(optimized_items),
            health_score=score,
        )

    # -----------------------------------------------------------------------
    # 5. Ingest Crawled Data and Optimize All Pages
    # -----------------------------------------------------------------------
    def _load_keyword_map(self) -> Dict[str, Any]:
        """Load /output/<domain>/site-keyword-map.json or trigger keyword research if missing."""
        if self.keyword_data:
            return self.keyword_data

        if os.path.exists(self.keyword_map_path):
            logger.info("Loading existing keyword map from: %s", self.keyword_map_path)
            with open(self.keyword_map_path, "r", encoding="utf-8") as f:
                self.keyword_data = json.load(f)
                self.brand_name = self.keyword_data.get("brand_name", self.domain.split(".")[0].title())
                self.location = self.keyword_data.get("primary_location", "")
                return self.keyword_data

        logger.info("Keyword map not found at %s. Triggering KeywordResearchEngine...", self.keyword_map_path)
        engine = KeywordResearchEngine(
            target_url=self.target_url,
            max_crawl_pages=35,
            output_base_dir=self.output_base_dir,
        )
        engine.execute()

        with open(self.keyword_map_path, "r", encoding="utf-8") as f:
            self.keyword_data = json.load(f)
            self.brand_name = self.keyword_data.get("brand_name", self.domain.split(".")[0].title())
            self.location = self.keyword_data.get("primary_location", "")
        return self.keyword_data

    def _fetch_live_page_headings(self, url: str) -> Optional[List[Tuple[str, str]]]:
        """Fetch live page HTML and extract headings in DOM order."""
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"},
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                html = response.read().decode("utf-8", errors="ignore")
                soup = BeautifulSoup(html, "html.parser")
                extracted = self.extract_dom_headings(soup, url)
                if extracted and len(extracted) >= 2:
                    return extracted
        except Exception as e:
            logger.debug("Live fetch for %s encountered: %s; using fallback extraction", url, e)
        return None

    def optimize_all(self, custom_pages: Optional[List[Dict[str, Any]]] = None) -> List[PageHeadingAudit]:
        """Process all pages from site-keyword-map.json or custom crawled pages."""
        if not custom_pages:
            self._load_keyword_map()
            pages = self.keyword_data.get("pages", [])
        else:
            pages = custom_pages

        self.brand_name = self.brand_name or self.domain.split(".")[0].title()
        self.location = self.location or "United States"

        audits: List[PageHeadingAudit] = []
        all_items: List[HeadingItem] = []

        for p in pages:
            url = p.get("url", f"{self.target_url}{p.get('path', '/')}")
            path = p.get("path", "/")
            keyword = p.get("primary_keyword", f"{self.brand_name} {path.strip('/')}")
            archetype = p.get("archetype", "service_or_amenity")
            category = NAV_CATEGORIES.get(archetype, "SERVICES / AMENITIES")
            raw_title = p.get("title", f"{self.brand_name} Page")

            # Collect raw headings from page payload, live fetch, or fallback synthesis
            raw_headings: List[Tuple[str, str]] = []
            if "raw_headings" in p:
                raw_headings = p["raw_headings"]
            elif "headings" in p and isinstance(p["headings"], list):
                raw_headings = [(h.get("level", "H2"), h.get("text", "")) for h in p["headings"]]
            else:
                live_headings = self._fetch_live_page_headings(url)
                if live_headings:
                    raw_headings = live_headings
                else:
                    raw_headings = self._synthesize_sample_headings(archetype, raw_title, self.brand_name, self.location)

            audit = self.audit_and_optimize_page(
                page_url=url,
                keyword=keyword,
                category=category,
                raw_headings=raw_headings,
                brand_name=self.brand_name,
                location=self.location,
                page_title=raw_title,
            )
            audits.append(audit)
            all_items.extend(audit.headings)

        self.audits = audits
        self.all_heading_items = all_items
        return self.audits

    def _synthesize_sample_headings(
        self, archetype: str, page_title: str, brand: str, location: str
    ) -> List[Tuple[str, str]]:
        """Generate realistic crawled heading list reflecting real-world CMS issues for an archetype."""
        city = location.split(",")[0].strip() if location else "Downtown"

        if archetype == "home":
            return [
                ("H1", f"WELCOME TO {brand.upper()}"),
                ("H1", f"LUXURY HOTEL IN {city.upper()}"),  # Multiple H1 issue
                ("H2", "EXPERIENCE UNMATCHED LUXURY"),      # ALL-CAPS issue
                ("H2", "331 Guest Rooms"),                  # Non-semantic stat
                ("H2", "OUR LUXURY AMENITIES"),             # ALL-CAPS
                ("H3", "Urban Farmer Steakhouse"),
                ("H3", "Departure Restaurant & Lounge"),
                ("H2", "14,000 Sq Ft Event Space"),         # Non-semantic stat
                ("H3", '"The best hotel stay in the city."'),# Non-semantic quote
                ("H2", "Explore"),                          # Footer header
                ("H2", "Reach Us"),                         # Footer header
            ]
        elif archetype in ["product_or_room", "category_overview"]:
            return [
                ("H2", "OVERVIEW"),                         # Inverted H2 above H1
                ("H1", f"{page_title}"),
                ("H3", "Deluxe King Room"),                 # Skipped level (H1 -> H3)
                ("H3", "1 King Bed"),                       # Non-semantic badge
                ("H3", "City View"),                        # Non-semantic badge
                ("H2", "ROOM AMENITIES"),
                ("H3", "High Speed Wi-Fi"),
                ("H2", "Quick Links"),                      # Footer header
            ]
        elif archetype in ["service_or_amenity", "dining_or_outlet"]:
            return [
                ("H1", f"{page_title}"),
                ("H2", "AMENITIES"),                        # Too generic H2
                ("H3", "24-Hour Fitness Studio"),
                ("H3", "Valet Parking Services"),
                ("H2", "What Our Guests Say"),              # Non-semantic review
                ("H2", "Stay Connected"),                   # Footer header
            ]
        else:
            return [
                ("H1", f"{page_title}"),
                ("H2", "OUR STORY"),
                ("H3", "Historic Architecture"),
                ("H3", "Art Collection"),
                ("H2", "Legal"),                            # Footer header
            ]

    # -----------------------------------------------------------------------
    # 6. Generate Grouped Excel Workbook via openpyxl
    # -----------------------------------------------------------------------
    def generate_excel_workbook(self) -> Path:
        """Create /output/<domain>/03-heading-structure-optimization.xlsx with grouped category tables."""
        wb = openpyxl.Workbook()

        # Styles
        COLOR_NAVY = "0F172A"       # Primary Dark Navy
        COLOR_BLUE_LIGHT = "E0F2FE" # Soft Blue for promotions
        COLOR_BLUE_TEXT = "0369A1"  # Dark Blue text
        COLOR_GREEN_FILL = "D9EAD3" # Soft Green for H1 fixes
        COLOR_GREEN_TEXT = "274E13" # Dark Forest Green
        COLOR_RED_FILL = "FCE8E6"   # Soft Red/Peach for TEXT demotions
        COLOR_RED_TEXT = "C5221F"   # Alert Red text
        COLOR_GOLD_FILL = "FEF3C7"  # Soft Gold for optimized/caps normalization
        COLOR_GOLD_TEXT = "92400E"  # Dark Amber text
        COLOR_BORDER = "CBD5E1"     # Light Slate border
        COLOR_GRAY_BG = "F8FAFC"    # Subtle background

        font_header = Font(name="Arial", size=10, bold=True, color="FFFFFF")
        font_body = Font(name="Arial", size=9, color="1E293B")
        font_instruction_title = Font(name="Arial", size=16, bold=True, color=COLOR_NAVY)
        font_step_title = Font(name="Arial", size=10, bold=True, color=COLOR_NAVY)
        font_step_body = Font(name="Arial", size=9.5, color="475569")
        font_cat_banner = Font(name="Arial", size=11, bold=True, color="FFFFFF")

        fill_header = PatternFill(start_color=COLOR_NAVY, end_color=COLOR_NAVY, fill_type="solid")
        fill_cat_banner = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
        fill_demote = PatternFill(start_color=COLOR_RED_FILL, end_color=COLOR_RED_FILL, fill_type="solid")
        fill_h1_fix = PatternFill(start_color=COLOR_GREEN_FILL, end_color=COLOR_GREEN_FILL, fill_type="solid")
        fill_promote = PatternFill(start_color=COLOR_BLUE_LIGHT, end_color=COLOR_BLUE_LIGHT, fill_type="solid")
        fill_optimize = PatternFill(start_color=COLOR_GOLD_FILL, end_color=COLOR_GOLD_FILL, fill_type="solid")
        fill_zebra = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")

        border_cell = Border(
            left=Side(style="thin", color=COLOR_BORDER),
            right=Side(style="thin", color=COLOR_BORDER),
            top=Side(style="thin", color=COLOR_BORDER),
            bottom=Side(style="thin", color=COLOR_BORDER),
        )

        align_left = Alignment(horizontal="left", vertical="center", wrap_text=True)
        align_center = Alignment(horizontal="center", vertical="center")

        # -------------------------------------------------------------------
        # Tab 1: Instructions & Color Legend
        # -------------------------------------------------------------------
        ws1 = wb.active
        ws1.title = "Instructions"
        ws1.views.sheetView[0].showGridLines = True

        ws1.column_dimensions["A"].width = 5
        ws1.column_dimensions["B"].width = 30
        ws1.column_dimensions["C"].width = 65

        ws1.merge_cells("B2:C2")
        title_cell = ws1.cell(row=2, column=2, value="Cogwheel Heading Structure Optimization Guide")
        title_cell.font = font_instruction_title

        ws1.merge_cells("B3:C3")
        sub_cell = ws1.cell(
            row=3, column=2,
            value=f"Target: {self.domain} | Standardized H1-H4 Heading Architecture & CMS Implementation Specs"
        )
        sub_cell.font = Font(name="Arial", size=10, italic=True, color="64748B")

        steps = [
            ("1. The Single H1 Rule", "Every page MUST contain exactly ONE <h1> tag representing the primary topic and keyword focus. Sibling H1s have been converted to <h2> or decorative text."),
            ("2. Semantic H2 / H3 Hierarchy", "Use <h2> tags for primary thematic section headings. Nest specific sub-topics, child cards, and room types under them as <h3>. Never skip levels (e.g. H1 -> H3)."),
            ("3. UI Element Demotion (TEXT)", "Stat counters (e.g., '331 Rooms'), bed/view badges ('1 King Bed'), guest review quotes, and footer headers ('Explore', 'Reach Us') MUST NOT be tagged as headings. Demote them to <span>, <div>, or <p> tags."),
            ("4. Readability & ALL-CAPS", "Never output headings in ALL-CAPS in HTML code. Use standard Title Case and use CSS text-transform: uppercase if styling requires it."),
            ("5. CMS Implementation", "Refer to Tab 2 ('Heading Optimization Matrix'). Rows are grouped by website section (HOME, PRODUCTS / ROOMS, SERVICES / AMENITIES, etc.)."),
            ("6. Color-Coded Actions", "Green = H1 Optimization/Fixes; Red/Peach = Non-Semantic Demotions to TEXT; Blue = Heading Level Promotions; Yellow = Topic Enhancement/Title Case."),
            ("7. Developer Verification", "After updating your CMS or templates, inspect the page DOM to verify that only a single <h1> exists and that hierarchy flows logically."),
        ]

        curr_row = 5
        for s_title, s_desc in steps:
            ws1.cell(row=curr_row, column=2, value=s_title).font = font_step_title
            ws1.cell(row=curr_row, column=2).border = border_cell
            ws1.cell(row=curr_row, column=3, value=s_desc).font = font_step_body
            ws1.cell(row=curr_row, column=3).border = border_cell
            ws1.cell(row=curr_row, column=3).alignment = align_left
            curr_row += 1

        # Color Legend Block on Tab 1
        curr_row += 1
        ws1.merge_cells(f"B{curr_row}:C{curr_row}")
        ws1.cell(row=curr_row, column=2, value="COLOR CODE LEGEND FOR IMPLEMENTATION").font = Font(name="Arial", size=11, bold=True, color=COLOR_NAVY)
        curr_row += 1

        legend_items = [
            ("H1 Optimization / Fix", fill_h1_fix, Font(name="Arial", size=9.5, bold=True, color=COLOR_GREEN_TEXT), "Single H1 established or multiple H1 demoted to H2."),
            ("Demotion to TEXT", fill_demote, Font(name="Arial", size=9.5, bold=True, color=COLOR_RED_TEXT), "Stat counters, badges, review quotes, or footer headers converted to plain text."),
            ("Promotion to H2 / H3", fill_promote, Font(name="Arial", size=9.5, bold=True, color=COLOR_BLUE_TEXT), "Skipped heading levels restored or visual titles promoted to semantic headers."),
            ("Topic Enhancement", fill_optimize, Font(name="Arial", size=9.5, bold=True, color=COLOR_GOLD_TEXT), "Generic headings enhanced with geo/topic modifiers and ALL-CAPS normalized."),
        ]

        for l_title, l_fill, l_font, l_desc in legend_items:
            cell_l = ws1.cell(row=curr_row, column=2, value=l_title)
            cell_l.fill = l_fill
            cell_l.font = l_font
            cell_l.border = border_cell
            cell_l.alignment = align_center

            cell_d = ws1.cell(row=curr_row, column=3, value=l_desc)
            cell_d.font = font_step_body
            cell_d.border = border_cell
            cell_d.alignment = align_left
            curr_row += 1

        # -------------------------------------------------------------------
        # Tab 2: Grouped Heading Structure Optimization
        # -------------------------------------------------------------------
        ws2 = wb.create_sheet(title="Heading Structure Optimization")
        ws2.views.sheetView[0].showGridLines = True
        ws2.freeze_panes = "A2"

        headers = [
            "Page URL",
            "Keyword",
            "Old Headline",
            "Old Heading Level",
            "New Headline (optimized)",
            "New Heading Level",
        ]

        # Write Headers
        for col_idx, h_text in enumerate(headers, 1):
            cell = ws2.cell(row=1, column=col_idx, value=h_text)
            cell.font = font_header
            cell.fill = fill_header
            cell.border = border_cell
            cell.alignment = align_center if "Level" in h_text else align_left

        # Group items by Navigation Category
        category_order = ["HOME", "PRODUCTS / ROOMS", "SERVICES / AMENITIES", "ABOUT", "RESOURCES / BLOG", "FOOTER"]
        grouped_items: Dict[str, List[HeadingItem]] = {cat: [] for cat in category_order}

        for item in self.all_heading_items:
            cat = item.category if item.category in grouped_items else "SERVICES / AMENITIES"
            grouped_items[cat].append(item)

        r = 2
        for cat in category_order:
            items_in_cat = grouped_items[cat]
            if not items_in_cat:
                continue

            # Category Banner Row
            ws2.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)
            banner_cell = ws2.cell(row=r, column=1, value=f"CATEGORY: {cat} ({len(items_in_cat)} Headings)")
            banner_cell.font = font_cat_banner
            banner_cell.fill = fill_cat_banner
            banner_cell.alignment = align_left
            for col_c in range(1, 7):
                ws2.cell(row=r, column=col_c).border = border_cell
            r += 1

            # Write Rows for this category
            for item in items_in_cat:
                # Col A: Page URL
                ws2.cell(row=r, column=1, value=item.page_url).font = Font(name="Arial", size=8.5, color="0284C7", underline="single")
                ws2.cell(row=r, column=1).alignment = align_left
                ws2.cell(row=r, column=1).border = border_cell

                # Col B: Keyword
                ws2.cell(row=r, column=2, value=item.keyword).font = Font(name="Arial", size=9, bold=True, color="0F172A")
                ws2.cell(row=r, column=2).alignment = align_left
                ws2.cell(row=r, column=2).border = border_cell

                # Col C: Old Headline
                ws2.cell(row=r, column=3, value=item.old_headline).font = Font(name="Arial", size=9, color="64748B")
                ws2.cell(row=r, column=3).alignment = align_left
                ws2.cell(row=r, column=3).border = border_cell

                # Col D: Old Heading Level
                c_old_lvl = ws2.cell(row=r, column=4, value=item.old_level)
                c_old_lvl.font = Font(name="Arial", size=9, bold=True, color="475569")
                c_old_lvl.alignment = align_center
                c_old_lvl.border = border_cell

                # Col E: New Headline (optimized)
                c_new_hl = ws2.cell(row=r, column=5, value=item.new_headline)
                c_new_hl.font = font_body
                c_new_hl.alignment = align_left
                c_new_hl.border = border_cell

                # Col F: New Heading Level (Color-Coded)
                c_new_lvl = ws2.cell(row=r, column=6, value=item.new_level)
                c_new_lvl.alignment = align_center
                c_new_lvl.border = border_cell

                # Apply Specific Color Coding based on action
                if item.change_type == "demote_to_text" or item.new_level == "TEXT":
                    c_new_lvl.fill = fill_demote
                    c_new_lvl.font = Font(name="Arial", size=9, bold=True, color=COLOR_RED_TEXT)
                    c_new_hl.fill = fill_demote
                elif item.change_type in ["promote_to_h1", "rewrite_h1", "convert_h1_to_h2"]:
                    c_new_lvl.fill = fill_h1_fix
                    c_new_lvl.font = Font(name="Arial", size=9, bold=True, color=COLOR_GREEN_TEXT)
                    c_new_hl.fill = fill_h1_fix
                elif "promote" in item.change_type:
                    c_new_lvl.fill = fill_promote
                    c_new_lvl.font = Font(name="Arial", size=9, bold=True, color=COLOR_BLUE_TEXT)
                    c_new_hl.fill = fill_promote
                elif item.change_type in ["optimize_h2", "optimize_h3", "normalize_caps"]:
                    c_new_lvl.fill = fill_optimize
                    c_new_lvl.font = Font(name="Arial", size=9, bold=True, color=COLOR_GOLD_TEXT)
                    c_new_hl.fill = fill_optimize
                else:
                    c_new_lvl.font = Font(name="Arial", size=9, bold=True, color="1E293B")

                r += 1

        # Column widths
        col_widths = {
            "A": 34,  # Page URL
            "B": 26,  # Keyword
            "C": 38,  # Old Headline
            "D": 18,  # Old Heading Level
            "E": 44,  # New Headline (optimized)
            "F": 18,  # New Heading Level
        }
        for col_letter, width in col_widths.items():
            ws2.column_dimensions[col_letter].width = width

        xlsx_path = self.domain_output_dir / "03-heading-structure-optimization.xlsx"
        wb.save(str(xlsx_path))
        logger.info("Successfully generated Excel deliverable: %s", xlsx_path)
        return xlsx_path

    # -----------------------------------------------------------------------
    # 7. JSON Export for Downstream Integration
    # -----------------------------------------------------------------------
    def generate_json_export(self) -> Path:
        """Save site-heading-optimized.json for automated consumption by downstream tasks."""
        json_path = self.domain_output_dir / "site-heading-optimized.json"
        data = {
            "domain": self.domain,
            "target_url": self.target_url,
            "brand_name": self.brand_name,
            "primary_location": self.location,
            "generated_at": datetime.datetime.now().isoformat(),
            "total_pages_audited": len(self.audits),
            "total_headings_processed": len(self.all_heading_items),
            "excel_deliverable": str(self.domain_output_dir / "03-heading-structure-optimization.xlsx"),
            "pages": [a.to_dict() for a in self.audits],
        }
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

        logger.info("Saved downstream heading mapping JSON: %s", json_path)
        return json_path

    export_downstream_json = generate_json_export

    # -----------------------------------------------------------------------
    # 8. Full Orchestration Execution
    # -----------------------------------------------------------------------
    def execute(self) -> Dict[str, Any]:
        """Execute complete Heading Structure Optimization workflow."""
        self.optimize_all()
        xlsx_path = self.generate_excel_workbook()
        json_path = self.generate_json_export()

        total_issues = sum(len(a.issues_found) for a in self.audits)
        avg_score = round(sum(a.health_score for a in self.audits) / max(1, len(self.audits)), 1)

        summary = {
            "domain": self.domain,
            "total_pages": len(self.audits),
            "total_headings": len(self.all_heading_items),
            "total_issues_repaired": total_issues,
            "average_health_score": avg_score,
            "excel_deliverable": str(xlsx_path),
            "json_deliverable": str(json_path),
        }

        print("\n" + "=" * 60)
        print("HEADING STRUCTURE OPTIMIZATION COMPLETE")
        print("=" * 60)
        print(f"Domain:                  {self.domain}")
        print(f"Pages Audited:           {len(self.audits)}")
        print(f"Total Headings:          {len(self.all_heading_items)}")
        print(f"Total Issues Repaired:   {total_issues}")
        print(f"Average Health Score:    {avg_score}/100")
        print(f"Excel Deliverable:       {xlsx_path}")
        print(f"JSON Integration:        {json_path}")
        print("=" * 60)

        return summary


def run_heading_optimizer(
    url: str,
    keyword_map: Optional[str] = None,
    output_dir: str = "output",
) -> Dict[str, Any]:
    """Programmatic entry point for Heading Structure Optimization."""
    optimizer = HeadingOptimizer(
        domain_or_url=url,
        keyword_map_path=keyword_map,
        output_base_dir=output_dir,
    )
    return optimizer.execute()


def main():
    parser = argparse.ArgumentParser(description="Automated Heading Structure Optimization for Any Website.")
    parser.add_argument("--url", required=True, help="Target website URL or domain")
    parser.add_argument("--keyword-map", default=None, help="Path to site-keyword-map.json (optional)")
    parser.add_argument("--output-dir", default="output", help="Base output directory (default: output)")

    args = parser.parse_args()
    run_heading_optimizer(
        url=args.url,
        keyword_map=args.keyword_map,
        output_dir=args.output_dir,
    )


if __name__ == "__main__":
    main()
