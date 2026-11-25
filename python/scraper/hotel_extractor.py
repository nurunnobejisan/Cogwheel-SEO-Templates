"""Live Hotel Property Extractor using BeautifulSoup and optional Playwright.

Extracts:
1. Existing JSON-LD (@type Hotel, LodgingBusiness, FAQPage, BreadcrumbList)
2. Property-specific facts: room types, dining outlets, meeting space sq ft,
   parking/pet policies, nearby attractions and airports.
3. Technical SEO flags: Title > 60 chars, Meta Description > 155 chars,
   missing alt tags, duplicate H1 tags, canonical validation.
"""

from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from typing import Any, Optional

from bs4 import BeautifulSoup, Tag

from python.models.seo import (
    AttractionFact,
    DiningFact,
    ExtractedHotelFacts,
    MeetingSpaceFact,
    PolicyFact,
    PropertyAudit,
    RoomFact,
    TechnicalFlags,
)


class HotelExtractor:
    """Extracts grounded hospitality facts, schema, and technical signals from HTML or URLs."""

    USER_AGENT: str = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
    )

    def extract_from_html(self, html: str, url: str = "https://example-hotel.com") -> ExtractedHotelFacts:
        """Parse raw HTML string and extract complete hotel facts and technical flags."""
        soup = BeautifulSoup(html, "html.parser")

        # 1. Parse JSON-LD scripts
        raw_json_ld, faq_items = self._extract_json_ld(soup)

        # 2. Extract technical SEO flags
        technical_flags, title_str, meta_desc_str, h1_str, canonical_str = self._extract_technical_flags(soup, url)

        # 3. Extract core property identity
        hotel_name, brand_name, city, neighborhood = self._extract_property_identity(
            soup, raw_json_ld, title_str, h1_str, url
        )

        # 4. Extract property-specific facts
        rooms = self._extract_room_facts(soup, raw_json_ld)
        dining = self._extract_dining_facts(soup, raw_json_ld)
        meeting_space = self._extract_meeting_space_facts(soup, raw_json_ld)
        policies = self._extract_policy_facts(soup, raw_json_ld)
        attractions = self._extract_attractions_and_airports(soup, raw_json_ld)

        # Construct PropertyAudit
        word_count = technical_flags.word_count
        prop_audit = PropertyAudit(
            url=url,
            hotelName=hotel_name,
            brand=brand_name,
            city=city,
            neighborhood=neighborhood,
            title=title_str if title_str else hotel_name,
            metaDescription=meta_desc_str if meta_desc_str else f"Welcome to {hotel_name} in {city}.",
            h1=h1_str if h1_str else hotel_name,
            canonical=canonical_str if canonical_str else url,
            wordCount=word_count,
        )

        return ExtractedHotelFacts(
            property=prop_audit,
            rooms=rooms,
            dining=dining,
            meeting_space=meeting_space,
            policies=policies,
            attractions=attractions,
            technical_flags=technical_flags,
            faq_items=faq_items,
            raw_json_ld=raw_json_ld,
        )

    def extract_from_url(
        self, url: str, use_playwright: bool = False, timeout_sec: int = 15
    ) -> ExtractedHotelFacts:
        """Fetch live hotel page and extract structured facts. Supports Playwright when requested."""
        html = ""
        if use_playwright:
            try:
                import importlib

                playwright_module = importlib.import_module("playwright.sync_api")
                sync_playwright = playwright_module.sync_playwright

                with sync_playwright() as p:
                    browser = p.chromium.launch(headless=True)
                    page = browser.new_page(user_agent=self.USER_AGENT)
                    page.goto(url, timeout=timeout_sec * 1000, wait_until="networkidle")
                    html = page.content()
                    browser.close()
            except (ImportError, AttributeError):
                html = self._fetch_with_urllib(url, timeout_sec)
        else:
            html = self._fetch_with_urllib(url, timeout_sec)

        return self.extract_from_html(html, url=url)

    def _fetch_with_urllib(self, url: str, timeout_sec: int) -> str:
        """Fallback HTTP client using Python standard urllib with realistic headers."""
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": self.USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            },
        )
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            content: bytes = resp.read()
            charset = resp.headers.get_content_charset() or "utf-8"
            return content.decode(charset, errors="replace")

    # --------------------------------------------------------------------------
    # Sub-Extractors
    # --------------------------------------------------------------------------

    def _extract_json_ld(self, soup: BeautifulSoup) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
        """Extract and parse all JSON-LD blocks, extracting FAQPage Q&A if present."""
        raw_items: list[dict[str, Any]] = []
        faq_items: list[dict[str, str]] = []

        scripts = soup.find_all("script", type="application/ld+json")
        for s in scripts:
            content = s.string or s.text
            if not content:
                continue
            try:
                data = json.loads(content.strip())
                entities: list[dict[str, Any]] = []
                if isinstance(data, dict):
                    if "@graph" in data and isinstance(data["@graph"], list):
                        entities.extend([item for item in data["@graph"] if isinstance(item, dict)])
                    else:
                        entities.append(data)
                elif isinstance(data, list):
                    entities.extend([item for item in data if isinstance(item, dict)])

                for ent in entities:
                    raw_items.append(ent)
                    etype = ent.get("@type", "")
                    # Extract FAQ items
                    if etype == "FAQPage" and "mainEntity" in ent:
                        questions = ent["mainEntity"]
                        if isinstance(questions, list):
                            for q in questions:
                                if isinstance(q, dict) and q.get("@type") == "Question":
                                    q_text = str(q.get("name", "")).strip()
                                    ans_obj = q.get("acceptedAnswer", {})
                                    ans_text = ""
                                    if isinstance(ans_obj, dict):
                                        ans_text = str(ans_obj.get("text", "")).strip()
                                    if q_text and ans_text:
                                        faq_items.append({"question": q_text, "answer": ans_text})
            except Exception:
                continue

        return raw_items, faq_items

    def _extract_technical_flags(
        self, soup: BeautifulSoup, target_url: str
    ) -> tuple[TechnicalFlags, str, str, str, str]:
        """Inspect on-page technical elements: title, meta desc, headings, images, canonical."""
        # Title
        title_tag = soup.find("title")
        title_str = title_tag.get_text(strip=True) if title_tag else ""
        title_len = len(title_str)

        # Meta Description
        meta_desc_tag = soup.find("meta", attrs={"name": re.compile(r"^description$", re.I)})
        meta_desc_str = ""
        if isinstance(meta_desc_tag, Tag):
            meta_desc_str = str(meta_desc_tag.get("content", "")).strip()
        meta_desc_len = len(meta_desc_str)

        # Headings H1
        h1_tags = [h.get_text(strip=True) for h in soup.find_all("h1") if h.get_text(strip=True)]
        primary_h1 = h1_tags[0] if h1_tags else ""

        # Canonical
        canonical_link = soup.find("link", rel=re.compile(r"^canonical$", re.I))
        canonical_str = ""
        if isinstance(canonical_link, Tag):
            canonical_str = str(canonical_link.get("href", "")).strip()

        # Images & Alt
        images = soup.find_all("img")
        missing_alt = 0
        decorative_alt = 0
        for img in images:
            alt_val = img.get("alt")
            if alt_val is None:
                missing_alt += 1
            else:
                alt_str = " ".join(alt_val) if isinstance(alt_val, list) else str(alt_val)
                if not alt_str.strip():
                    decorative_alt += 1

        # Body prose word count
        # Strip script, style, nav, footer
        for el in soup(["script", "style", "noscript", "svg"]):
            el.extract()
        body_text = soup.get_text(" ", strip=True)
        words = re.findall(r"\b[a-zA-Z0-9'-]+\b", body_text)
        word_count = len(words)

        flags = TechnicalFlags(
            title_length=title_len,
            title_truncated=title_len > 60,
            meta_description_length=meta_desc_len,
            meta_description_truncated=meta_desc_len > 155,
            h1_count=len(h1_tags),
            h1_tags=h1_tags,
            duplicate_h1=len(h1_tags) > 1,
            total_images=len(images),
            missing_alt_images_count=missing_alt,
            decorative_images_count=decorative_alt,
            has_canonical=bool(canonical_str),
            canonical_match=(canonical_str.rstrip("/") == target_url.rstrip("/")) if canonical_str else False,
            word_count=word_count,
        )

        return flags, title_str, meta_desc_str, primary_h1, canonical_str

    def _extract_property_identity(
        self,
        soup: BeautifulSoup,
        json_ld: list[dict[str, Any]],
        title: str,
        h1: str,
        url: str,
    ) -> tuple[str, str, str, str]:
        """Derive official hotel name, brand, city, and neighborhood from JSON-LD and page DOM."""
        hotel_name = ""
        brand_name = "Independent"
        city = ""
        neighborhood = ""

        # Check JSON-LD first for LodgingBusiness / Hotel
        for item in json_ld:
            etype = str(item.get("@type", ""))
            if any(k in etype for k in ["Hotel", "LodgingBusiness", "Resort", "Motel"]):
                if "name" in item and not hotel_name:
                    hotel_name = str(item["name"]).strip()
                if "brand" in item:
                    b = item["brand"]
                    brand_name = str(b.get("name", b) if isinstance(b, dict) else b).strip()
                if "address" in item and isinstance(item["address"], dict):
                    addr = item["address"]
                    city = str(addr.get("addressLocality", "")).strip()
                    neighborhood = str(addr.get("addressRegion", "")).strip()

        # DOM fallback for hotel name
        if not hotel_name:
            if h1:
                hotel_name = h1
            elif title:
                # Strip suffixes like " | Official Site", " - Hotels"
                clean_t = re.sub(r"\s*[-|–—]\s*(?:Official Site|Hotels|Marriott|Hilton|IHG|Hyatt).*$", "", title, flags=re.I)
                hotel_name = clean_t.strip()
            else:
                hotel_name = "Hotel Property"

        # Brand heuristic if independent
        if brand_name == "Independent":
            full_text = f"{title} {h1} {url}".lower()
            if "marriott" in full_text or "courtyard" in full_text or "westin" in full_text or "sheraton" in full_text:
                brand_name = "Marriott International"
            elif "hilton" in full_text or "curio" in full_text or "doubletree" in full_text or "hampton" in full_text:
                brand_name = "Hilton Worldwide"
            elif "ihg" in full_text or "intercontinental" in full_text or "kimpton" in full_text or "holiday inn" in full_text:
                brand_name = "IHG Hotels & Resorts"
            elif "hyatt" in full_text or "andaz" in full_text:
                brand_name = "Hyatt Hotels"

        # City fallback
        if not city:
            city_match = re.search(r"in\s+([A-Z][a-zA-Z\s]+?)(?:,|\s+Hotel|\s+Downtown|\s*\||\.|$)", title)
            city = city_match.group(1).strip() if city_match else "Metropolitan Area"

        # Neighborhood fallback
        if not neighborhood:
            body_sample = soup.get_text()[:4000]
            neigh_match = re.search(
                r"(?:located in|heart of|district of|neighborhood of)\s+([A-Z][a-zA-Z0-9\s'-]+?)(?:,|\.|\sand)",
                body_sample,
                re.I,
            )
            neighborhood = neigh_match.group(1).strip() if neigh_match else f"Downtown {city}"

        return hotel_name, brand_name, city, neighborhood

    def _extract_room_facts(self, soup: BeautifulSoup, json_ld: list[dict[str, Any]]) -> list[RoomFact]:
        """Extract guestroom and suite types, dimensions (sq ft), and starting rates."""
        rooms: list[RoomFact] = []
        seen_names = set()

        # Check JSON-LD containsPlace / room
        for item in json_ld:
            if "containsPlace" in item and isinstance(item["containsPlace"], list):
                for place in item["containsPlace"]:
                    if isinstance(place, dict) and "name" in place:
                        r_name = str(place["name"]).strip()
                        if r_name and r_name not in seen_names:
                            seen_names.add(r_name)
                            rooms.append(RoomFact(name=r_name))

        # DOM / Regex scan
        text = soup.get_text(" ", strip=True)
        # Search patterns for rooms like "Deluxe King Room", "Executive Suite", "Two Queen Beds"
        room_pattern = re.compile(
            r"\b((?:Deluxe|Superior|Executive|Standard|Premium|Junior|Presidential|Corner|Classic|Studio)?\s*"
            r"(?:King|Queen|Double Queen|Twin|One-Bedroom|Two-Bedroom)?\s*"
            r"(?:Room|Suite|Guest Room|Studio))\b",
            re.I,
        )
        for match in room_pattern.finditer(text):
            r_name = match.group(1).strip().title()
            if len(r_name) > 4 and r_name not in seen_names:
                seen_names.add(r_name)
                # Look for sq ft nearby in context
                start = max(0, match.start() - 50)
                end = min(len(text), match.end() + 100)
                ctx = text[start:end]
                sqft_match = re.search(r"(\d{3,4})\s*(?:sq\.?\s*ft\.?|square\s+feet)", ctx, re.I)
                sq_ft = int(sqft_match.group(1)) if sqft_match else None
                rate_match = re.search(r"\$(\d{2,4})", ctx)
                rate = f"${rate_match.group(1)}" if rate_match else None
                rooms.append(RoomFact(name=r_name, sq_ft=sq_ft, starting_rate=rate))
                if len(rooms) >= 6:
                    break

        # No fabricated fallback rooms: if nothing on the page names a room type,
        # the extractor reports none rather than inventing plausible inventory.
        return rooms

    def _extract_dining_facts(self, soup: BeautifulSoup, json_ld: list[dict[str, Any]]) -> list[DiningFact]:
        """Extract on-site restaurants, bars, and breakfast outlets."""
        dining: list[DiningFact] = []
        seen = set()

        for item in json_ld:
            etype = str(item.get("@type", ""))
            if "Restaurant" in etype or "FoodEstablishment" in etype or "BarOrPub" in etype:
                d_name = str(item.get("name", "")).strip()
                if d_name and d_name not in seen:
                    seen.add(d_name)
                    cuisine = str(item.get("servesCuisine", "Contemporary American"))
                    dining.append(DiningFact(name=d_name, cuisine=cuisine))

        # DOM search for restaurants and dining
        text = soup.get_text(" ", strip=True)
        dining_match = re.finditer(
            r"(?:Restaurant|Bar|Lounge|Bistro|Café|Grill|Kitchen|Tavern|Rooftop Bar):\s*([A-Za-z0-9\s'&]+?)(?:\.|\n|,|Served)",
            text,
            re.I,
        )
        for m in dining_match:
            d_name = m.group(1).strip()
            if len(d_name) > 3 and d_name not in seen:
                seen.add(d_name)
                dining.append(DiningFact(name=d_name, cuisine="American & Regional"))
                if len(dining) >= 4:
                    break

        # No fabricated fallback dining venues. Return only what was found.
        return dining

    def _extract_meeting_space_facts(self, soup: BeautifulSoup, _json_ld: list[dict[str, Any]]) -> MeetingSpaceFact:
        """Extract total meeting sq ft, ballroom capacity, and meeting rooms count."""
        text = soup.get_text(" ", strip=True)

        total_sqft: Optional[int] = None
        ballroom_sqft: Optional[int] = None
        room_count: Optional[int] = None
        banquet_cap: Optional[int] = None
        reception_cap: Optional[int] = None

        # Search for total sq ft
        tot_match = re.search(r"(\d[\d,]*)\s*(?:sq\.?\s*ft\.?|square\s+feet)\s+(?:of\s+)?(?:meeting|event|flexible)\s+space", text, re.I)
        if tot_match:
            total_sqft = int(tot_match.group(1).replace(",", ""))

        # Ballroom sq ft
        ball_match = re.search(r"(?:ballroom|grand\s+ballroom).*?(\d[\d,]*)\s*(?:sq\.?\s*ft\.?|square\s+feet)", text, re.I)
        if ball_match:
            ballroom_sqft = int(ball_match.group(1).replace(",", ""))

        # Room count
        rc_match = re.search(r"(\d{1,3})\s+(?:meeting\s+rooms|event\s+spaces|breakout\s+rooms)", text, re.I)
        if rc_match:
            room_count = int(rc_match.group(1))

        # Capacities
        banq_match = re.search(
            r"(?:banquet|seated)(?:\s+capacity)?(?:\s+(?:up\s+to|for|of))?\s+(\d[\d,]*)", text, re.I
        )
        if banq_match:
            banquet_cap = int(banq_match.group(1).replace(",", ""))

        rec_match = re.search(
            r"(?:reception|receptions|standing)(?:\s+capacity)?(?:\s+(?:up\s+to|for|of))?\s+(\d[\d,]*)", text, re.I
        )
        if rec_match:
            reception_cap = int(rec_match.group(1).replace(",", ""))

        # Report only measured values; unknown fields stay null rather than using
        # a plausible default that would misrepresent the property.
        return MeetingSpaceFact(
            total_sq_ft=total_sqft,
            room_count=room_count,
            largest_ballroom_sq_ft=ballroom_sqft,
            max_banquet_capacity=banquet_cap,
            max_reception_capacity=reception_cap,
        )

    def _extract_policy_facts(self, soup: BeautifulSoup, json_ld: list[dict[str, Any]]) -> PolicyFact:
        """Extract check-in/out times, parking rates, and pet policies."""
        text = soup.get_text(" ", strip=True)

        # No fabricated policy defaults: report only what the page or JSON-LD
        # states. `None` means "not published", which the templates surface as a
        # gap instead of a made-up time or fee.
        check_in: Optional[str] = None
        check_out: Optional[str] = None
        parking_type: Optional[str] = None
        parking_fee: Optional[str] = None
        pet_policy: Optional[str] = None
        pet_fee: Optional[str] = None
        has_ev = bool(re.search(r"\b(?:EV\s+charging|electric\s+vehicle)\b", text, re.I))

        # JSON-LD policy checks
        for item in json_ld:
            if "checkinTime" in item:
                check_in = str(item["checkinTime"])
            if "checkoutTime" in item:
                check_out = str(item["checkoutTime"])
            if "petsAllowed" in item:
                val = item["petsAllowed"]
                pet_policy = "Pets Allowed" if val in [True, "True", "true"] else str(val)

        # Regex check in / check out
        ci_match = re.search(r"check-?in:\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)", text, re.I)
        if ci_match:
            check_in = ci_match.group(1).strip()
        co_match = re.search(r"check-?out:\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)", text, re.I)
        if co_match:
            check_out = co_match.group(1).strip()

        # Parking
        park_type_match = re.search(r"(valet\s+parking|self-?parking|off-?site\s+parking)", text, re.I)
        if park_type_match:
            parking_type = park_type_match.group(1).strip().title()
        park_match = re.search(r"(?:valet\s+parking|self-?parking|parking\s+fee).*?(\$\d+(?:\s*(?:per|/)\s*(?:day|night))?)", text, re.I)
        if park_match:
            parking_fee = park_match.group(1).strip()

        # Pet policy
        pet_match = re.search(r"(pet-?friendly|pets\s+welcome|no\s+pets\s+allowed)", text, re.I)
        if pet_match:
            pet_policy = pet_match.group(1).strip()
        pet_fee_m = re.search(r"(?:pet\s+fee|non-refundable\s+pet\s+deposit).*?(\$\d+)", text, re.I)
        if pet_fee_m:
            pet_fee = pet_fee_m.group(1).strip()

        return PolicyFact(
            check_in_time=check_in,
            check_out_time=check_out,
            parking_type=parking_type,
            parking_fee=parking_fee,
            pet_policy=pet_policy,
            pet_fee=pet_fee,
            has_ev_charging=has_ev,
        )

    def _extract_attractions_and_airports(
        self, soup: BeautifulSoup, _json_ld: list[dict[str, Any]]
    ) -> list[AttractionFact]:
        """Extract nearby attractions, convention centers, and airport distance/transit facts."""
        # Only report attractions the page actually states; no fabricated airport,
        # convention center or landmark distances.
        attractions: list[AttractionFact] = []
        text = soup.get_text(" ", strip=True)

        # Airport: distance-to-airport phrase, or an airport name/code mention.
        dist_airport = re.search(
            r"(\d+(?:\.\d+)?)\s*(?:miles?|mi)\s+(?:from|to)\s+([A-Za-z][A-Za-z\s]*?(?:Airport|International))",
            text,
            re.I,
        )
        code_airport = re.search(r"\b([A-Z]{3})\s+Airport\b", text)
        code_paren = re.search(r"Airport\s+\(([A-Z]{3})\)", text)
        if dist_airport:
            dist = float(dist_airport.group(1))
            name = dist_airport.group(2).strip()
            attractions.append(
                AttractionFact(name=name, category="airport", distance_miles=dist, drive_time_minutes=int(dist * 2.2))
            )
        elif code_airport or code_paren:
            code = (code_airport.group(1) if code_airport else None) or (code_paren.group(1) if code_paren else "AIR")
            attractions.append(AttractionFact(name=f"{code} Airport", category="airport"))

        # Convention center
        cc_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:miles?|mi|blocks?)\s+(?:from|to)\s+([A-Za-z\s]+Convention\s+Center)", text, re.I)
        if cc_match:
            dist = float(cc_match.group(1))
            name = cc_match.group(2).strip()
            attractions.append(AttractionFact(name=name, category="convention_center", distance_miles=dist, drive_time_minutes=int(dist * 3)))

        # Local landmark / stadium / museum / park
        lm_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:miles?|mi)\s+(?:from|to)\s+([A-Za-z\s]+(?:Stadium|Arena|Museum|Park|Square))", text, re.I)
        if lm_match:
            dist = float(lm_match.group(1))
            name = lm_match.group(2).strip()
            attractions.append(AttractionFact(name=name, category="landmark", distance_miles=dist))

        return attractions
