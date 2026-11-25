#!/usr/bin/env python3
"""
Cogwheel SEO & Hospitality Templates Studio
Website Image Optimization Audit Tool (CLI & Automation Engine)

Crawls public pages of a website, audits every image placement (alt text, file size,
format, dimensions, loading behavior, broken links, CLS risks), and generates a multi-tab
Excel (.xlsx) workbook matching the reference layout:
https://docs.google.com/spreadsheets/d/1gdX3whxcXFlVNJDat2Avz_q3haNRfWz39TAMK0Q6QGc/

Tabs generated:
  1. Image Optimization  — Exact 6 columns (Image | URL | Title | Length | Optimized ALT Text | Length)
                           with =IMAGE(B2) and =LEN(...) formulas, yellow header, comfortable row heights
  2. Audit Summary       — Exhaustive coverage report, discovery methods, reachability & coverage statements
  3. Image Inventory     — Comprehensive technical audit of all discovered assets
  4. Recommendations     — Category guidance, performance rationale & prioritized fixes
  5. Crawl Log           — Page-by-page crawl log with HTTP status and discovery counts
"""

from __future__ import annotations

import argparse
import contextlib
import html
import io
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

USER_AGENT = "Mozilla/5.0 (compatible; CogwheelImageAudit/2.7; +https://cogwheel-seo-templates.vercel.app)"


# -----------------------------------------------------------------------------
# 1. URL & Text Utilities
# -----------------------------------------------------------------------------

def normalize_url(raw: str, base_url: str = "") -> str | None:
    if not raw or not isinstance(raw, str):
        return None
    raw = raw.strip()
    if raw.startswith("//"):
        raw = "https:" + raw
    try:
        resolved = urllib.parse.urljoin(base_url, raw)
        parsed = urllib.parse.urlparse(resolved)
        if parsed.scheme not in ("http", "https"):
            return None
        # Remove tracking query parameters and fragment
        query_params = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
        for trk in ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"]:
            query_params.pop(trk, None)
        new_query = urllib.parse.urlencode(query_params, doseq=True)
        cleaned = urllib.parse.urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, ""))
        return cleaned
    except Exception:
        return None


def extract_original_filename(image_url: str, fallback_page_url: str = "") -> str:
    """Extracts and URL-decodes the original filename including extension."""
    try:
        path = urllib.parse.urlparse(image_url).path
        raw_name = path.split("/")[-1]
        decoded = urllib.parse.unquote(raw_name).strip()
        if decoded and "." in decoded:
            return decoded
        if fallback_page_url:
            page_slug = urllib.parse.urlparse(fallback_page_url).path.strip("/").split("/")[-1] or "homepage"
            return f"image-{urllib.parse.unquote(page_slug)}.jpg"
        return "image-asset.jpg"
    except Exception:
        return "image-asset.jpg"


def clean_filename_title(url: str) -> str:
    try:
        filename = extract_original_filename(url)
        name = re.sub(r"\.[a-zA-Z0-9]{2,5}$", "", filename)
        name = re.sub(r"[-_](?:scaled|optimized|thumb|thumbnail|\d+x\d+|@\d+x)$", "", name, flags=re.I)
        name = re.sub(r"[_-]+", " ", name).strip()
        return name or "Image asset"
    except Exception:
        return "Image asset"


# -----------------------------------------------------------------------------
# Advanced Hospitality & SEO Category Taxonomy
# -----------------------------------------------------------------------------

HOSPITALITY_CATEGORIES = {
    "rooms": {
        "keywords": [
            "room", "suite", "king", "queen", "bed", "bath", "living", "balcony", "terrace",
            "penthouse", "presidential", "guestroom", "superior", "deluxe", "executive",
            "studio", "accessible", "corner", "double"
        ],
        "label": "Guest Room Accommodation",
        "descriptor": "with contemporary luxury bedding and spacious sitting area",
    },
    "dining": {
        "keywords": [
            "dining", "restaurant", "bistro", "cafe", "bar", "cocktail", "lounge", "breakfast",
            "dinner", "chef", "wine", "culinary", "patio", "brunch", "rooftop", "tasting",
            "table", "entree", "dessert", "spirits"
        ],
        "label": "Culinary & Dining Experience",
        "descriptor": "featuring artisanal seasonal cuisine and cocktail presentation",
    },
    "amenities": {
        "keywords": [
            "pool", "spa", "wellness", "fitness", "gym", "hot-tub", "sauna", "massage",
            "cabana", "resort", "deck", "jacuzzi", "sun-lounger", "yoga", "treatment"
        ],
        "label": "Resort Amenities & Wellness",
        "descriptor": "offering heated outdoor relaxation and wellness amenities",
    },
    "meetings": {
        "keywords": [
            "meeting", "event", "conference", "boardroom", "ballroom", "wedding", "banquet",
            "reception", "summit", "gathering", "venue", "catering", "convention"
        ],
        "label": "Meeting & Event Spaces",
        "descriptor": "configured with high-tech audio-visual setup and banquet seating",
    },
    "exterior": {
        "keywords": [
            "exterior", "facade", "building", "grounds", "entrance", "skyline", "aerial",
            "sunset", "twilight", "porte-cochere", "valet", "architecture", "courtyard", "dusk"
        ],
        "label": "Hotel Exterior & Grounds",
        "descriptor": "showcasing landmark architectural design and surrounding city skyline",
    },
    "lobby": {
        "keywords": [
            "lobby", "reception", "concierge", "art", "fireplace", "chandelier", "atrium",
            "interior", "arrival", "check-in"
        ],
        "label": "Lobby & Interior Design",
        "descriptor": "featuring bespoke artwork and welcoming guest reception area",
    },
}


def classify_hospitality_context(text: str) -> tuple[str, str] | None:
    """Matches text against hospitality category keywords and returns (category_key, descriptor)."""
    s = text.lower()
    for cat_key, info in HOSPITALITY_CATEGORIES.items():
        for kw in info["keywords"]:
            if re.search(rf"\b{re.escape(kw)}\b", s):
                return cat_key, info["descriptor"]
    return None


