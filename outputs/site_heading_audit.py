#!/usr/bin/env python3
"""
Cogwheel SEO & Hospitality Templates Studio
Heading Structure Optimization Audit Tool (CLI & Automation Engine)

Crawls all public pages of a website (default: https://thenines.com/), audits heading
hierarchies in document order (H1 through H6, styled text), identifies missing H1s,
multiple H1s, skipped levels, and unrendered template placeholders, and outputs an
Excel workbook matching the reference layout:
https://docs.google.com/spreadsheets/d/1W_kydZFwQPl3qQ4Aybrh9JvQ1dXPG2-M/

Tabs generated:
  1. Heading Optimization  — Exact reference structure: Page URL | Keyword | Old Headline |
                             Old Heading Level | New Headline (optimized) | New Heading Level
                             with yellow table headers and green recommendation highlights
  2. Audit Summary        — Comprehensive crawl metrics, heading breakdown, and coverage statements
  3. Hierarchy Analysis   — Technical tabular inventory of every heading element
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
from datetime import datetime

USER_AGENT = "Mozilla/5.0 (compatible; CogwheelHeadingAudit/2.8; +https://cogwheel-seo-templates.vercel.app)"


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
        # Remove tracking parameters
        query_params = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
        for trk in ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"]:
            query_params.pop(trk, None)
        new_query = urllib.parse.urlencode(query_params, doseq=True)
        cleaned = urllib.parse.urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, ""))
        return cleaned
    except Exception:
        return None


def to_title_case(text: str) -> str:
    if not text:
        return ""
    small_words = {"a", "an", "and", "as", "at", "but", "by", "for", "if", "in", "nor", "of", "on", "or", "so", "the", "to", "up", "yet", "with"}
    words = text.strip().split()
    result = []
    for i, w in enumerate(words):
        lw = w.lower()
        if lw in ("rfp", "faq", "faqs", "h1", "h2", "h3", "h4"):
            result.append(w.upper())
        elif i == 0 or i == len(words) - 1 or lw not in small_words:
            result.append(w.capitalize())
        else:
            result.append(lw)
    return " ".join(result)


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


def classify_page_url(url_str: str) -> tuple[str, str]:
    try:
        path = urllib.parse.urlparse(url_str).path.lower().strip("/")
        if not path:
            return "HOME PAGE", "Home Page"
        if "accommodation" in path or "room" in path or "suite" in path:
            slug = path.split("/")[-1]
            return "Accommodations", to_title_case(slug.replace("-", " "))
        if "dining" in path or "restaurant" in path or "departure" in path or "urban-farmer" in path:
            slug = path.split("/")[-1]
            return "DINING", to_title_case(slug.replace("-", " "))
        if "gather" in path or "meeting" in path or "event" in path or "wedding" in path or "rfp" in path:
            slug = path.split("/")[-1]
            return "MEETING & EVENTS", to_title_case(slug.replace("-", " "))
        if "experience" in path or "amenit" in path or "art" in path or "history" in path or "pet" in path:
            slug = path.split("/")[-1]
            return "EXPERIENCE", to_title_case(slug.replace("-", " "))
        if "offer" in path or "package" in path:
            slug = path.split("/")[-1]
            return "Offers & Packages", to_title_case(slug.replace("-", " "))
        if "blog" in path or "gallery" in path or "faq" in path or "calendar" in path:
            slug = path.split("/")[-1]
            return "DISCOVER", to_title_case(slug.replace("-", " "))
        slug = path.split("/")[-1]
        return "General Pages", to_title_case(slug.replace("-", " "))
    except Exception:
        return "General Pages", "Page"


def derive_target_keyword(url_str: str, page_title: str) -> str:
    path = urllib.parse.urlparse(url_str).path.lower().strip("/")
    if not path:
        return "Downtown Portland Hotels"
    # The Nines Reference Mapping
    if "one-bedroom-suite" in path:
        return "One Bedroom Suite Downtown Portland"
    if "deluxe-room" in path:
        return "Deluxe Rooms Downtown Portland"
    if "studio-suite" in path:
        return "Studio Hotel Suite Portland"
    if "the-nines-suite" in path:
        return "Luxury Suite Downtown Portland"
    if "superior-room" in path:
        return "Superior Hotel Rooms Portland"
    if "meier-frank-suite" in path:
        return "Meier & Frank Historic Suite"
    if "experience-portland" in path:
        return "Things To Do In Downtown Portland"
    if "amenities" in path:
        return "Downtown Portland Hotel Amenities"
    if "art" in path:
        return "Curated Hotel Art Collection Portland"
    if "the-history-of-the-nines" in path:
        return "Historic Meier & Frank Building Portland"
    if "offers-packages" in path:
        return "Portland Hotel Deals & Vacation Packages"
    if "urban-farmer" in path:
        return "Steakhouse In Portland: Urban Farmer"
    if "departure" in path:
        return "Rooftop Restaurant In Portland: Departure"
    if "in-room-dining" in path:
        return "Portland Luxury In-Room Dining"
    if "dining" in path:
        return "Downtown Portland Restaurants At The Nines"
    if "gather" in path:
        return "Downtown Portland Meeting & Event Spaces"
    if "meetings" in path:
        return "Portland Conference & Meeting Venues"
    if "weddings" in path:
        return "Luxury Portland Wedding Venue"
    if "event-rfp-submission" in path:
        return "Portland Event Venue RFP Submission"
    if "blogs" in path:
        return "Portland Travel Blog & Stories"
    if "events-calendar" in path:
        return "Downtown Portland Events Calendar"
    if "frequently-asked-questions" in path:
        return "The Nines Portland Hotel FAQs"
    if "gallery" in path:
        return "The Nines Hotel Photo Gallery"

    clean_t = re.sub(r"\s*[-|–|—]\s*.*$", "", page_title).strip()
    if clean_t:
        return f"{to_title_case(clean_t)} Portland"
    slug = path.split("/")[-1]
    return f"{to_title_case(slug.replace('-', ' '))} Portland"


# -----------------------------------------------------------------------------
# 2. Heading Extraction & Optimization
# -----------------------------------------------------------------------------

def extract_headings_from_html(html_text: str) -> list[dict]:
    headings = []
    # Match <h1..h6>
    for m in re.finditer(r"<(h[1-6])\b[^>]*>(.*?)</\1>", html_text, re.I | re.S):
        tag = m.group(1).upper()
        raw_inner = m.group(2)
        # Strip internal tags and normalize
        clean_text = re.sub(r"<[^>]+>", " ", raw_inner)
        clean_text = html.unescape(clean_text)
        clean_text = re.sub(r"\s+", " ", clean_text).strip()
        headings.append({"tag": tag, "text": clean_text})

    # If very few headings found, also check for prominent styled headers
    if len(headings) < 4:
        for m in re.finditer(r"""<(?:div|span|p)\b[^>]*class=["'][^"']*(?:title|heading|caption)[^"']*["'][^>]*>(.*?)</(?:div|span|p)>""", html_text, re.I | re.S):
            clean_text = re.sub(r"<[^>]+>", " ", m.group(1))
            clean_text = html.unescape(clean_text).strip()
            if 3 < len(clean_text) < 70 and not any(h["text"].lower() == clean_text.lower() for h in headings):
                headings.append({"tag": "TEXT", "text": clean_text})

    return headings


