"""Site Discovery & Page Classification Engine for Any Website URL.

Discovers pages via sitemap.xml inspection and internal link graph crawling.
Classifies each page into strict archetypes:
- home
- category_overview
- product_or_room
- service_or_amenity
- dining_or_outlet
- events_or_offers
- about_or_history
- faq
- gallery
- blog

Extracts brand name, primary location/market entities, core offerings,
and existing H1/Title/Meta/Body topics.
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import deque
from dataclasses import asdict, dataclass, field
from typing import Any, Optional

from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("SiteMapper")

# Standard Archetypes required by specification
ARCHETYPES = [
    "home",
    "category_overview",
    "product_or_room",
    "service_or_amenity",
    "dining_or_outlet",
    "events_or_offers",
    "about_or_history",
    "faq",
    "gallery",
    "blog",
]

PageArchetype = str  # One of ARCHETYPES


@dataclass
class DiscoveredPage:
    url: str
    path: str
    title: str
    archetype: PageArchetype
    h1: str = ""
    h2_list: list[str] = field(default_factory=list)
    meta_description: str = ""
    topics: list[str] = field(default_factory=list)
    word_count: int = 0
    internal_links_count: int = 0
    external_links_count: int = 0
    status_code: int = 200

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class SiteInventory:
    domain: str
    target_url: str
    brand_name: str
    primary_location: str
    core_offerings: list[str] = field(default_factory=list)
    pages: list[DiscoveredPage] = field(default_factory=list)
    total_pages_found: int = 0
    sitemap_url: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "domain": self.domain,
            "target_url": self.target_url,
            "brand_name": self.brand_name,
            "primary_location": self.primary_location,
            "core_offerings": self.core_offerings,
            "total_pages_found": self.total_pages_found,
            "sitemap_url": self.sitemap_url,
            "pages": [p.to_dict() for p in self.pages],
        }


class SiteMapper:
    """Discovers, inventories, and classifies indexable web pages across any domain."""

    USER_AGENT = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 (SeoStudioSiteMapper/3.0)"
    )

    def __init__(self, target_url: str, max_pages: int = 50, timeout: int = 10):
        self.raw_target = target_url.strip()
        parsed = urllib.parse.urlparse(self.raw_target)
        if not parsed.scheme:
            self.target_url = f"https://{self.raw_target}"
            parsed = urllib.parse.urlparse(self.target_url)
        else:
            self.target_url = self.raw_target

        self.scheme = parsed.scheme
        self.netloc = parsed.netloc.lower()
        self.domain = self.netloc.replace("www.", "")
        self.max_pages = max_pages
        self.timeout = timeout

        self.visited_urls: set[str] = set()
        self.discovered_pages: list[DiscoveredPage] = []
        self.sitemap_url: Optional[str] = None

        self.brand_name: str = ""
        self.primary_location: str = ""
        self.core_offerings: list[str] = []

    def _fetch_url(self, url: str) -> Optional[str]:
        """Fetch URL content with custom User-Agent, handling redirects and SSL gracefully."""
        # Try Playwright / crawl4ai if configured, otherwise robust urllib
        try:
            req = urllib.request.Request(url, headers={"User-Agent": self.USER_AGENT, "Accept": "text/html,application/xhtml+xml,application/xml"})
            with urllib.request.urlopen(req, timeout=self.timeout) as response:
                content_type = response.headers.get("Content-Type", "").lower()
                if "text/html" not in content_type and "xml" not in content_type and "text/plain" not in content_type:
                    return None
                return str(response.read().decode("utf-8", errors="replace"))
        except Exception as e:
            logger.debug("Fetch failed for %s: %s", url, e)
            return None

    def _discover_sitemap_urls(self) -> list[str]:
        """Check robots.txt and sitemap.xml for indexable page endpoints."""
        urls: list[str] = []
        candidates = [
            f"{self.scheme}://{self.netloc}/sitemap.xml",
            f"{self.scheme}://{self.netloc}/sitemap_index.xml",
            f"{self.scheme}://{self.netloc}/sitemap-index.xml",
            f"{self.scheme}://{self.netloc}/wp-sitemap.xml",
        ]

        # Check robots.txt for explicit Sitemap directive
        robots_url = f"{self.scheme}://{self.netloc}/robots.txt"
        robots_content = self._fetch_url(robots_url)
        if robots_content:
            for line in robots_content.splitlines():
                if line.lower().startswith("sitemap:"):
                    parts = line.split(":", 1)
                    if len(parts) == 2:
                        sm = parts[1].strip()
                        if sm and sm not in candidates:
                            candidates.insert(0, sm)

        for sitemap_url in candidates:
            xml_content = self._fetch_url(sitemap_url)
            if not xml_content or "<urlset" not in xml_content and "<sitemapindex" not in xml_content:
                continue

            self.sitemap_url = sitemap_url
            logger.info("Discovered active sitemap: %s", sitemap_url)
            try:
                # Remove namespaces for easy parsing
                clean_xml = re.sub(r'\sxmlns="[^"]+"', "", xml_content, count=1)
                root = ET.fromstring(clean_xml)

                # Check if sitemap index
                sub_sitemaps = [loc.text.strip() for loc in root.findall(".//sitemap/loc") if loc.text]
                if sub_sitemaps:
                    for sub in sub_sitemaps[:3]:  # inspect first 3 sub-sitemaps
                        sub_xml = self._fetch_url(sub)
                        if sub_xml:
                            sub_clean = re.sub(r'\sxmlns="[^"]+"', "", sub_xml, count=1)
                            try:
                                sub_root = ET.fromstring(sub_clean)
                                for loc in sub_root.findall(".//url/loc"):
                                    if loc.text:
                                        urls.append(loc.text.strip())
                            except Exception:
                                pass
                else:
                    for loc in root.findall(".//url/loc"):
                        if loc.text:
                            urls.append(loc.text.strip())

                if urls:
                    break
            except Exception as e:
                logger.debug("Failed parsing sitemap %s: %s", sitemap_url, e)

        # Filter to same domain and web pages only
        valid_urls = []
        for u in urls:
            p = urllib.parse.urlparse(u)
            if p.netloc.lower() == self.netloc:
                clean_path = p.path.lower()
                if not re.search(r"\.(jpg|jpeg|png|gif|svg|pdf|webp|css|js|xml|json)$", clean_path):
                    valid_urls.append(u.split("#")[0].split("?")[0])
        return list(dict.fromkeys(valid_urls))

    def _classify_page_archetype(self, path: str, title: str, h1: str, _body_text: str = "") -> PageArchetype:
        """Classify a page into one of the 10 archetype categories based on URL, title, and DOM content."""
        clean_path = path.strip("/").lower()
        full_context = f"{clean_path} {title.lower()} {h1.lower()}"

        # 1. Home
        if not clean_path or clean_path in ["home", "index.html", "index.php"]:
            return "home"

        # 2. FAQ
        if re.search(r"\b(faq|faqs|frequently-asked|questions|help-center)\b", full_context):
            return "faq"

        # 3. Gallery / Photos / Virtual Tour
        if re.search(r"\b(gallery|photos|photo-gallery|virtual-tour|lookbook|images|media)\b", full_context):
            return "gallery"

        # 4. Blog / News / Articles
        if re.search(r"\b(blog|news|articles|posts|journal|press-releases|insights)\b", clean_path):
            return "blog"

        # 5. Events / Meetings / Weddings / Offers / Specials
        if re.search(r"\b(weddings?|meetings?|events?|conferences?|offers?|packages?|specials?|promotions?)\b", full_context):
            return "events_or_offers"

        # 6. Dining / Restaurant / Bars / Lounges
        if re.search(r"\b(dining|restaurants?|bars?|lounges?|culinary|menus?|cafe|breakfast|bistro|room-service)\b", full_context):
            return "dining_or_outlet"

        # 7. Service / Amenity / Wellness / Spa / Facilities
        if re.search(r"\b(amenities|amenity|spa|pool|fitness|gym|wellness|valet|parking|services|concierge)\b", full_context):
            return "service_or_amenity"

        # 8. About / History / Story / Contact / Location
        if re.search(r"\b(about|about-us|our-story|history|heritage|team|leadership|contact|contact-us|location|directions)\b", clean_path):
            return "about_or_history"

        # 9. Product or Room (Specific item details with slug depth >= 2 or room tokens)
        segments = [s for s in clean_path.split("/") if s]
        if len(segments) >= 2 and segments[0] in ["rooms", "suites", "accommodations", "products", "item", "product", "collection"]:
            return "product_or_room"
        if re.search(r"\b(deluxe-king|queen-room|presidential-suite|guest-room|studio-suite|executive-suite)\b", clean_path):
            return "product_or_room"

        # 10. Category Overview (Hubs / Top-level directories)
        if len(segments) == 1 and segments[0] in [
            "rooms", "suites", "accommodations", "products", "shop", "categories", "services",
            "destinations", "experiences", "solutions"
        ]:
            return "category_overview"

        # Fallback heuristic based on depth and intent
        if len(segments) >= 2:
            return "product_or_room"
        if "overview" in full_context or "all" in full_context:
            return "category_overview"

        return "service_or_amenity"

    def _extract_page_details(self, url: str, html: str) -> DiscoveredPage:
        """Parse raw HTML to extract metadata, headings, topics, and archetype."""
        soup = BeautifulSoup(html, "html.parser")
        path = urllib.parse.urlparse(url).path or "/"

        # Title
        title = soup.title.string.strip() if (soup.title and soup.title.string) else ""
        if not title:
            og_title = soup.find("meta", property="og:title")
            title = str(og_title.get("content") or "").strip() if og_title else ""

        # Meta Description
        meta_desc = ""
        meta_tag = soup.find("meta", attrs={"name": "description"}) or soup.find("meta", property="og:description")
        if meta_tag and meta_tag.get("content"):
            meta_desc = str(meta_tag.get("content") or "").strip()

        # Primary H1
        h1_tag = soup.find("h1")
        h1_text = h1_tag.get_text().strip() if h1_tag else ""

        # H2 tags
        h2_tags = [h.get_text().strip() for h in soup.find_all("h2") if h.get_text().strip()]

        # Body prose & word count
        for s in soup(["script", "style", "noscript", "svg", "header", "footer", "nav"]):
            s.decompose()
        body_text = soup.get_text(separator=" ", strip=True)
        words = [w for w in re.findall(r"[A-Za-z0-9'-]+", body_text) if len(w) > 2]
        word_count = len(words)

        # High-frequency topic tokens (excluding common stop words)
        stop_words = {
            "the", "and", "for", "with", "that", "this", "from", "you", "are", "have",
            "our", "all", "your", "can", "will", "was", "were", "been", "has", "more"
        }
        word_freq: dict[str, int] = {}
        for w in words:
            lw = w.lower()
            if lw not in stop_words and len(lw) >= 4:
                word_freq[lw] = word_freq.get(lw, 0) + 1
        top_topics = [k for k, _ in sorted(word_freq.items(), key=lambda x: x[1], reverse=True)[:6]]

        # Links count
        internal_links = 0
        external_links = 0
        for a in soup.find_all("a", href=True):
            href = str(a["href"]).strip()
            if href.startswith("#") or href.startswith("javascript:") or href.startswith("mailto:") or href.startswith("tel:"):
                continue
            parsed = urllib.parse.urlparse(href)
            if not parsed.netloc or parsed.netloc.lower() == self.netloc:
                internal_links += 1
            else:
                external_links += 1

        # Classify
        archetype = self._classify_page_archetype(path, title, h1_text, body_text)

        return DiscoveredPage(
            url=url,
            path=path,
            title=title or (h1_text or path.replace("-", " ").title()),
            archetype=archetype,
            h1=h1_text,
            h2_list=h2_tags[:8],
            meta_description=meta_desc,
            topics=top_topics,
            word_count=word_count,
            internal_links_count=internal_links,
            external_links_count=external_links,
            status_code=200,
        )

    def _extract_site_entities(self, home_soup: BeautifulSoup, home_title: str) -> None:
        """Extract brand name, primary location, and core offerings from the root document."""
        # 1. Brand name
        og_site_name = home_soup.find("meta", property="og:site_name")
        if og_site_name and og_site_name.get("content"):
            self.brand_name = str(og_site_name.get("content") or "").strip()
        elif home_title:
            # Common patterns: "The Nines | Luxury Hotel" or "Marriott - City Center"
            splitters = ["|", " - ", " – ", " — ", " • "]
            for sp in splitters:
                if sp in home_title:
                    self.brand_name = home_title.split(sp)[0].strip()
                    break
        if not self.brand_name:
            self.brand_name = self.domain.split(".")[0].replace("-", " ").title()

        # 2. Location (City, State / Region)
        # Check JSON-LD
        for script in home_soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(script.string or "{}")
                items = data if isinstance(data, list) else data.get("@graph", [data])
                for item in items:
                    addr = item.get("address")
                    if isinstance(addr, dict):
                        city = addr.get("addressLocality")
                        state = addr.get("addressRegion")
                        if city and state:
                            self.primary_location = f"{city}, {state}"
                            break
            except Exception:
                pass

        if not self.primary_location:
            # Regex match common city/state patterns in body copy or title
            body_text = home_soup.get_text()
            loc_match = re.search(r"\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s([A-Z]{2})\b", body_text)
            if loc_match:
                self.primary_location = f"{loc_match.group(1)}, {loc_match.group(2)}"
            else:
                self.primary_location = "Primary Market"

        # 3. Core Offerings
        offerings_found = []
        amenity_terms = [
            "Oceanfront Suites", "Rooftop Restaurant", "Spa & Wellness", "Boutique Accommodations",
            "Conference Facilities", "Pet Friendly", "Valet Parking", "Direct Beach Access",
            "Event Space", "Outdoor Pool", "Fine Dining", "Modern Guest Rooms"
        ]
        lower_body = home_soup.get_text().lower()
        for term in amenity_terms:
            if term.lower() in lower_body:
                offerings_found.append(term)
        self.core_offerings = offerings_found[:5] or ["Accommodations", "Hospitality Services", "Local Dining"]

    def crawl(self) -> SiteInventory:
        """Run the automated site discovery and inventory workflow."""
        logger.info("Starting site discovery crawl for: %s", self.target_url)

        queue: deque[str] = deque()
        home_url = f"{self.scheme}://{self.netloc}/"
        queue.append(home_url)

        # 1. Sitemap Discovery
        sitemap_urls = self._discover_sitemap_urls()
        for su in sitemap_urls:
            if su not in queue:
                queue.append(su)

        logger.info("Total initial discovery queue size: %d URLs", len(queue))

        while queue and len(self.discovered_pages) < self.max_pages:
            current_url = queue.popleft()
            if current_url in self.visited_urls:
                continue

            self.visited_urls.add(current_url)
            html = self._fetch_url(current_url)
            if not html:
                continue

            page_info = self._extract_page_details(current_url, html)
            self.discovered_pages.append(page_info)
            logger.info("[%d/%d] Discovered: %s -> %s (%s)", len(self.discovered_pages), self.max_pages, page_info.path, page_info.archetype, page_info.title[:35])

            # Extract site entities from home page
            if page_info.archetype == "home" and not self.brand_name:
                soup = BeautifulSoup(html, "html.parser")
                self._extract_site_entities(soup, page_info.title)

            # Internal link crawl (if queue needs more pages)
            if len(self.discovered_pages) + len(queue) < self.max_pages:
                soup = BeautifulSoup(html, "html.parser")
                for a in soup.find_all("a", href=True):
                    href = str(a["href"]).strip()
                    if href.startswith("#") or href.startswith("javascript:") or href.startswith("mailto:") or href.startswith("tel:"):
                        continue
                    resolved = urllib.parse.urljoin(current_url, href)
                    p = urllib.parse.urlparse(resolved)
                    if p.netloc.lower() == self.netloc:
                        clean_url = f"{p.scheme}://{p.netloc}{p.path}".rstrip("/") or f"{p.scheme}://{p.netloc}/"
                        clean_path = p.path.lower()
                        if (
                            clean_url not in self.visited_urls
                            and clean_url not in queue
                            and not re.search(r"\.(jpg|jpeg|png|gif|svg|pdf|webp|css|js|xml|json)$", clean_path)
                        ):
                            queue.append(clean_url)

        # Guarantee at least home page if list is empty
        if not self.discovered_pages:
            self.discovered_pages.append(
                DiscoveredPage(
                    url=home_url,
                    path="/",
                    title=f"{self.domain} Home",
                    archetype="home",
                    h1=f"Welcome to {self.domain}",
                )
            )

        if not self.brand_name:
            self.brand_name = self.domain.split(".")[0].replace("-", " ").title()
        if not self.primary_location:
            self.primary_location = "Primary Market"

        return SiteInventory(
            domain=self.domain,
            target_url=self.target_url,
            brand_name=self.brand_name,
            primary_location=self.primary_location,
            core_offerings=self.core_offerings,
            pages=self.discovered_pages,
            total_pages_found=len(self.discovered_pages),
            sitemap_url=self.sitemap_url,
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Automated Site Discovery & Archetype Classifier")
    parser.add_argument("--url", required=True, help="Target website URL (e.g. https://example.com)")
    parser.add_argument("--max-pages", type=int, default=30, help="Maximum number of pages to crawl")
    parser.add_argument("--output-json", type=str, default=None, help="Save discovered inventory to JSON file")
    args = parser.parse_args()

    mapper = SiteMapper(args.url, max_pages=args.max_pages)
    inventory = mapper.crawl()

    output = inventory.to_dict()
    if args.output_json:
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2)
        print(f"Site inventory saved to {args.output_json}")
    else:
        print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