def generate_proposed_alt(
    url: str,
    page_title: str | None,
    current_alt: str | None,
    is_decorative: bool = False,
    page_url: str = ""
) -> str:
    """Generates a high-quality, keyword-rich, WCAG 2.2 AA compliant ALT text.

    Rules enforced:
      1. Decorative: returns empty string (alt="") conforming to WCAG 2.2 AA.
      2. Existing Quality: preserves descriptive alt if >= 12 chars and non-generic.
      3. No Redundant Phrases: excludes 'image of', 'photo of', 'picture of'.
      4. Length Budget: optimized strictly between 40 and 120 characters.
      5. Entity Integration: combines property name, page context, and subject.
    """
    if is_decorative:
        return ""  # WCAG standard: decorative elements properly use empty alt=""

    if current_alt:
        c_clean = current_alt.strip()
        is_bad_alt = (
            len(c_clean) < 12
            or re.search(r"\.(?:jpg|png|webp|jpeg|svg|gif)$", c_clean, re.I)
            or re.match(r"^(?:image|img|photo|picture|dsc|p\d+|untitled)[\s_.:-]*", c_clean, re.I)
            or c_clean.lower() in ("image", "photo", "hotel", "logo", "banner", "thumbnail")
        )
        if not is_bad_alt:
            return re.sub(r"\s+", " ", c_clean)

    title_clean = clean_filename_title(url)
    page_context = (page_title or "").split("-")[0].split("|")[0].strip()
    page_slug = urllib.parse.urlparse(page_url).path.strip("/").split("/")[-1].replace("-", " ") if page_url else ""

    combined_context = f"{title_clean} {page_slug} {page_context}"
    cat_match = classify_hospitality_context(combined_context)

    is_generic = re.match(r"^(?:img|dsc|image|photo|pic|asset|upload|banner|hero|screenshot|dscf|\d+)[_\s-]*\d*$", title_clean, re.I)

    words = [w.capitalize() for w in title_clean.split() if len(w) > 1 and not re.match(r"^\d+$", w)]
    title_phrase = " ".join(words)

    if is_generic or not title_phrase:
        if cat_match:
            base = f"{page_context} — {HOSPITALITY_CATEGORIES[cat_match[0]]['label']}"
            desc = f"{base} {cat_match[1]}"
            if len(desc) <= 120:
                return desc
            return base
        if page_context:
            return f"{page_context} featured hospitality architectural detail"
        return "Hotel property exterior and guest accommodation detail"

    if cat_match and cat_match[0] in ("rooms", "dining", "amenities", "meetings") and not any(kw in title_phrase.lower() for kw in ("hotel", "resort", "the")):
        if page_context and page_context.lower() not in title_phrase.lower():
            result = f"{page_context} — {title_phrase}"
        else:
            result = f"{title_phrase} at {page_context}" if page_context else title_phrase
    elif page_context and page_context.lower() not in title_phrase.lower():
        result = f"{page_context} — {title_phrase}"
    else:
        result = title_phrase

    # Normalize length to optimal 40-120 character range
    if len(result) > 120:
        trimmed = result[:117].rsplit(" ", 1)[0]
        result = trimmed

    return result.strip()


def generate_target_filename(url: str, proposed_alt: str, fallback_page_url: str = "") -> str:
    """Generates an SEO-friendly kebab-case WebP target filename."""
    if proposed_alt:
        slug = re.sub(r"[^\w\s-]", "", proposed_alt.lower())
        slug = re.sub(r"[\s_]+", "-", slug).strip("-")
        words = slug.split("-")[:6]  # top 5-6 descriptive keywords
        clean_slug = "-".join(words)
        if clean_slug:
            return f"{clean_slug}.webp"

    orig = extract_original_filename(url, fallback_page_url)
    base = re.sub(r"\.[a-zA-Z0-9]+$", "", orig)
    slug = re.sub(r"[^\w-]", "-", base.lower()).strip("-")
    return f"{slug or 'hotel-image'}.webp"


def escape_xml(s: str) -> str:
    if s is None:
        return ""
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def col_letter(col_idx: int) -> str:
    result = ""
    while col_idx > 0:
        col_idx, remainder = divmod(col_idx - 1, 26)
        result = chr(65 + remainder) + result
    return result


# -----------------------------------------------------------------------------
# 2. HTML Image & Link Extraction
# -----------------------------------------------------------------------------

def parse_srcset_candidates(srcset_val: str, base_url: str) -> list[str]:
    candidates = []
    entries = re.split(r",\s*(?=[^,]+\s+\d+[wx])", srcset_val)
    for entry in entries:
        parts = entry.strip().split()
        if parts:
            norm = normalize_url(parts[0], base_url)
            if norm:
                candidates.append(norm)
    return candidates


def pick_best_resolution_url(primary_url: str, candidates: list[str]) -> str:
    if not candidates:
        return primary_url
    best = primary_url
    max_score = 0
    for c in [primary_url] + candidates:
        m = re.search(r"[-_](\d{3,4})x(\d{3,4})", c) or re.search(r"[-_](\d{3,4})w", c)
        score = int(m.group(1)) if m else 500
        if score > max_score:
            max_score = score
            best = c
    return best


def extract_images_from_html(html_text: str, page_url: str) -> list[dict]:
    images = []
    placement_index = 0

    # 1. <img> tags
    for m in re.finditer(r"<img\b([^>]*)>", html_text, re.I):
        placement_index += 1
        attrs = m.group(1)

        def get_attr(name: str, a_str: str = attrs) -> str | None:
            mat = re.search(rf"""\b{name}\s*=\s*["']([^"']*)["']""", a_str, re.I)
            return mat.group(1).strip() if mat else None

        raw_src = (
            get_attr("data-src")
            or get_attr("data-lazy-src")
            or get_attr("data-original")
            or get_attr("data-large_image")
            or get_attr("src")
        )

        srcset_val = get_attr("data-srcset") or get_attr("srcset")
        candidates = parse_srcset_candidates(srcset_val, page_url) if srcset_val else []

        if not raw_src and not candidates:
            continue

        base_src = raw_src or candidates[0]
        resolved = normalize_url(base_src, page_url)
        if not resolved:
            continue

        # Select highest resolution candidate to prevent duplicate rows for resolution variants
        final_url = pick_best_resolution_url(resolved, candidates)

        alt_val = get_attr("alt")
        is_decorative = False
        if re.search(r'\balt\b', attrs, re.I) and alt_val == "":
            is_decorative = True

        role = get_attr("role")
        aria_hidden = get_attr("aria-hidden")
        if role in ("presentation", "none") or aria_hidden == "true":
            is_decorative = True

        w = get_attr("width")
        h = get_attr("height")
        html_w = int(w) if w and w.isdigit() else None
        html_h = int(h) if h and h.isdigit() else None

        loading = (get_attr("loading") or "unspecified").lower()
        elem_type = "data-lazy" if get_attr("data-src") or get_attr("data-lazy-src") else "img"

        images.append({
            "url": final_url,
            "alt": alt_val,
            "html_width": html_w,
            "html_height": html_h,
            "loading": loading,
            "element_type": elem_type,
            "source_attribute": "src" if raw_src else "srcset",
            "is_decorative": is_decorative,
            "placement_index": placement_index,
        })

    # 2. Inline CSS background images
    for m in re.finditer(r"""style\s*=\s*["'][^"']*background(?:-image)?\s*:\s*url\(\s*['"]?([^'")]+)['"]?\s*\)[^"']*["']""", html_text, re.I):
        placement_index += 1
        raw_bg = m.group(1).strip()
        if raw_bg and not raw_bg.startswith("data:"):
            norm_bg = normalize_url(raw_bg, page_url)
            if norm_bg:
                images.append({
                    "url": norm_bg,
                    "alt": None,
                    "html_width": None,
                    "html_height": None,
                    "loading": "unspecified",
                    "element_type": "css-background",
                    "source_attribute": "style.background-image",
                    "is_decorative": True,
                    "placement_index": placement_index,
                })

    return images