def analyze_and_optimize_page(raw_headings: list[dict], page_url: str, page_title: str) -> dict:
    target_keyword = derive_target_keyword(page_url, page_title)
    is_home = urllib.parse.urlparse(page_url).path in ("", "/")

    headings = []
    h1_count = 0
    h2_count = 0
    h3_count = 0
    h4_count = 0
    has_skipped = False
    page_issues = []

    current_level = 0
    primary_h1_found = False

    for idx, raw in enumerate(raw_headings):
        tag = raw["tag"]
        txt = raw["text"]
        level_num = 0 if tag == "TEXT" else int(tag[1])

        item_issues = []

        if not txt:
            item_issues.append("Empty Heading")

        if "+page.title+" in txt or "{{" in txt or "${" in txt:
            item_issues.append("Unrendered Template Variable")

        if len(txt) > 5 and txt == txt.upper() and re.search(r"[A-Z]", txt):
            item_issues.append("All-Caps Coding")

        if re.match(r"^(?:check availability|menu|navigation|search|book now|quick links|footer)$", txt, re.I):
            item_issues.append("Widget / Non-Content Heading")

        if tag == "H1":
            h1_count += 1
            if primary_h1_found:
                item_issues.append("Multiple H1")
        elif tag == "H2":
            h2_count += 1
        elif tag == "H3":
            h3_count += 1
        elif tag in ("H4", "H5", "H6"):
            h4_count += 1

        if level_num > 1 and not primary_h1_found and not item_issues:
            item_issues.append(f"Inverted Order ({tag} before H1)")

        if current_level > 0 and level_num > current_level + 1 and not item_issues:
            has_skipped = True
            item_issues.append(f"Skipped Level (H{current_level} -> H{level_num})")

        if tag == "H1":
            primary_h1_found = True
        if level_num > 0:
            current_level = level_num

        # Optimization
        clean_txt = to_title_case(txt)
        if "+page.title+" in clean_txt:
            slug = urllib.parse.urlparse(page_url).path.strip("/").split("/")[-1] or "Overview"
            clean_txt = to_title_case(slug.replace("-", " "))

        opt_level = tag
        opt_text = clean_txt

        if idx == 0 or (tag == "H1" and not any(h["opt_level"] == "H1" for h in headings)):
            opt_level = "H1"
            if is_home:
                opt_text = f"{target_keyword} | Dressed To The Nines"
            elif target_keyword.lower() not in opt_text.lower():
                opt_text = f"{clean_txt} | {target_keyword}"
        elif tag == "H1":
            opt_level = "H2"
        elif tag == "TEXT":
            opt_level = "H2" if idx <= 2 else "H3"
        elif tag == "H3" and idx <= 3 and current_level <= 1:
            opt_level = "H2"

        headings.append({
            "id": f"h-{idx+1}",
            "tag": tag,
            "text": txt,
            "opt_text": opt_text,
            "opt_level": opt_level,
            "issues": item_issues,
        })

    if h1_count == 0:
        page_issues.append("Missing <h1> element on page.")
        if headings:
            headings[0]["opt_level"] = "H1"
            headings[0]["opt_text"] = f"{target_keyword} | Dressed To The Nines" if is_home else f"{target_keyword} — {to_title_case(headings[0]['text'] or 'Overview')}"

    if h1_count > 1:
        page_issues.append(f"Found {h1_count} separate <h1> tags (consolidated to 1).")

    if has_skipped:
        page_issues.append("Page skips heading levels in document order.")

    rec_summary = "Heading hierarchy is logical." if not page_issues else " ".join(page_issues)

    return {
        "headings": headings,
        "h1_count": h1_count,
        "h2_count": h2_count,
        "h3_count": h3_count,
        "h4_count": h4_count,
        "has_skipped": has_skipped,
        "issues": page_issues,
        "rec_summary": rec_summary,
        "target_keyword": target_keyword,
    }


# -----------------------------------------------------------------------------
# 3. OpenXML Spreadsheet Generator (Exact Match to Reference Sheet)
# -----------------------------------------------------------------------------

def build_heading_styles_xml() -> str:
    """Generates OpenXML styles with yellow header, soft green recommendations, and blue category fills."""
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="5">'
        '<font><name val="Source Sans 3"/><sz val="11"/></font>'
        '<font><b/><name val="Source Sans 3"/><sz val="11"/><color rgb="FF000000"/></font>'
        '<font><b/><name val="Source Sans 3"/><sz val="14"/><color rgb="FF000000"/></font>'
        '<font><b/><name val="Source Sans 3"/><sz val="18"/><color rgb="FFFFFFFF"/></font>'
        '<font><name val="Source Sans 3"/><sz val="11"/><color rgb="FF1155CC"/></font>'
        '</fonts>'
        '<fills count="5">'
        '<fill><patternFill patternType="none"/></fill>'
        '<fill><patternFill patternType="gray125"/></fill>'
        '<fill><patternFill patternType="solid"><fgColor rgb="FFFFE599"/></patternFill></fill>'  # 2: Yellow table header
        '<fill><patternFill patternType="solid"><fgColor rgb="FFB6D7A8"/></patternFill></fill>'  # 3: Soft green recommendation
        '<fill><patternFill patternType="solid"><fgColor rgb="FF4A86E8"/></patternFill></fill>'  # 4: Blue category banner
        '</fills>'
        '<borders count="1">'
        '<border><left/><right/><top/><bottom/><diagonal/></border>'
        '</borders>'
        '<cellStyleXfs count="1">'
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>'
        '</cellStyleXfs>'
        '<cellXfs count="5">'
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'  # 0: Standard data
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>'  # 1: Yellow header
        '<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>'  # 2: Green recommendation
        '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>'  # 3: Page Subheader (14pt bold)
        '<xf numFmtId="0" fontId="3" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>'  # 4: Blue category banner (18pt bold white)
        '</cellXfs>'
        '</styleSheet>'
    )