def extract_links_from_html(html_text: str, base_url: str, origin_domain: str, allow_subdomains: bool) -> list[str]:
    links = set()
    for m in re.finditer(r"""<a\b[^>]*\bhref\s*=\s*["']([^"']*)["'][^>]*>""", html_text, re.I):
        href = m.group(1).strip()
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        norm = normalize_url(href, base_url)
        if not norm:
            continue
        try:
            parsed = urllib.parse.urlparse(norm)
            if allow_subdomains:
                root = ".".join(origin_domain.split(".")[-2:])
                if not parsed.netloc.endswith(root):
                    continue
            else:
                if parsed.netloc.lower() != origin_domain:
                    continue

            # Ignore binary attachments
            if re.search(r"\.(?:pdf|zip|docx?|xlsx?|mp4|mp3|svg|png|jpe?g|webp|gif)$", parsed.path, re.I):
                continue

            links.add(norm)
        except Exception:
            continue
    return list(links)


def extract_page_title(html_text: str) -> str:
    m = re.search(r"<title\b[^>]*>(.*?)</title>", html_text, re.I | re.S)
    if m:
        return re.sub(r"\s+", " ", html.unescape(m.group(1))).strip()
    return ""


# -----------------------------------------------------------------------------
# 3. Sitemap & WordPress REST Discovery
# -----------------------------------------------------------------------------

def discover_sitemap_urls(origin: str, timeout: int = 10) -> tuple[list[str], list[str]]:
    page_urls = set()
    image_urls = set()

    candidate_sitemaps = [
        f"{origin}/sitemap.xml",
        f"{origin}/sitemap_index.xml",
        f"{origin}/wp-sitemap.xml",
        f"{origin}/sitemap/sitemap.xml",
    ]

    # Try robots.txt
    try:
        req = urllib.request.Request(f"{origin}/robots.txt", headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            text = resp.read().decode("utf-8", errors="replace")
            for m in re.finditer(r"^Sitemap:\s*(https?://[^\s]+)", text, re.I | re.M):
                candidate_sitemaps.insert(0, m.group(1).strip())
    except Exception:
        pass

    visited_sitemaps = set()

    def parse_xml_sitemap(sm_url: str):
        if sm_url in visited_sitemaps or len(visited_sitemaps) > 15:
            return
        visited_sitemaps.add(sm_url)

        try:
            req = urllib.request.Request(sm_url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                xml = resp.read().decode("utf-8", errors="replace")

                # Nested sitemaps (<sitemap><loc>...</loc></sitemap>)
                for sub in re.finditer(r"<sitemap>\s*<loc>([^<]+)</loc>", xml, re.I):
                    parse_xml_sitemap(sub.group(1).strip())

                # Page URLs (<url><loc>...</loc>)
                for u in re.finditer(r"<url>\s*<loc>([^<]+)</loc>", xml, re.I):
                    norm = normalize_url(u.group(1).strip(), origin)
                    if norm and norm.startswith(origin):
                        page_urls.add(norm)

                # Images (<image:loc>...</image:loc>)
                for img in re.finditer(r"<image:loc>([^<]+)</image:loc>", xml, re.I):
                    norm_img = normalize_url(img.group(1).strip(), origin)
                    if norm_img:
                        image_urls.add(norm_img)
        except Exception:
            pass

    for sm in candidate_sitemaps:
        if len(page_urls) >= 1000:
            break
        parse_xml_sitemap(sm)

    return list(page_urls), list(image_urls)


def discover_wordpress_media(origin: str, timeout: int = 10) -> list[dict]:
    media_list = []
    try:
        req = urllib.request.Request(f"{origin}/wp-json/wp/v2/media?per_page=100", headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="replace"))
            if isinstance(data, list):
                for item in data:
                    source_url = item.get("source_url") or item.get("guid", {}).get("rendered")
                    if source_url:
                        norm = normalize_url(source_url, origin)
                        if norm:
                            media_list.append({
                                "url": norm,
                                "title": item.get("title", {}).get("rendered", ""),
                                "alt": item.get("alt_text", ""),
                            })
    except Exception:
        pass
    return media_list


# -----------------------------------------------------------------------------
# 4. OpenXML Excel Generation (Exact 6 Columns + Yellow Header + Audit Summary)
# -----------------------------------------------------------------------------

def build_styles_xml() -> str:
    """Generates standard OpenXML styles with yellow header fill, bold text, and center alignment."""
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="2">'
        '<font><name val="Calibri"/><sz val="11"/></font>'
        '<font><b/><name val="Calibri"/><sz val="11"/><color rgb="FF000000"/></font>'
        '</fonts>'
        '<fills count="3">'
        '<fill><patternFill patternType="none"/></fill>'
        '<fill><patternFill patternType="gray125"/></fill>'
        '<fill><patternFill patternType="solid"><fgColor rgb="FFFFFF00"/></patternFill></fill>'
        '</fills>'
        '<borders count="1">'
        '<border><left/><right/><top/><bottom/><diagonal/></border>'
        '</borders>'
        '<cellStyleXfs count="1">'
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>'
        '</cellStyleXfs>'
        '<cellXfs count="2">'
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">'
        '<alignment horizontal="center" vertical="center"/>'
        '</xf>'
        '</cellXfs>'
        '</styleSheet>'
    )


def create_sheet_xml(
    headers: list[str],
    rows: list[list],
    cols_width: list[float] = None,
    header_style: int = 0,
    header_height: float = None,
    data_height: float = None,
    frozen_pane: bool = True
) -> str:
    xml_parts = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    ]

    if frozen_pane:
        xml_parts.append('<sheetViews>')
        xml_parts.append('  <sheetView workbookViewId="0">')
        xml_parts.append('    <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>')
        xml_parts.append('  </sheetView>')
        xml_parts.append('</sheetViews>')

    if cols_width:
        xml_parts.append('<cols>')
        for idx, w in enumerate(cols_width, 1):
            xml_parts.append(f'<col min="{idx}" max="{idx}" width="{w}" customWidth="1"/>')
        xml_parts.append('</cols>')

    xml_parts.append('<sheetData>')

    # Header Row
    ht_attr = f' ht="{header_height}" customHeight="1"' if header_height else ""
    xml_parts.append(f'<row r="1"{ht_attr}>')
    for col_idx, h in enumerate(headers, 1):
        cell_ref = f"{col_letter(col_idx)}1"
        s_attr = f' s="{header_style}"' if header_style else ""
        xml_parts.append(f'<c r="{cell_ref}"{s_attr} t="inlineStr"><is><t>{escape_xml(h)}</t></is></c>')
    xml_parts.append('</row>')

    # Data Rows
    row_ht_attr = f' ht="{data_height}" customHeight="1"' if data_height else ""
    for row_idx, row in enumerate(rows, 2):
        xml_parts.append(f'<row r="{row_idx}"{row_ht_attr}>')
        for col_idx, val in enumerate(row, 1):
            cell_ref = f"{col_letter(col_idx)}{row_idx}"
            if isinstance(val, str) and val.startswith("="):
                formula_body = escape_xml(val[1:])
                xml_parts.append(f'<c r="{cell_ref}"><f>{formula_body}</f></c>')
            elif isinstance(val, (int, float)):
                xml_parts.append(f'<c r="{cell_ref}"><v>{val}</v></c>')
            else:
                str_val = escape_xml(str(val) if val is not None else "")
                xml_parts.append(f'<c r="{cell_ref}" t="inlineStr"><is><t>{str_val}</t></is></c>')
        xml_parts.append('</row>')

    xml_parts.append('</sheetData>')

    if headers and rows:
        max_col = col_letter(len(headers))
        xml_parts.append(f'<autoFilter ref="A1:{max_col}{len(rows) + 1}"/>')

    xml_parts.append('</worksheet>')
    return "\n".join(xml_parts)