def create_heading_sheet_xml(pages: list[dict]) -> str:
    xml_parts = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    ]

    # Exact Column Widths from Reference Sheet
    col_widths = [32.0, 32.38, 31.25, 16.0, 32.13, 16.25]
    xml_parts.append('<cols>')
    for idx, w in enumerate(col_widths, 1):
        xml_parts.append(f'<col min="{idx}" max="{idx}" width="{w}" customWidth="1"/>')
    xml_parts.append('</cols>')

    xml_parts.append('<sheetData>')

    current_row = 1
    page_counter = 1
    last_category = None

    for page in pages:
        cat = page["category"]
        subcat = page["subCategory"]

        # Category Banner if new category
        if cat != last_category and cat != "General Pages":
            last_category = cat
            xml_parts.append(f'<row r="{current_row}" ht="28" customHeight="1">')
            xml_parts.append(f'<c r="A{current_row}" s="4" t="inlineStr"><is><t>{escape_xml(cat.upper())}</t></is></c>')
            xml_parts.append('</row>')
            current_row += 1

        # Page Subheader (e.g. "1. HOME PAGE - " or "Overview - ")
        xml_parts.append(f'<row r="{current_row}" ht="22" customHeight="1">')
        page_title_str = f"{page_counter}. {subcat.upper()} - " if page_counter == 1 else f"{subcat} - "
        xml_parts.append(f'<c r="A{current_row}" s="3" t="inlineStr"><is><t>{escape_xml(page_title_str)}</t></is></c>')
        xml_parts.append('</row>')
        current_row += 1

        # Table Header Row (Yellow fill s="1")
        xml_parts.append(f'<row r="{current_row}" ht="20" customHeight="1">')
        headers = ["Page URL", "Keyword ", "Old Headline", "Old Heading Level", "New Headline (optimized)", "New Heading Level"]
        for c_idx, h in enumerate(headers, 1):
            col_l = col_letter(c_idx)
            xml_parts.append(f'<c r="{col_l}{current_row}" s="1" t="inlineStr"><is><t>{escape_xml(h)}</t></is></c>')
        xml_parts.append('</row>')
        current_row += 1

        # Headings Rows
        headings = page["analysis"]["headings"]
        if not headings:
            xml_parts.append(f'<row r="{current_row}">')
            xml_parts.append(f'<c r="A{current_row}" t="inlineStr"><is><t>{escape_xml(page["url"])}</t></is></c>')
            xml_parts.append(f'<c r="B{current_row}" t="inlineStr"><is><t>{escape_xml(page["analysis"]["target_keyword"])}</t></is></c>')
            xml_parts.append(f'<c r="C{current_row}" t="inlineStr"><is><t>[No Headings Found]</t></is></c>')
            xml_parts.append(f'<c r="D{current_row}" t="inlineStr"><is><t>NONE</t></is></c>')
            xml_parts.append(f'<c r="E{current_row}" s="2" t="inlineStr"><is><t>{escape_xml(page["analysis"]["target_keyword"])} | Dressed To The Nines</t></is></c>')
            xml_parts.append(f'<c r="F{current_row}" s="2" t="inlineStr"><is><t>H1</t></is></c>')
            xml_parts.append('</row>')
            current_row += 1
        else:
            for h_idx, h in enumerate(headings):
                xml_parts.append(f'<row r="{current_row}">')
                if h_idx == 0:
                    xml_parts.append(f'<c r="A{current_row}" t="inlineStr"><is><t>{escape_xml(page["url"])}</t></is></c>')
                    xml_parts.append(f'<c r="B{current_row}" t="inlineStr"><is><t>{escape_xml(page["analysis"]["target_keyword"])}</t></is></c>')
                xml_parts.append(f'<c r="C{current_row}" t="inlineStr"><is><t>{escape_xml(h["text"])}</t></is></c>')
                xml_parts.append(f'<c r="D{current_row}" t="inlineStr"><is><t>{escape_xml(h["tag"])}</t></is></c>')
                # Cols E & F styled with green recommendation fill (s="2")
                xml_parts.append(f'<c r="E{current_row}" s="2" t="inlineStr"><is><t>{escape_xml(h["opt_text"])}</t></is></c>')
                xml_parts.append(f'<c r="F{current_row}" s="2" t="inlineStr"><is><t>{escape_xml(h["opt_level"])}</t></is></c>')
                xml_parts.append('</row>')
                current_row += 1

        # Blank Row between pages
        xml_parts.append(f'<row r="{current_row}"></row>')
        current_row += 1
        page_counter += 1

    xml_parts.append('</sheetData>')
    xml_parts.append('</worksheet>')
    return "\n".join(xml_parts)