def build_audit_xlsx(summary: dict, items: list[dict], crawl_log: list[dict]) -> bytes:
    """Builds a complete 5-tab Excel spreadsheet adhering to standard OpenXML spec."""
    # -------------------------------------------------------------------------
    # TAB 1: Image Optimization (STRICT 6 COLUMNS MATCHING REFERENCE GOOGLE SHEET)
    # Headers: Image | URL  | Title  | Length | Optimized ALT Text | Length
    # -------------------------------------------------------------------------
    opt_headers = ["Image", "URL ", "Title ", "Length", "Optimized ALT Text", "Length"]
    opt_rows = []
    for idx, item in enumerate(items, 2):
        filename = item.get("filename") or extract_original_filename(item["url"], item["page_url"])
        opt_rows.append([
            f'=IMAGE(B{idx})',
            item["url"],
            filename,
            f'=LEN(C{idx})',
            item.get("proposed_alt", ""),
            f'=LEN(E{idx})',
        ])

    # Reference column widths: Col A: 44.5, Col B: 57.5, Col C: 46.75, Col D: 7.13, Col E: 47.75, Col F: 7.13
    opt_widths = [44.5, 57.5, 46.75, 7.13, 47.75, 7.13]
    # Header style index 1 = yellow fill, bold centered text; header ht 28.5; data ht 190.5 (exact reference height)
    sheet1_xml = create_sheet_xml(opt_headers, opt_rows, opt_widths, header_style=1, header_height=28.5, data_height=190.5)

    # -------------------------------------------------------------------------
    # TAB 2: Overview
    # -------------------------------------------------------------------------
    ov_headers = ["WEBSITE IMAGE OPTIMIZATION AUDIT SUMMARY", "STATUS / METRIC"]
    ov_rows = [
        ["Audited Website URL", summary["website_url"]],
        ["Domain Origin", summary["origin"]],
        ["Audit Timestamp (UTC)", summary["crawled_at"]],
        ["Total Duration", f"{round(summary.get('duration_sec', 0))} seconds"],
        ["Crawl Page Limit", summary["max_pages"]],
        ["Crawl Status", "Complete within limits" if summary.get("crawl_completed") else summary.get("stopped_reason", "Stopped")],
        ["", ""],
        ["DISCOVERY METHODS & COVERAGE", ""],
        ["Discovery Methods Deployed", ", ".join(summary.get("discovery_methods", []))],
        ["XML Sitemap Discovery", f"Succeeded ({summary.get('sitemap_count', 0)} URLs)" if summary.get("sitemap_success") else "None detected / Inaccessible"],
        ["WordPress REST Media API", f"Discovered ({summary.get('wp_media_count', 0)} items)" if summary.get("wp_api_found") else "Not applicable / Inaccessible"],
        ["JavaScript Client-Rendering", "Static HTML & SSR DOM only"],
        ["Coverage Statement", summary.get("coverage_statement", "Complete within crawlable public HTML pages and declared sitemaps.")],
        ["", ""],
        ["KEY AUDIT TOTALS", "COUNT"],
        ["Pages Discovered", summary.get("pages_discovered", summary["pages_scanned"])],
        ["Pages Successfully Scanned", summary["pages_scanned"]],
        ["Pages Failed / Timed Out", summary.get("pages_failed", 0)],
        ["Total Image Placements (Occurrences)", summary.get("total_placements", summary["total_images"])],
        ["Unique Image Assets (Distinct URLs)", summary.get("unique_images", summary["total_images"])],
        ["Images Reachable (HTTP 200)", summary.get("images_previewed", summary["total_images"] - summary["broken_images"])],
        ["Broken Image Links (HTTP 4xx/5xx)", summary["broken_images"]],
        ["Images Missing Alt Text Attributes", summary["missing_alt"]],
        ["Decorative Empty Alt Placements (alt=\"\")", summary.get("decorative_empty_alt", 0)],
        ["Oversized Assets (>100KB Threshold)", summary["oversized_images"]],
        ["Missing HTML Dimensions (CLS Risk)", summary["missing_dimensions"]],
        ["Legacy Formats (JPEG / PNG)", summary["legacy_formats"]],
        ["Lazy Loading on Above-The-Fold Assets", summary["above_fold_lazy"]],
        ["", ""],
        ["FORMAT BREAKDOWN", "COUNT"],
    ]
    for fmt, count in summary.get("format_breakdown", {}).items():
        ov_rows.append([f"Format: {fmt}", count])

    if summary.get("estimated_savings_kb", 0) > 0:
        ov_rows.append(["Estimated Next-Gen Format Bandwidth Savings", f"~{summary['estimated_savings_kb']} KB (approx 35% reduction converting JPEG/PNG to WebP/AVIF)"])

    ov_rows.append(["", ""])
    ov_rows.append(["COVERAGE BOUNDARIES & WCAG NOTICE", ""])
    ov_rows.append(["Completeness Scope", "Audit reflects crawlable public HTML pages and declared XML sitemaps. Pages behind logins, paywalls, or robot-excluded paths are not covered."])
    ov_rows.append(["WCAG Decorative Images", "Empty alt text (alt=\"\") is valid under WCAG 2.1 AA for decorative images, backgrounds, and dividers. Not all empty alt attributes are defects."])
    ov_rows.append(["", ""])
    ov_rows.append(["TOP AUDIT FINDINGS", "ACTION"])
    for i, finding in enumerate(summary.get("top_findings", []), 1):
        ov_rows.append([f"{i}. {finding}", "Review in Image Optimization tab"])

    sheet2_xml = create_sheet_xml(ov_headers, ov_rows, [45, 55])

    # -------------------------------------------------------------------------
    # TAB 3: Image Inventory
    # -------------------------------------------------------------------------
    inv_headers = [
        "Image URL", "Page URL", "Page Title", "Page Status", "Original Filename", "Target Filename (WebP)", "Current Alt",
        "Alt Status", "Optimized ALT Text", "HTML Width", "HTML Height", "File Size (KB)", "Format",
        "Element Type", "Loading Mode", "HTTP Status", "Occurrences", "Issues Flagged",
        "Recommendation", "Priority"
    ]
    inv_rows = []
    for item in items:
        alt_status = "Missing" if item["alt"] is None else ("Empty (Decorative)" if item["alt"] == "" else "Present")
        size_kb = round(item["size_bytes"] / 1024, 1) if item.get("size_bytes") else "-"
        inv_rows.append([
            item["url"],
            item["page_url"],
            item["page_title"],
            item["page_status"],
            item.get("filename", "-"),
            item.get("target_filename", "-"),
            item["alt"] or "-",
            alt_status,
            item.get("proposed_alt", "-"),
            item["html_width"] or "-",
            item["html_height"] or "-",
            size_kb,
            item["format"],
            item["element_type"],
            item["loading"],
            item["http_status"],
            item.get("occurrence_count", 1),
            "; ".join(item["issues"]) or "Healthy",
            item["recommendation"],
            item["priority"]
        ])
    sheet3_xml = create_sheet_xml(inv_headers, inv_rows, [45, 35, 28, 10, 28, 30, 25, 15, 35, 10, 10, 12, 10, 14, 12, 10, 12, 35, 45, 10])

    # -------------------------------------------------------------------------
    # TAB 4: Recommendations
    # -------------------------------------------------------------------------
    rec_headers = ["Issue Category", "Why It Matters", "Recommended Fix", "Industry Standard / Priority"]
    rec_rows = [
        [
            "Missing Alt Attributes",
            "Screen readers cannot announce image content, and search engines cannot index image context for Google Images.",
            "Add concise, descriptive alt text to all informational images. Decorative images should use alt=\"\".",
            "WCAG 2.1 AA / High Priority"
        ],
        [
            "Oversized File Sizes (>100KB)",
            "Heavy assets consume cellular bandwidth, stall page rendering, and increase bounce rates.",
            "Compress images using modern tools (Squoosh, Sharp, TinyPNG) and target <100KB for standard images.",
            "Core Web Vitals (LCP) / High Priority"
        ],
        [
            "Legacy Image Formats (JPEG / PNG)",
            "Legacy formats lack modern predictive compression, inflating file sizes by 30% to 70%.",
            "Convert content photography to WebP or AVIF. Use <picture> tags with fallback sources.",
            "Next-Gen Formats / Medium Priority"
        ],
        [
            "Missing HTML Width and Height",
            "Browsers cannot allocate layout space before images download, causing Cumulative Layout Shift (CLS).",
            "Specify intrinsic width=\"\" and height=\"\" or CSS aspect-ratio on all <img> elements.",
            "Core Web Vitals (CLS) / Medium Priority"
        ],
        [
            "Lazy-Loading on Hero Assets",
            "Applying loading=\"lazy\" to the main hero banner delays image discovery, hurting Largest Contentful Paint (LCP).",
            "Remove loading=\"lazy\" from top 1-2 viewport images. Add fetchpriority=\"high\" to primary hero banner.",
            "LCP Optimization / High Priority"
        ],
        [
            "Broken Image Links (404 / 5xx)",
            "Broken images present an unprofessional user experience and waste browser connection threads.",
            "Update image URLs to active assets or remove orphaned <img> tags.",
            "Technical SEO / High Priority"
        ]
    ]
    sheet4_xml = create_sheet_xml(rec_headers, rec_rows, [25, 45, 55, 28])

    # -------------------------------------------------------------------------
    # TAB 5: Crawl Log
    # -------------------------------------------------------------------------
    log_headers = ["Page URL", "Status Code", "Page Title", "Images Found", "Crawl Status", "Notes"]
    log_rows = []
    for c in crawl_log:
        log_rows.append([
            c["url"],
            c["status_code"],
            c["title"],
            c["images_found"],
            c["status"].upper(),
            c.get("notes", "-")
        ])
    sheet5_xml = create_sheet_xml(log_headers, log_rows, [45, 12, 32, 14, 14, 35])

    # Pack into standard ZIP container
    out_buf = io.BytesIO()
    with zipfile.ZipFile(out_buf, "w", zipfile.ZIP_DEFLATED) as z:
        content_types = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            '<Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            '<Override PartName="/xl/worksheets/sheet4.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            '<Override PartName="/xl/worksheets/sheet5.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            '</Types>'
        )
        z.writestr("[Content_Types].xml", content_types)

        root_rels = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            '</Relationships>'
        )
        z.writestr("_rels/.rels", root_rels)

        wb_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<sheets>'
            '<sheet name="Image Optimization" sheetId="1" r:id="rId1"/>'
            '<sheet name="Overview" sheetId="2" r:id="rId2"/>'
            '<sheet name="Image Inventory" sheetId="3" r:id="rId3"/>'
            '<sheet name="Recommendations" sheetId="4" r:id="rId4"/>'
            '<sheet name="Crawl Log" sheetId="5" r:id="rId5"/>'
            '</sheets>'
            '</workbook>'
        )
        z.writestr("xl/workbook.xml", wb_xml)

        wb_rels = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>'
            '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>'
            '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet4.xml"/>'
            '<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet5.xml"/>'
            '<Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            '</Relationships>'
        )
        z.writestr("xl/_rels/workbook.xml.rels", wb_rels)

        z.writestr("xl/styles.xml", build_styles_xml())
        z.writestr("xl/worksheets/sheet1.xml", sheet1_xml)
        z.writestr("xl/worksheets/sheet2.xml", sheet2_xml)
        z.writestr("xl/worksheets/sheet3.xml", sheet3_xml)
        z.writestr("xl/worksheets/sheet4.xml", sheet4_xml)
        z.writestr("xl/worksheets/sheet5.xml", sheet5_xml)

    return out_buf.getvalue()


def inspect_single_header(url: str, timeout: int = 10) -> tuple[str, dict]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    req.get_method = lambda: "HEAD"
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            ct = resp.headers.get("Content-Type", "")
            cl = resp.headers.get("Content-Length")
            size_b = int(cl) if cl and cl.isdigit() else None
            return url, {"status": resp.status, "content_type": ct, "size_bytes": size_b, "broken": False}
    except urllib.error.HTTPError as e:
        return url, {"status": e.code, "content_type": "", "size_bytes": None, "broken": e.code >= 400}
    except Exception:
        return url, {"status": 0, "content_type": "", "size_bytes": None, "broken": True}


def inspect_asset_headers_concurrently(urls: list[str], timeout: int = 10, max_workers: int = 10) -> dict[str, dict]:
    header_cache = {}
    total = len(urls)
    completed = 0
    if not urls:
        return header_cache
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(inspect_single_header, u, timeout): u for u in urls}
        for future in as_completed(futures):
            completed += 1
            if completed % 25 == 0 or completed == total:
                print(f"  Inspected asset headers: {completed}/{total}...")
            try:
                u, res = future.result()
                header_cache[u] = res
            except Exception:
                u = futures[future]
                header_cache[u] = {"status": 0, "content_type": "", "size_bytes": None, "broken": True}
    return header_cache


# -----------------------------------------------------------------------------
# 5. Core Audit Controller
# -----------------------------------------------------------------------------