def create_summary_sheet_xml(summary: dict) -> str:
    xml_parts = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        '<cols><col min="1" max="1" width="45" customWidth="1"/><col min="2" max="2" width="60" customWidth="1"/></cols>',
        '<sheetData>',
    ]

    rows = [
        ["WEBSITE HEADING STRUCTURE OPTIMIZATION AUDIT SUMMARY", ""],
        ["Generated By:", "Cogwheel SEO & Hospitality Templates Studio (Razib Marketing)"],
        ["Audited Website URL:", summary["website_url"]],
        ["Origin Domain:", summary["origin"]],
        ["Audit Timestamp (UTC):", summary["audited_at"]],
        ["Total Duration:", f"{round(summary.get('duration_sec', 0))} seconds"],
        ["Crawl Page Limit:", summary["max_pages"]],
        ["Crawl Status:", "Complete within limits" if summary.get("crawl_completed") else summary.get("stopped_reason", "Stopped")],
        ["", ""],
        ["DISCOVERY & COVERAGE METHODS", "STATUS / METRIC"],
        ["Discovery Methods Deployed:", ", ".join(summary.get("discovery_methods", []))],
        ["XML Sitemap Discovery:", f"Succeeded ({summary.get('sitemap_count', 0)} URLs discovered)" if summary.get("sitemap_success") else "None detected / Inaccessible"],
        ["JavaScript Client-Rendering:", "Static HTML & SSR DOM only"],
        ["Coverage Boundary Statement:", summary.get("coverage_statement", "Complete within crawlable public HTML pages.")],
        ["", ""],
        ["KEY AUDIT TOTALS", "COUNT"],
        ["Pages Discovered:", summary.get("pages_discovered", summary["pages_scanned"])],
        ["Pages Successfully Scanned & Audited:", summary["pages_scanned"]],
        ["Pages Failed / Timed Out:", summary.get("pages_failed", 0)],
        ["Total Heading Elements Inspected:", summary["total_headings"]],
        ["Total <h1> Elements Found:", summary.get("h1_total", 0)],
        ["Total <h2> Elements Found:", summary.get("h2_total", 0)],
        ["Total <h3> Elements Found:", summary.get("h3_total", 0)],
        ["Total <h4>–<h6> Elements Found:", summary.get("h4_total", 0)],
        ["", ""],
        ["HIERARCHY ISSUES FLAGGED", "PAGE COUNT"],
        ["Pages Missing an <h1> Tag:", summary.get("pages_missing_h1", 0)],
        ["Pages with Multiple <h1> Tags (Diluted Focus):", summary.get("pages_multiple_h1", 0)],
        ["Pages with Skipped Heading Levels (e.g. H1 -> H3):", summary.get("pages_skipped_levels", 0)],
        ["Empty Heading Elements Detected:", summary.get("empty_headings", 0)],
        ["", ""],
        ["KEY FINDINGS & STRATEGIC RECOMMENDATIONS", ""],
    ]
    for i, finding in enumerate(summary.get("top_findings", []), 1):
        rows.append([f"{i}. {finding}", "Apply recommended hierarchy in Heading Optimization tab"])

    for r_idx, row in enumerate(rows, 1):
        xml_parts.append(f'<row r="{r_idx}">')
        for c_idx, val in enumerate(row, 1):
            cl = col_letter(c_idx)
            xml_parts.append(f'<c r="{cl}{r_idx}" t="inlineStr"><is><t>{escape_xml(str(val))}</t></is></c>')
        xml_parts.append('</row>')

    xml_parts.append('</sheetData>')
    xml_parts.append('</worksheet>')
    return "\n".join(xml_parts)


def create_hierarchy_inventory_sheet_xml(pages: list[dict]) -> str:
    xml_parts = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        '<cols>',
        '<col min="1" max="1" width="35" customWidth="1"/>',
        '<col min="2" max="2" width="28" customWidth="1"/>',
        '<col min="3" max="3" width="18" customWidth="1"/>',
        '<col min="4" max="4" width="28" customWidth="1"/>',
        '<col min="5" max="5" width="35" customWidth="1"/>',
        '<col min="6" max="6" width="14" customWidth="1"/>',
        '<col min="7" max="7" width="35" customWidth="1"/>',
        '<col min="8" max="8" width="18" customWidth="1"/>',
        '<col min="9" max="9" width="35" customWidth="1"/>',
        '</cols>',
        '<sheetData>',
    ]

    headers = [
        "Page URL", "Page Title", "Category", "Target Keyword",
        "Original Heading Text", "Current Level", "Optimized Heading Text",
        "Recommended Level", "Flagged Issues"
    ]
    xml_parts.append('<row r="1" ht="20" customHeight="1">')
    for c_idx, h in enumerate(headers, 1):
        cl = col_letter(c_idx)
        xml_parts.append(f'<c r="{cl}1" s="1" t="inlineStr"><is><t>{escape_xml(h)}</t></is></c>')
    xml_parts.append('</row>')

    r_num = 2
    for page in pages:
        for h in page["analysis"]["headings"]:
            issues_str = "; ".join(h["issues"]) or "Clean"
            xml_parts.append(f'<row r="{r_num}">')
            row_vals = [
                page["url"],
                page["title"],
                page["category"],
                page["analysis"]["target_keyword"],
                h["text"],
                h["tag"],
                h["opt_text"],
                h["opt_level"],
                issues_str,
            ]
            for c_idx, val in enumerate(row_vals, 1):
                cl = col_letter(c_idx)
                xml_parts.append(f'<c r="{cl}{r_num}" t="inlineStr"><is><t>{escape_xml(str(val))}</t></is></c>')
            xml_parts.append('</row>')
            r_num += 1

    xml_parts.append('</sheetData>')
    xml_parts.append(f'<autoFilter ref="A1:I{r_num}"/>')
    xml_parts.append('</worksheet>')
    return "\n".join(xml_parts)


def build_heading_audit_xlsx(summary: dict, pages: list[dict]) -> bytes:
    sheet1_xml = create_heading_sheet_xml(pages)
    sheet2_xml = create_summary_sheet_xml(summary)
    sheet3_xml = create_hierarchy_inventory_sheet_xml(pages)

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
            '<sheet name="Heading Optimization" sheetId="1" r:id="rId1"/>'
            '<sheet name="Audit Summary" sheetId="2" r:id="rId2"/>'
            '<sheet name="Hierarchy Analysis" sheetId="3" r:id="rId3"/>'
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
            '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            '</Relationships>'
        )
        z.writestr("xl/_rels/workbook.xml.rels", wb_rels)

        z.writestr("xl/styles.xml", build_heading_styles_xml())
        z.writestr("xl/worksheets/sheet1.xml", sheet1_xml)
        z.writestr("xl/worksheets/sheet2.xml", sheet2_xml)
        z.writestr("xl/worksheets/sheet3.xml", sheet3_xml)

    return out_buf.getvalue()


# -----------------------------------------------------------------------------
# 4. Crawl Controller & CLI
# -----------------------------------------------------------------------------

def run_heading_audit(
    start_url: str = "https://thenines.com/",
    max_pages: int = 60,
    delay: float = 0.15,
    timeout: int = 10,
    allow_subdomains: bool = False,
    output_path: str = "outputs/heading_structure_audit_thenines.xlsx",
    resume: bool = False,
    enable_sitemaps: bool = True
) -> dict:
    norm_start = normalize_url(start_url)
    if not norm_start:
        raise ValueError(f"Invalid target URL: '{start_url}'")

    parsed = urllib.parse.urlparse(norm_start)
    origin_domain = parsed.netloc.lower()
    origin = f"{parsed.scheme}://{parsed.netloc}"
    hostname_clean = origin_domain.replace(".", "_")
    checkpoint_file = f".heading_checkpoint_{hostname_clean}.json"

    print("\n=======================================================")
    print(" COGWHEEL HEADING STRUCTURE OPTIMIZATION ENGINE")
    print(f" Target Site: {norm_start}")
    print(f" Crawl Limit: {max_pages} pages | Delay: {delay}s | Timeout: {timeout}s")
    print(f" Output File: {output_path}")
    print("=======================================================\n")

    t_start = time.time()
    queue = [norm_start]
    visited = set()
    pages_data = []

    sitemap_success = False
    sitemap_count = 0
    discovery_methods = ["Internal HTML Link Crawler", "DOM Heading Element Inspector"]

    # Resume from checkpoint if requested
    if resume and os.path.exists(checkpoint_file):
        try:
            with open(checkpoint_file, encoding="utf-8") as f:
                ckpt = json.load(f)
                visited = set(ckpt.get("visited", []))
                queue = ckpt.get("queue", queue)
                pages_data = ckpt.get("pages_data", [])
                print(f"[Checkpoint] Resumed session: {len(visited)} pages crawled.\n")
        except Exception as e:
            print(f"[Checkpoint] Warning: Could not resume from checkpoint ({e}). Starting fresh.")

    # 1. Sitemap Discovery
    if enable_sitemaps and not visited:
        print("[Discovery] Discovering XML sitemaps and index files...")
        candidate_sitemaps = [
            f"{origin}/sitemap.xml",
            f"{origin}/sitemap_index.xml",
            f"{origin}/wp-sitemap.xml",
        ]
        try:
            req = urllib.request.Request(f"{origin}/robots.txt", headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                text = resp.read().decode("utf-8", errors="replace")
                for m in re.finditer(r"^Sitemap:\s*(https?://[^\s]+)", text, re.I | re.M):
                    candidate_sitemaps.insert(0, m.group(1).strip())
        except Exception:
            pass

        visited_sm = set()
        sitemap_urls = set()

        def parse_sm(sm_url):
            if sm_url in visited_sm or len(visited_sm) > 15:
                return
            visited_sm.add(sm_url)
            try:
                req = urllib.request.Request(sm_url, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    xml = resp.read().decode("utf-8", errors="replace")
                    for sub in re.finditer(r"<sitemap>\s*<loc>([^<]+)</loc>", xml, re.I):
                        parse_sm(sub.group(1).strip())
                    for u in re.finditer(r"<url>\s*<loc>([^<]+)</loc>", xml, re.I):
                        norm = normalize_url(u.group(1).strip(), origin)
                        if norm and norm.startswith(origin):
                            sitemap_urls.add(norm)
            except Exception:
                pass

        for sm in candidate_sitemaps:
            if len(sitemap_urls) >= 1500:
                break
            parse_sm(sm)

        if sitemap_urls:
            sitemap_success = True
            sitemap_count = len(sitemap_urls)
            discovery_methods.append("XML Sitemap & Index Parser")
            print(f"[Discovery] Discovered {len(sitemap_urls)} URLs from XML sitemaps.")
            for sm_u in sorted(sitemap_urls):
                if sm_u not in visited and sm_u not in queue and len(queue) < max_pages * 3:
                    queue.append(sm_u)

    page_counter = len(visited)
    crawl_errors = []

    while queue and len(visited) < max_pages:
        current_url = queue.pop(0)
        if current_url in visited:
            continue
        visited.add(current_url)
        page_counter += 1

        print(f"[{page_counter}/{max_pages}] Auditing: {current_url}")

        req = urllib.request.Request(current_url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                status = resp.status
                ct = resp.headers.get("Content-Type", "")
                if "text/html" not in ct and "application/xhtml" not in ct:
                    continue

                html_text = resp.read().decode("utf-8", errors="replace")

                # Extract title
                m_title = re.search(r"<title\b[^>]*>(.*?)</title>", html_text, re.I | re.S)
                title = html.unescape(m_title.group(1)).strip() if m_title else current_url

                # Extract headings
                raw_headings = extract_headings_from_html(html_text)

                # Analyze & optimize
                analysis = analyze_and_optimize_page(raw_headings, current_url, title)
                cat, subcat = classify_page_url(current_url)

                pages_data.append({
                    "url": current_url,
                    "title": title,
                    "status": status,
                    "category": cat,
                    "subCategory": subcat,
                    "analysis": analysis,
                })

                # Queue internal links
                for m_link in re.finditer(r"""<a\b[^>]*\bhref\s*=\s*["']([^"']*)["'][^>]*>""", html_text, re.I):
                    href = m_link.group(1).strip()
                    norm_link = normalize_url(href, current_url)
                    origin_match = norm_link.startswith(origin) if not allow_subdomains else (norm_link and urllib.parse.urlparse(norm_link).netloc.endswith(urllib.parse.urlparse(origin).netloc))
                    if (
                        norm_link
                        and origin_match
                        and not re.search(r"\.(?:pdf|zip|docx?|xlsx?|mp4|mp3|svg|png|jpe?g|webp|gif)$", norm_link, re.I)
                        and norm_link not in visited
                        and norm_link not in queue
                        and len(queue) < max_pages * 4
                    ):
                        queue.append(norm_link)

        except urllib.error.HTTPError as e:
            crawl_errors.append(f"{current_url} (HTTP {e.code})")
        except Exception as e:
            crawl_errors.append(f"{current_url} ({e})")

        # Checkpoint every 10 pages
        if page_counter % 10 == 0:
            try:
                with open(checkpoint_file, "w", encoding="utf-8") as f:
                    json.dump({
                        "visited": list(visited),
                        "queue": queue,
                        "pages_data": pages_data,
                    }, f)
            except OSError:
                pass

        if delay > 0:
            time.sleep(delay)

    # Clean up checkpoint on complete crawl
    if os.path.exists(checkpoint_file):
        with contextlib.suppress(Exception):
            os.remove(checkpoint_file)

    # Sort pages to group logically: Home first, Accommodations, Dining, Experience, Meetings, Discover
    category_order = {
        "HOME PAGE": 1,
        "Accommodations": 2,
        "DINING": 3,
        "EXPERIENCE": 4,
        "Offers & Packages": 5,
        "MEETING & EVENTS": 6,
        "DISCOVER": 7,
        "General Pages": 8,
    }
    pages_data.sort(key=lambda p: (category_order.get(p["category"], 99), p["url"]))

    # Summary totals
    total_headings = sum(len(p["analysis"]["headings"]) for p in pages_data)
    h1_total = sum(p["analysis"]["h1_count"] for p in pages_data)
    h2_total = sum(p["analysis"]["h2_count"] for p in pages_data)
    h3_total = sum(p["analysis"]["h3_count"] for p in pages_data)
    h4_total = sum(p["analysis"]["h4_count"] for p in pages_data)
    missing_h1 = sum(1 for p in pages_data if p["analysis"]["h1_count"] == 0)
    multiple_h1 = sum(1 for p in pages_data if p["analysis"]["h1_count"] > 1)
    skipped_levels = sum(1 for p in pages_data if p["analysis"]["has_skipped"])
    empty_headings = sum(1 for p in pages_data for h in p["analysis"]["headings"] if not h["text"])

    top_findings = []
    if missing_h1 > 0:
        top_findings.append(f"{missing_h1} pages lack an <h1> tag entirely.")
    if multiple_h1 > 0:
        top_findings.append(f"{multiple_h1} pages declare multiple <h1> tags, diluting primary search intent.")
    if skipped_levels > 0:
        top_findings.append(f"{skipped_levels} pages skip heading levels in document order (e.g. H1 directly to H3).")
    if empty_headings > 0:
        top_findings.append(f"{empty_headings} empty heading elements were detected.")
    if not top_findings:
        top_findings.append("All audited pages follow a clean, structured heading hierarchy.")

    summary = {
        "website_url": norm_start,
        "origin": origin,
        "audited_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
        "duration_sec": time.time() - t_start,
        "max_pages": max_pages,
        "pages_discovered": len(visited) + len(queue),
        "pages_scanned": len(visited),
        "pages_failed": len(crawl_errors),
        "total_headings": total_headings,
        "h1_total": h1_total,
        "h2_total": h2_total,
        "h3_total": h3_total,
        "h4_total": h4_total,
        "pages_missing_h1": missing_h1,
        "pages_multiple_h1": multiple_h1,
        "pages_skipped_levels": skipped_levels,
        "empty_headings": empty_headings,
        "discovery_methods": discovery_methods,
        "sitemap_success": sitemap_success,
        "sitemap_count": sitemap_count,
        "crawl_completed": len(queue) == 0 and len(visited) < max_pages,
        "stopped_reason": "Completed all discovered queue pages" if not queue else f"Reached {max_pages} page limit",
        "coverage_statement": f"Audit complete across {len(visited)} scanned public HTML pages and declared sitemaps.",
        "top_findings": top_findings,
    }

    # Generate XLSX
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    print(f"\n[Export] Generating OpenXML workbook at: {output_path}")
    xlsx_bytes = build_heading_audit_xlsx(summary, pages_data)
    with open(output_path, "wb") as f:
        f.write(xlsx_bytes)

    print("=======================================================")
    print(f" AUDIT COMPLETE: {len(pages_data)} pages, {total_headings} headings audited.")
    print(f" Spreadsheet saved: {os.path.abspath(output_path)}")
    print(" Format strictly mirrors reference Google Sheet: 'Heading Structure Optimization- thenines'")
    print(" Tabs: [1] Heading Optimization | [2] Audit Summary | [3] Hierarchy Analysis")
    print("=======================================================\n")

    return {
        "summary": summary,
        "pages": pages_data,
        "output_file": os.path.abspath(output_path),
    }


def main():
    parser = argparse.ArgumentParser(
        description="Cogwheel SEO Studio — Heading Structure Optimization Audit Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 outputs/site_heading_audit.py
  python3 outputs/site_heading_audit.py https://thenines.com/ --max-pages 60
  python3 outputs/site_heading_audit.py https://example.com --output outputs/heading_audit.xlsx --resume
        """
    )
    parser.add_argument("url", nargs="?", default="https://thenines.com/", help="Website URL to audit (default: https://thenines.com/)")
    parser.add_argument("--max-pages", type=int, default=60, help="Maximum pages to crawl (default: 60)")
    parser.add_argument("--delay", type=float, default=0.15, help="Delay between requests in seconds (default: 0.15)")
    parser.add_argument("--timeout", type=int, default=10, help="HTTP request timeout in seconds (default: 10)")
    parser.add_argument("--subdomains", action="store_true", help="Allow crawling subdomains")
    parser.add_argument("--output", type=str, default="", help="Output .xlsx file path")
    parser.add_argument("--resume", action="store_true", help="Resume from previous checkpoint")
    parser.add_argument("--no-sitemap", action="store_true", help="Disable XML sitemap discovery")

    args = parser.parse_args()

    hostname = urllib.parse.urlparse(args.url).netloc.replace(".", "_") or "site"
    out_file = args.output or f"outputs/heading_structure_audit_{hostname}.xlsx"

    run_heading_audit(
        start_url=args.url,
        max_pages=args.max_pages,
        delay=args.delay,
        timeout=args.timeout,
        allow_subdomains=args.subdomains,
        output_path=out_file,
        resume=args.resume,
        enable_sitemaps=not args.no_sitemap,
    )


if __name__ == "__main__":
    main()