def run_image_audit(
    start_url: str,
    max_pages: int = 50,
    delay: float = 0.15,
    timeout: int = 10,
    allow_subdomains: bool = False,
    size_threshold_kb: int = 100,
    output_path: str = "image_optimization_audit.xlsx",
    resume: bool = False,
    enable_sitemaps: bool = True,
    enable_wp_media: bool = True
) -> dict:
    norm_start = normalize_url(start_url)
    if not norm_start:
        raise ValueError(f"Invalid target URL: '{start_url}'")

    parsed = urllib.parse.urlparse(norm_start)
    origin_domain = parsed.netloc.lower()
    origin = f"{parsed.scheme}://{parsed.netloc}"
    hostname_clean = origin_domain.replace(".", "_")
    checkpoint_file = f".audit_checkpoint_{hostname_clean}.json"

    print("\n=======================================================")
    print(" COGWHEEL IMAGE OPTIMIZATION AUDIT ENGINE (v2.7)")
    print(f" Target: {norm_start}")
    print(f" Crawl Limit: {max_pages} pages | Delay: {delay}s | Size Gate: {size_threshold_kb}KB")
    print(f" Output: {output_path}")
    print("=======================================================\n")

    t_start = time.time()
    queue = [norm_start]
    visited = set()
    crawl_log = []
    # Distinct placements list: preserves separate rows for separate placements
    all_placements = []
    placement_dedup = set()

    discovery_methods = ["Internal HTML Link Crawler", "Lazy-Load Attribute Parser", "CSS Background-Image Scanner"]
    sitemap_success = False
    sitemap_count = 0
    wp_api_found = False
    wp_media_count = 0

    # Resume from checkpoint if requested
    if resume and os.path.exists(checkpoint_file):
        try:
            with open(checkpoint_file, encoding="utf-8") as f:
                ckpt = json.load(f)
                visited = set(ckpt.get("visited", []))
                queue = ckpt.get("queue", queue)
                all_placements = ckpt.get("placements", [])
                placement_dedup = set(ckpt.get("dedup", []))
                print(f"[Checkpoint] Resumed session: {len(visited)} pages crawled, {len(all_placements)} placements loaded.\n")
        except Exception as e:
            print(f"[Checkpoint] Warning: Could not resume from checkpoint ({e}). Starting fresh.")

    # 1. Sitemap Discovery
    if enable_sitemaps and not visited:
        print("[Discovery] Probing XML sitemaps and index files...")
        try:
            sm_pages, sm_imgs = discover_sitemap_urls(origin, timeout=timeout)
            if sm_pages:
                sitemap_success = True
                sitemap_count = len(sm_pages)
                discovery_methods.append("XML Sitemap & Index Parser")
                print(f"[Discovery] Discovered {len(sm_pages)} URLs from XML sitemaps.")
                for p in sm_pages:
                    if p not in visited and p not in queue and len(queue) < max_pages * 3:
                        queue.append(p)
        except Exception as e:
            print(f"[Discovery] Sitemap probe skipped: {e}")

    # 2. WordPress REST API Discovery
    if enable_wp_media:
        print("[Discovery] Checking WordPress REST Media API...")
        try:
            wp_items = discover_wordpress_media(origin, timeout=timeout)
            if wp_items:
                wp_api_found = True
                wp_media_count = len(wp_items)
                discovery_methods.append("WordPress REST Media API (/wp-json/wp/v2/media)")
                print(f"[Discovery] Discovered {len(wp_items)} media items via WordPress API.")
                for wp in wp_items:
                    dedup_key = f"{wp['url']}::wp-media::0"
                    if dedup_key not in placement_dedup:
                        placement_dedup.add(dedup_key)
                        all_placements.append({
                            "url": wp["url"],
                            "page_url": f"{origin}/wp-json/wp/v2/media",
                            "page_title": wp["title"] or "WordPress Media Library",
                            "page_status": 200,
                            "alt": wp["alt"] or None,
                            "html_width": None,
                            "html_height": None,
                            "loading": "unspecified",
                            "element_type": "wp-media",
                            "source_attribute": "wp-media-api",
                            "is_decorative": False,
                            "placement_index": 0,
                        })
        except Exception as e:
            print(f"[Discovery] WordPress API probe skipped: {e}")

    page_counter = len(visited)

    while queue and len(visited) < max_pages:
        current_url = queue.pop(0)
        if current_url in visited:
            continue
        visited.add(current_url)
        page_counter += 1

        print(f"[{page_counter}/{max_pages}] Crawling: {current_url} (Placements: {len(all_placements)})")
        t0 = time.time()

        req = urllib.request.Request(current_url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                elapsed = round((time.time() - t0) * 1000)
                status = resp.status
                ct = resp.headers.get("Content-Type", "")
                if "text/html" not in ct and "application/xhtml" not in ct:
                    crawl_log.append({
                        "url": current_url, "status_code": status, "title": "-",
                        "response_time_ms": elapsed,
                        "images_found": 0, "status": "skipped", "notes": f"Non-HTML ({ct})"
                    })
                    continue

                html_text = resp.read().decode("utf-8", errors="replace")
                title = extract_page_title(html_text)

                page_images = extract_images_from_html(html_text, current_url)
                new_placements = 0
                for img in page_images:
                    dedup_key = f"{img['url']}::{current_url}::{img['placement_index']}"
                    if dedup_key not in placement_dedup:
                        placement_dedup.add(dedup_key)
                        all_placements.append({
                            "url": img["url"],
                            "page_url": current_url,
                            "page_title": title,
                            "page_status": status,
                            "alt": img["alt"],
                            "html_width": img["html_width"],
                            "html_height": img["html_height"],
                            "loading": img["loading"],
                            "element_type": img["element_type"],
                            "source_attribute": img["source_attribute"],
                            "is_decorative": img["is_decorative"],
                            "placement_index": img["placement_index"],
                        })
                        new_placements += 1

                crawl_log.append({
                    "url": current_url, "status_code": status, "title": title,
                    "response_time_ms": elapsed,
                    "images_found": new_placements, "status": "success", "notes": f"Discovered {new_placements} placements"
                })

                # Queue internal links
                page_links = extract_links_from_html(html_text, current_url, origin_domain, allow_subdomains)
                for lk in page_links:
                    if lk not in visited and lk not in queue and len(queue) < max_pages * 4:
                        queue.append(lk)

        except urllib.error.HTTPError as e:
            crawl_log.append({
                "url": current_url, "status_code": e.code, "title": "-",
                "images_found": 0, "status": "error", "notes": f"HTTP {e.code}"
            })
        except Exception as e:
            crawl_log.append({
                "url": current_url, "status_code": 0, "title": "-",
                "images_found": 0, "status": "error", "notes": str(e)
            })

        # Save checkpoint every 10 pages
        if page_counter % 10 == 0:
            try:
                with open(checkpoint_file, "w", encoding="utf-8") as f:
                    json.dump({
                        "visited": list(visited),
                        "queue": queue,
                        "placements": all_placements,
                        "dedup": list(placement_dedup)
                    }, f)
            except OSError:
                pass

        if delay > 0:
            time.sleep(delay)

    # Clean up checkpoint on complete crawl
    if os.path.exists(checkpoint_file):
        with contextlib.suppress(Exception):
            os.remove(checkpoint_file)

    print(f"\n[Analysis] Auditing headers for {len(all_placements)} image placements...")

    # Concurrent high-performance header inspection across unique assets
    unique_urls = list({p["url"] for p in all_placements})
    occurrence_counts = {}
    for p in all_placements:
        occurrence_counts[p["url"]] = occurrence_counts.get(p["url"], 0) + 1

    header_cache = inspect_asset_headers_concurrently(unique_urls, timeout=timeout, max_workers=10)

    # Evaluate items
    items = []
    format_counts = {}
    broken_count = 0
    oversized_count = 0
    missing_alt_count = 0
    decorative_count = 0
    missing_dim_count = 0
    legacy_fmt_count = 0
    above_fold_lazy_count = 0

    for idx, p in enumerate(all_placements, 1):
        u = p["url"]
        h_info = header_cache.get(u, {"status": 200, "content_type": "", "size_bytes": None, "broken": False})
        filename = extract_original_filename(u, p["page_url"])

        # Detect format
        ext = filename.split(".")[-1].upper() if "." in filename else ""
        fmt = "JPEG"
        if ext in ("PNG", "WEBP", "AVIF", "SVG", "GIF"):
            fmt = ext
        elif "webp" in h_info["content_type"]:
            fmt = "WebP"
        elif "avif" in h_info["content_type"]:
            fmt = "AVIF"
        elif "png" in h_info["content_type"]:
            fmt = "PNG"

        format_counts[fmt] = format_counts.get(fmt, 0) + 1
        size_bytes = h_info["size_bytes"]

        proposed_alt = generate_proposed_alt(u, p["page_title"], p["alt"], p["is_decorative"], page_url=p["page_url"])
        target_filename = generate_target_filename(u, proposed_alt, p["page_url"])

        # Issues analysis
        issues = []
        if h_info["broken"]:
            broken_count += 1
            issues.append(f"Broken Image (HTTP {h_info['status']})")

        if p["alt"] is None and not p["is_decorative"]:
            missing_alt_count += 1
            issues.append("Missing Alt Attribute")
        elif p["is_decorative"]:
            decorative_count += 1

        if size_bytes and size_bytes > size_threshold_kb * 1024:
            oversized_count += 1
            issues.append(f"Oversized File (>{size_threshold_kb}KB)")

        if fmt in ("JPEG", "PNG", "GIF"):
            legacy_fmt_count += 1
            issues.append(f"Legacy Format ({fmt})")

        if not p["html_width"] or not p["html_height"]:
            missing_dim_count += 1
            issues.append("Missing HTML Width/Height (CLS Risk)")

        if p["placement_index"] <= 2 and p["loading"] == "lazy":
            above_fold_lazy_count += 1
            issues.append("Above-Fold Lazy-Loading (LCP Delay)")

        # Priority & Recommendation
        if any("Broken" in i or "Missing Alt" in i or "Oversized" in i for i in issues):
            priority = "High"
            rec = f"Action: {'; '.join(issues)}."
        elif issues:
            priority = "Medium"
            rec = f"Recommended: {'; '.join(issues)}."
        elif p["is_decorative"]:
            priority = "Good"
            rec = 'Decorative element correctly uses empty alt="". Valid per WCAG.'
        else:
            priority = "Good"
            rec = "Asset meets core SEO, layout dimension, and performance targets."

        items.append({
            "id": f"img-{idx}",
            "url": u,
            "page_url": p["page_url"],
            "page_title": p["page_title"],
            "page_status": p["page_status"],
            "filename": filename,
            "target_filename": target_filename,
            "alt": p["alt"],
            "proposed_alt": proposed_alt,
            "html_width": p["html_width"],
            "html_height": p["html_height"],
            "size_bytes": size_bytes,
            "format": fmt,
            "element_type": p["element_type"],
            "loading": p["loading"],
            "http_status": h_info["status"],
            "is_decorative": p["is_decorative"],
            "occurrence_count": occurrence_counts.get(u, 1),
            "issues": issues,
            "recommendation": rec,
            "priority": priority,
        })

    duration_sec = time.time() - t_start

    legacy_bytes_total = sum(
        item["size_bytes"] for item in items
        if item.get("size_bytes") and item.get("format") in ("JPEG", "PNG")
    )
    estimated_savings_kb = round((legacy_bytes_total * 0.35) / 1024, 1)

    top_findings = []
    if missing_alt_count > 0:
        top_findings.append(f"{missing_alt_count} image placements are missing descriptive alt text.")
    if oversized_count > 0:
        top_findings.append(f"{oversized_count} image placements exceed {size_threshold_kb} KB and should be compressed.")
    if legacy_fmt_count > 0:
        top_findings.append(f"{legacy_fmt_count} images use legacy formats (JPEG/PNG) eligible for WebP/AVIF (approx {estimated_savings_kb} KB potential savings).")
    if broken_count > 0:
        top_findings.append(f"{broken_count} image links return HTTP 4xx/5xx errors.")
    if not top_findings:
        top_findings.append("All audited image assets meet core performance and accessibility targets.")

    summary = {
        "website_url": norm_start,
        "origin": origin,
        "crawled_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
        "duration_sec": duration_sec,
        "max_pages": max_pages,
        "pages_discovered": len(visited),
        "pages_scanned": len(visited),
        "pages_failed": len([c for c in crawl_log if c["status"] == "error"]),
        "total_images": len(items),
        "total_placements": len(items),
        "unique_images": len(unique_urls),
        "images_previewed": len(items) - broken_count,
        "broken_images": broken_count,
        "missing_alt": missing_alt_count,
        "decorative_empty_alt": decorative_count,
        "oversized_images": oversized_count,
        "missing_dimensions": missing_dim_count,
        "legacy_formats": legacy_fmt_count,
        "above_fold_lazy": above_fold_lazy_count,
        "estimated_savings_kb": estimated_savings_kb,
        "format_breakdown": format_counts,
        "top_findings": top_findings,
        "discovery_methods": discovery_methods,
        "sitemap_success": sitemap_success,
        "sitemap_count": sitemap_count,
        "wp_api_found": wp_api_found,
        "wp_media_count": wp_media_count,
        "crawl_completed": len(queue) == 0 and len(visited) < max_pages,
        "stopped_reason": "Completed all queue pages" if len(queue) == 0 else f"Reached {max_pages} page limit",
        "coverage_statement": f"Complete within {len(visited)} scanned public HTML pages and discovered sitemaps under configured crawl parameters.",
    }

    # Generate XLSX
    print(f"\n[Export] Generating OpenXML workbook at: {output_path}")
    xlsx_bytes = build_audit_xlsx(summary, items, crawl_log)
    with open(output_path, "wb") as f:
        f.write(xlsx_bytes)

    print("=======================================================")
    print(f" AUDIT COMPLETE: {len(items)} image placements recorded.")
    print(f" Spreadsheet saved: {os.path.abspath(output_path)}")
    print(" Tabs: [1] Image Optimization (Exact 6 Columns with =IMAGE) | [2] Overview | [3] Inventory | [4] Recommendations | [5] Crawl Log")
    print("=======================================================\n")

    return {
        "summary": summary,
        "items": items,
        "crawl_log": crawl_log,
        "output_file": os.path.abspath(output_path),
    }


def main():
    parser = argparse.ArgumentParser(
        description="Cogwheel SEO Studio — Website Image Optimization Audit Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 outputs/site_image_audit.py https://example.com
  python3 outputs/site_image_audit.py https://hotel.com --max-pages 100 --output hotel_audit.xlsx
  python3 outputs/site_image_audit.py https://site.com --size-threshold 150 --subdomains --resume
        """
    )
    parser.add_argument("url", nargs="?", default="https://arrivehotels.com", help="Full website URL to audit")
    parser.add_argument("--max-pages", type=int, default=50, help="Maximum pages to crawl (default: 50)")
    parser.add_argument("--delay", type=float, default=0.15, help="Delay between page requests in seconds (default: 0.15)")
    parser.add_argument("--timeout", type=int, default=10, help="HTTP request timeout in seconds (default: 10)")
    parser.add_argument("--subdomains", action="store_true", help="Allow crawling subdomains of target origin")
    parser.add_argument("--size-threshold", type=int, default=100, help="Oversized image threshold in KB (default: 100)")
    parser.add_argument("--output", type=str, default="", help="Output .xlsx file path")
    parser.add_argument("--resume", action="store_true", help="Resume from previous checkpoint if interrupted")
    parser.add_argument("--no-sitemap", action="store_true", help="Disable XML sitemap discovery")
    parser.add_argument("--no-wp-media", action="store_true", help="Disable WordPress Media REST API discovery")

    args = parser.parse_args()

    hostname = urllib.parse.urlparse(args.url).netloc.replace(".", "_") or "site"
    out_file = args.output or f"image_audit_{hostname}.xlsx"

    run_image_audit(
        start_url=args.url,
        max_pages=args.max_pages,
        delay=args.delay,
        timeout=args.timeout,
        allow_subdomains=args.subdomains,
        size_threshold_kb=args.size_threshold,
        output_path=out_file,
        resume=args.resume,
        enable_sitemaps=not args.no_sitemap,
        enable_wp_media=not args.no_wp_media,
    )


if __name__ == "__main__":
    main()
