#!/usr/bin/env python3
"""
Cogwheel SEO & Hospitality Templates Studio
Website Image Optimization Audit Tool (CLI & Automation Engine)

Crawls public pages of a website, audits every image occurrence (alt text, file size,
format, dimensions, loading behavior, broken links, CLS risks), and generates a multi-tab
Excel (.xlsx) workbook matching the reference layout:
https://docs.google.com/spreadsheets/d/1gdX3whxcXFlVNJDat2Avz_q3haNRfWz39TAMK0Q6QGc/

Tabs generated:
  1. Image Optimization  — Matches reference sheet (with =IMAGE(B2) and =LEN(...) formulas)
  2. Overview            — Executive audit scorecard, crawl parameters & key findings
  3. Image Inventory     — Comprehensive technical audit of all discovered assets
  4. Recommendations     — Category guidance, performance rationale & prioritized fixes
  5. Crawl Log           — Page-by-page crawl log with HTTP status and discovery counts
"""

from __future__ import annotations

import argparse
import base64
import html
import io
import json
import os
import re
import struct
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
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
        # Remove fragment
        cleaned = urllib.parse.urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, parsed.query, ""))
        return cleaned
    except Exception:
        return None


def clean_filename_title(url: str) -> str:
    try:
        path = urllib.parse.urlparse(url).path
        name = path.split("/")[-1]
        name = re.sub(r"\.[a-zA-Z0-9]{2,5}$", "", name)
        name = re.sub(r"[-_](?:scaled|optimized|thumb|thumbnail|\d+x\d+|@\d+x)$", "", name, flags=re.I)
        name = re.sub(r"[_-]+", " ", name).strip()
        return name or "Image asset"
    except Exception:
        return "Image asset"


def generate_proposed_alt(url: str, page_title: str | None, current_alt: str | None, is_hero: bool = False) -> str:
    if current_alt and len(current_alt.strip()) > 15 and not re.search(r"\.(?:jpg|png|webp|jpeg)$", current_alt, re.I):
        return current_alt.strip()

    title_clean = clean_filename_title(url)
    page_context = (page_title or "").split("-")[0].split("|")[0].strip()

    is_generic = bool(re.match(r"^(?:img|dsc|image|photo|pic|asset|upload|banner)[_\s-]*\d*$", title_clean, re.I))

    if is_generic:
        if is_hero and page_context:
            return f"Primary visual showcase for {page_context}"
        return f"Featured photography on {page_context}" if page_context else "Descriptive photography showcase"

    cap_title = title_clean[:1].upper() + title_clean[1:]
    if page_context and page_context.lower() not in cap_title.lower():
        return f"{cap_title} featured at {page_context}"
    return cap_title


def detect_image_format(url: str, content_type: str | None) -> str:
    ct = (content_type or "").lower()
    if "webp" in ct: return "WebP"
    if "avif" in ct: return "AVIF"
    if "svg" in ct: return "SVG"
    if "jpeg" in ct or "jpg" in ct: return "JPEG"
    if "png" in ct: return "PNG"
    if "gif" in ct: return "GIF"

    u = url.lower().split("?")[0]
    if u.endswith(".webp"): return "WebP"
    if u.endswith(".avif"): return "AVIF"
    if u.endswith(".svg"): return "SVG"
    if u.endswith(".png"): return "PNG"
    if u.endswith(".jpg") or u.endswith(".jpeg"): return "JPEG"
    if u.endswith(".gif"): return "GIF"
    return "Unknown"


# -----------------------------------------------------------------------------
# 2. HTML Extraction (img, srcset, picture/source, CSS backgrounds)
# -----------------------------------------------------------------------------

def extract_page_title(html_content: str) -> str:
    m = re.search(r"<title[^>]*>(.*?)</title>", html_content, re.I | re.S)
    if m:
        t = re.sub(r"<[^>]+>", "", m.group(1)).strip()
        return html.unescape(t)
    return "Untitled Page"


def extract_images_from_html(html_content: str, page_url: str):
    images = []
    seen = set()

    # 1. <img> tags
    img_matches = re.finditer(r"<img\b([^>]*)>", html_content, re.I)
    idx = 0
    for match in img_matches:
        idx += 1
        attrs_str = match.group(1)

        def get_attr(name):
            m = re.search(rf"\b{name}\s*=\s*(?:\"([^\"]*)\"|'([^']*)'|([^\s>]+))", attrs_str, re.I)
            return m.group(1) or m.group(2) or m.group(3) if m else None

        src = get_attr("src") or get_attr("data-src") or get_attr("data-original") or get_attr("data-lazy-src") or get_attr("data-lazy")
        srcset = get_attr("srcset") or get_attr("data-srcset")
        alt = get_attr("alt")
        width = get_attr("width")
        height = get_attr("height")
        loading = (get_attr("loading") or "unspecified").lower()

        target_url = None
        source_attr = "src"

        if src:
            target_url = normalize_url(src, page_url)
            source_attr = "src" if get_attr("src") else "data-src"

        if not target_url and srcset:
            first_src = srcset.split(",")[0].strip().split()[0]
            target_url = normalize_url(first_src, page_url)
            source_attr = "srcset"

        if target_url and target_url not in seen:
            seen.add(target_url)
            images.append({
                "url": target_url,
                "alt": alt if alt is not None else None,
                "html_width": int(width) if width and width.isdigit() else None,
                "html_height": int(height) if height and height.isdigit() else None,
                "loading": loading,
                "element_type": "img" if get_attr("src") else "data-lazy",
                "source_attribute": source_attr,
                "is_hero": idx <= 2,
            })

    # 2. <picture> and <source>
    source_matches = re.finditer(r"<source\b([^>]*)>", html_content, re.I)
    for match in source_matches:
        attrs_str = match.group(1)
        m = re.search(r"\b(?:srcset|data-srcset)\s*=\s*(?:\"([^\"]*)\"|'([^']*)'|([^\s>]+))", attrs_str, re.I)
        if m:
            val = m.group(1) or m.group(2) or m.group(3)
            first_src = val.split(",")[0].strip().split()[0]
            target_url = normalize_url(first_src, page_url)
            if target_url and target_url not in seen:
                seen.add(target_url)
                images.append({
                    "url": target_url,
                    "alt": None,
                    "html_width": None,
                    "html_height": None,
                    "loading": "unspecified",
                    "element_type": "source",
                    "source_attribute": "picture/source",
                    "is_hero": False,
                })

    # 3. CSS Background images
    bg_matches = re.finditer(r"background(?:-image)?\s*:\s*url\(\s*(?:['\"]?)(.*?)(?:['\"]?)\s*\)", html_content, re.I)
    for match in bg_matches:
        raw_bg = match.group(1).strip()
        target_url = normalize_url(raw_bg, page_url)
        if target_url and target_url not in seen:
            seen.add(target_url)
            images.append({
                "url": target_url,
                "alt": None,
                "html_width": None,
                "html_height": None,
                "loading": "unspecified",
                "element_type": "css-background",
                "source_attribute": "style=background-image",
                "is_hero": False,
            })

    return images


def extract_internal_links(html_content: str, page_url: str, origin_domain: str, allow_subdomains: bool) -> list[str]:
    links = []
    matches = re.finditer(r"<a\b[^>]*\bhref\s*=\s*(?:\"([^\"]*)\"|'([^']*)'|([^\s>]+))", html_content, re.I)
    for match in matches:
        raw_href = match.group(1) or match.group(2) or match.group(3)
        if not raw_href or raw_href.startswith("#") or re.match(r"^(?:mailto:|tel:|javascript:)", raw_href, re.I):
            continue
        norm = normalize_url(raw_href, page_url)
        if not norm:
            continue
        try:
            parsed = urllib.parse.urlparse(norm)
            host = parsed.netloc.lower()
            is_internal = (host == origin_domain or host.endswith("." + origin_domain)) if allow_subdomains else (host == origin_domain)
            is_page = not re.search(r"\.(?:pdf|zip|mp4|mp3|docx?|xlsx?|gz|tar)$", parsed.path, re.I)
            if is_internal and is_page:
                links.append(norm)
        except Exception:
            pass
    return list(dict.fromkeys(links))


# -----------------------------------------------------------------------------
# 3. Network Header Inspection
# -----------------------------------------------------------------------------

def inspect_image(url: str, timeout: int = 8) -> dict:
    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
    })

    status = 0
    content_type = None
    content_length = None
    is_broken = False

    try:
        req.get_method = lambda: "HEAD"
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            status = resp.status
            content_type = resp.headers.get("Content-Type")
            len_hdr = resp.headers.get("Content-Length")
            content_length = int(len_hdr) if len_hdr and len_hdr.isdigit() else None
            is_broken = status >= 400
    except urllib.error.HTTPError as e:
        status = e.code
        is_broken = True
    except Exception:
        # Fallback to range GET
        try:
            get_req = urllib.request.Request(url, headers={
                "User-Agent": USER_AGENT,
                "Range": "bytes=0-1024"
            })
            with urllib.request.urlopen(get_req, timeout=timeout) as resp:
                status = resp.status
                content_type = resp.headers.get("Content-Type")
                len_hdr = resp.headers.get("Content-Range", "").split("/")[-1] or resp.headers.get("Content-Length")
                content_length = int(len_hdr) if len_hdr and len_hdr.isdigit() else None
                is_broken = status >= 400
        except Exception as e2:
            status = getattr(e2, "code", 0)
            is_broken = True

    return {
        "status": status,
        "content_type": content_type,
        "content_length": content_length,
        "is_broken": is_broken,
    }


# -----------------------------------------------------------------------------
# 4. Multi-Tab OpenXML (.xlsx) Builder
# -----------------------------------------------------------------------------

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


def col_letter(n: int) -> str:
    """1-based index to column letter: 1 -> A, 2 -> B, 27 -> AA"""
    result = ""
    while n > 0:
        n, remainder = divmod(n - 1, 26)
        result = chr(65 + remainder) + result
    return result


def create_sheet_xml(headers: list[str], rows: list[list], cols_width: list[int] = None) -> str:
    """Generates standard OpenXML sheet XML supporting formulas and values."""
    xml_parts = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    ]

    # Column widths
    if cols_width:
        xml_parts.append('<cols>')
        for idx, w in enumerate(cols_width, 1):
            xml_parts.append(f'<col min="{idx}" max="{idx}" width="{w}" customWidth="1"/>')
        xml_parts.append('</cols>')

    xml_parts.append('<sheetData>')

    # Header Row
    xml_parts.append('<row r="1">')
    for col_idx, h in enumerate(headers, 1):
        cell_ref = f"{col_letter(col_idx)}1"
        xml_parts.append(f'<c r="{cell_ref}" t="inlineStr"><is><t>{escape_xml(h)}</t></is></c>')
    xml_parts.append('</row>')

    # Data Rows
    for row_idx, row in enumerate(rows, 2):
        xml_parts.append(f'<row r="{row_idx}">')
        for col_idx, val in enumerate(row, 1):
            cell_ref = f"{col_letter(col_idx)}{row_idx}"
            if isinstance(val, str) and val.startswith("="):
                # Formula
                formula_body = escape_xml(val[1:])
                xml_parts.append(f'<c r="{cell_ref}"><f>{formula_body}</f></c>')
            elif isinstance(val, (int, float)):
                xml_parts.append(f'<c r="{cell_ref}"><v>{val}</v></c>')
            else:
                str_val = escape_xml(str(val) if val is not None else "")
                xml_parts.append(f'<c r="{cell_ref}" t="inlineStr"><is><t>{str_val}</t></is></c>')
        xml_parts.append('</row>')

    xml_parts.append('</sheetData>')

    # Add AutoFilter for headers if table has data
    if headers and rows:
        max_col = col_letter(len(headers))
        xml_parts.append(f'<autoFilter ref="A1:{max_col}{len(rows) + 1}"/>')

    xml_parts.append('</worksheet>')
    return "\n".join(xml_parts)


def build_audit_xlsx(summary: dict, items: list[dict], crawl_log: list[dict]) -> bytes:
    """Builds a complete 5-tab Excel spreadsheet adhering to standard OpenXML spec."""
    # 1. Image Optimization Tab (Matching reference sheet)
    opt_headers = [
        "Image", "URL ", "Title ", "Length", "Optimized ALT Text", "Length",
        "Format", "Size (KB)", "Dimensions", "Status / Issue", "Recommendation", "Priority"
    ]
    opt_rows = []
    for idx, item in enumerate(items, 2):
        clean_title = clean_filename_title(item["url"])
        dim = f"{item['html_width']}x{item['html_height']}" if item["html_width"] and item["html_height"] else "-"
        issue_str = "; ".join(item["issues"]) or "Healthy"
        size_kb = round(item["size_bytes"] / 1024, 1) if item["size_bytes"] else "-"

        opt_rows.append([
            f'=IMAGE(B{idx})',
            item["url"],
            clean_title,
            f'=LEN(C{idx})',
            item["proposed_alt"],
            f'=LEN(E{idx})',
            item["format"],
            size_kb,
            dim,
            issue_str,
            item["recommendation"],
            item["priority"]
        ])

    opt_widths = [14, 45, 32, 8, 45, 8, 10, 10, 14, 30, 45, 10]
    sheet1_xml = create_sheet_xml(opt_headers, opt_rows, opt_widths)

    # 2. Overview Tab
    ov_headers = ["WEBSITE IMAGE OPTIMIZATION AUDIT REPORT", "VALUE"]
    ov_rows = [
        ["Audited Website", summary["website_url"]],
        ["Domain Origin", summary["origin"]],
        ["Audit Date & Time", summary["crawled_at"]],
        ["Crawl Page Limit", summary["max_pages"]],
        ["Total Pages Scanned", summary["pages_scanned"]],
        ["Total Images Audited", summary["total_images"]],
        ["Broken Images (HTTP 4xx/5xx)", summary["broken_images"]],
        ["Missing Alt Text Attributes", summary["missing_alt"]],
        ["Oversized Images (>100KB)", summary["oversized_images"]],
        ["Missing HTML Dimensions (CLS Risk)", summary["missing_dimensions"]],
        ["Legacy Formats (JPEG/PNG)", summary["legacy_formats"]],
        ["Lazy Loading on Hero Images", summary["above_fold_lazy"]],
        ["", ""],
        ["FORMAT BREAKDOWN", "COUNT"],
    ]
    for fmt, count in summary["format_breakdown"].items():
        ov_rows.append([f"Format: {fmt}", count])

    ov_rows.append(["", ""])
    ov_rows.append(["TOP AUDIT FINDINGS", "ACTION"])
    for i, finding in enumerate(summary["top_findings"], 1):
        ov_rows.append([f"{i}. {finding}", "Review High-Priority items in Image Optimization tab"])

    sheet2_xml = create_sheet_xml(ov_headers, ov_rows, [45, 45])

    # 3. Image Inventory Tab
    inv_headers = [
        "Image URL", "Page URL", "Page Title", "Page Status", "Current Alt",
        "Alt Status", "HTML Width", "HTML Height", "File Size (KB)", "Format",
        "Element Type", "Loading Mode", "HTTP Status", "Occurrences", "Issues Flagged",
        "Recommendation", "Priority"
    ]
    inv_rows = []
    for item in items:
        alt_status = "Missing" if item["alt"] is None else ("Empty (Decorative)" if item["alt"] == "" else "Present")
        size_kb = round(item["size_bytes"] / 1024, 1) if item["size_bytes"] else "-"
        inv_rows.append([
            item["url"],
            item["page_url"],
            item["page_title"],
            item["page_status"],
            item["alt"] or "-",
            alt_status,
            item["html_width"] or "-",
            item["html_height"] or "-",
            size_kb,
            item["format"],
            item["element_type"],
            item["loading"],
            item["http_status"],
            item["occurrences"],
            "; ".join(item["issues"]) or "None",
            item["recommendation"],
            item["priority"]
        ])

    inv_widths = [45, 40, 30, 11, 28, 16, 11, 11, 13, 10, 13, 13, 12, 12, 35, 45, 10]
    sheet3_xml = create_sheet_xml(inv_headers, inv_rows, inv_widths)

    # 4. Recommendations Tab
    rec_headers = ["Issue Category", "Why It Matters", "Recommended Fix", "Priority Standard"]
    rec_rows = [
        ["Missing Alt Text", "Screen readers cannot announce image content, and search engines cannot index image context.", "Add descriptive alt text to all informational assets. Use alt=\"\" only for decorative icons/spacers.", "High (WCAG 2.1 AA)"],
        ["Oversized Assets (>100KB)", "Heavy files consume mobile bandwidth, stall First Contentful Paint, and cause visitor abandonment.", "Compress images to under 100KB using modern compression (Squoosh, Sharp, TinyPNG).", "High (Core Web Vitals)"],
        ["Legacy Image Formats", "JPEG and PNG lack modern predictive compression, resulting in 30% to 70% larger file sizes than WebP/AVIF.", "Serve next-gen WebP or AVIF with <picture> fallback sources for legacy browsers.", "Medium (Performance)"],
        ["Missing HTML Dimensions", "Browsers cannot allocate layout space prior to download, triggering Cumulative Layout Shift (CLS).", "Specify intrinsic width and height attributes or CSS aspect-ratio on all <img> elements.", "Medium (Core Web Vitals)"],
        ["Lazy Loading on Hero Images", "Applying loading=\"lazy\" to above-the-fold banners delays image discovery and degrades Largest Contentful Paint (LCP).", "Remove loading=\"lazy\" from the top 1-2 images in the initial viewport. Add fetchpriority=\"high\".", "High (LCP)"],
        ["Broken Image Links (4xx/5xx)", "Broken images present a damaged user experience and waste browser connection threads.", "Repair image paths or remove orphaned <img> elements.", "High (Technical SEO)"],
        ["Duplicate Image Requests", "Re-requesting duplicate image assets across pages increases server load without CDN caching.", "Ensure canonical URLs and configure long-lived HTTP Cache-Control headers (max-age=31536000, immutable).", "Low (Caching)"]
    ]
    sheet4_xml = create_sheet_xml(rec_headers, rec_rows, [25, 45, 55, 25])

    # 5. Crawl Log Tab
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
        # [Content_Types].xml
        content_types = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            '<Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            '<Override PartName="/xl/worksheets/sheet4.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            '<Override PartName="/xl/worksheets/sheet5.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            '</Types>'
        )
        z.writestr("[Content_Types].xml", content_types)

        # _rels/.rels
        root_rels = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            '</Relationships>'
        )
        z.writestr("_rels/.rels", root_rels)

        # xl/workbook.xml
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

        # xl/_rels/workbook.xml.rels
        wb_rels = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>'
            '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>'
            '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet4.xml"/>'
            '<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet5.xml"/>'
            '</Relationships>'
        )
        z.writestr("xl/_rels/workbook.xml.rels", wb_rels)

        # Sheets
        z.writestr("xl/worksheets/sheet1.xml", sheet1_xml)
        z.writestr("xl/worksheets/sheet2.xml", sheet2_xml)
        z.writestr("xl/worksheets/sheet3.xml", sheet3_xml)
        z.writestr("xl/worksheets/sheet4.xml", sheet4_xml)
        z.writestr("xl/worksheets/sheet5.xml", sheet5_xml)

    return out_buf.getvalue()


# -----------------------------------------------------------------------------
# 5. Core Audit Controller
# -----------------------------------------------------------------------------

def run_image_audit(
    start_url: str,
    max_pages: int = 50,
    delay: float = 0.2,
    timeout: int = 10,
    allow_subdomains: bool = False,
    size_threshold_kb: int = 100,
    output_path: str = "image_optimization_audit.xlsx"
) -> dict:
    norm_start = normalize_url(start_url)
    if not norm_start:
        raise ValueError(f"Invalid target URL: '{start_url}'")

    parsed = urllib.parse.urlparse(norm_start)
    origin_domain = parsed.netloc.lower()
    origin = f"{parsed.scheme}://{parsed.netloc}"

    print(f"\n=======================================================")
    print(f" COGWHEEL IMAGE OPTIMIZATION AUDIT ENGINE")
    print(f" Target: {norm_start}")
    print(f" Crawl Limit: {max_pages} pages | Delay: {delay}s | Size Gate: {size_threshold_kb}KB")
    print(f"=======================================================\n")

    queue = [norm_start]
    visited = set()
    crawl_log = []
    # canonical_url -> list of occurrence dicts
    discovered_images = {}

    page_counter = 0

    while queue and len(visited) < max_pages:
        current_url = queue.pop(0)
        if current_url in visited:
            continue
        visited.add(current_url)
        page_counter += 1

        print(f"[{page_counter}/{max_pages}] Crawling: {current_url}")
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
                        "images_found": 0, "status": "skipped", "notes": f"Non-HTML ({ct})"
                    })
                    continue

                html_text = resp.read().decode("utf-8", errors="replace")
                title = extract_page_title(html_text)

                page_images = extract_images_from_html(html_text, current_url)
                for img in page_images:
                    u = img["url"]
                    if u not in discovered_images:
                        discovered_images[u] = []
                    discovered_images[u].append({
                        "page_url": current_url,
                        "page_title": title,
                        "page_status": status,
                        "alt": img["alt"],
                        "html_width": img["html_width"],
                        "html_height": img["html_height"],
                        "loading": img["loading"],
                        "element_type": img["element_type"],
                        "source_attribute": img["source_attribute"],
                        "is_hero": img["is_hero"],
                    })

                crawl_log.append({
                    "url": current_url, "status_code": status, "title": title,
                    "images_found": len(page_images), "status": "success", "notes": "-"
                })

                # Internal links
                if len(visited) + len(queue) < max_pages * 2:
                    new_links = extract_internal_links(html_text, current_url, origin_domain, allow_subdomains)
                    for l in new_links:
                        if l not in visited and l not in queue:
                            queue.append(l)

        except urllib.error.HTTPError as e:
            crawl_log.append({
                "url": current_url, "status_code": e.code, "title": "-",
                "images_found": 0, "status": "error", "notes": f"HTTP {e.code}"
            })
        except Exception as ex:
            crawl_log.append({
                "url": current_url, "status_code": 0, "title": "-",
                "images_found": 0, "status": "error", "notes": str(ex)
            })

        if delay > 0 and queue:
            time.sleep(delay)

    print(f"\nCrawled {len(visited)} pages. Inspecting {len(discovered_images)} unique image assets...")

    # Inspect images
    items = []
    format_counts = {}
    broken_count = 0
    oversized_count = 0
    missing_alt_count = 0
    missing_dims_count = 0
    legacy_count = 0
    above_fold_lazy_count = 0

    inspected_count = 0
    total_to_inspect = min(len(discovered_images), 300)

    for img_url, occurrences in list(discovered_images.items())[:total_to_inspect]:
        inspected_count += 1
        if inspected_count % 15 == 0 or inspected_count == total_to_inspect:
            print(f"  Inspecting asset headers: {inspected_count}/{total_to_inspect}...")

        primary = occurrences[0]
        net = inspect_image(img_url, timeout=timeout)
        fmt = detect_image_format(img_url, net["content_type"])
        format_counts[fmt] = format_counts.get(fmt, 0) + 1

        size_b = net["content_length"]
        size_kb = round(size_b / 1024, 1) if size_b else None

        current_alt = primary["alt"]
        is_missing_alt = current_alt is None
        is_decorative = current_alt == ""

        proposed_alt = generate_proposed_alt(img_url, primary["page_title"], current_alt, primary["is_hero"])

        issues = []
        if is_missing_alt:
            issues.append("Missing alt text")
            missing_alt_count += 1
        elif is_decorative and not primary["is_hero"] and "icon" not in img_url.lower():
            issues.append("Empty alt text (check if decorative)")

        if size_kb and size_kb > size_threshold_kb:
            issues.append(f"Oversized file ({size_kb}KB > {size_threshold_kb}KB)")
            oversized_count += 1

        if fmt in ("JPEG", "PNG", "GIF"):
            issues.append(f"Legacy format ({fmt})")
            legacy_count += 1

        if not primary["html_width"] or not primary["html_height"]:
            issues.append("Missing HTML width/height")
            missing_dims_count += 1

        if net["is_broken"]:
            issues.append(f"Broken image URL (HTTP {net['status']})")
            broken_count += 1

        if primary["is_hero"] and primary["loading"] == "lazy":
            issues.append("Lazy-loading on above-the-fold image")
            above_fold_lazy_count += 1

        if len(occurrences) > 1:
            issues.append(f"Appears on {len(occurrences)} pages")

        # Priority calculation
        priority = "Good"
        if net["is_broken"] or is_missing_alt or (size_kb and size_kb > 300):
            priority = "High"
        elif (size_kb and size_kb > size_threshold_kb) or fmt in ("JPEG", "PNG") or not primary["html_width"]:
            priority = "Medium"
        elif issues:
            priority = "Low"

        # Actionable recommendation
        if net["is_broken"]:
            rec = f"Fix or remove broken image link (HTTP {net['status']})."
        elif is_missing_alt:
            rec = f'Add descriptive alt text: "{proposed_alt}".'
        elif size_kb and size_kb > size_threshold_kb:
            rec = f"Compress asset under {size_threshold_kb}KB and convert to modern WebP/AVIF."
        elif fmt in ("JPEG", "PNG"):
            rec = f"Convert {fmt} to WebP or AVIF for lighter mobile loading."
        elif not primary["html_width"]:
            rec = "Specify explicit HTML width and height to eliminate CLS layout shift."
        elif primary["is_hero"] and primary["loading"] == "lazy":
            rec = "Remove loading='lazy' from hero image to improve LCP speed."
        else:
            rec = "Image complies with performance standards."

        items.append({
            "url": img_url,
            "page_url": primary["page_url"],
            "page_title": primary["page_title"],
            "page_status": primary["page_status"],
            "alt": current_alt,
            "proposed_alt": proposed_alt,
            "html_width": primary["html_width"],
            "html_height": primary["html_height"],
            "size_bytes": size_b,
            "format": fmt,
            "element_type": primary["element_type"],
            "loading": primary["loading"],
            "http_status": net["status"],
            "occurrences": len(occurrences),
            "issues": issues,
            "recommendation": rec,
            "priority": priority,
        })

    # Summary
    top_findings = []
    if broken_count > 0:
        top_findings.append(f"Detected {broken_count} broken image URLs returning HTTP error responses.")
    if missing_alt_count > 0:
        top_findings.append(f"{missing_alt_count} image assets lack an alt attribute entirely (WCAG/SEO issue).")
    if oversized_count > 0:
        top_findings.append(f"{oversized_count} images exceed the {size_threshold_kb}KB size ceiling.")
    if legacy_count > 0:
        top_findings.append(f"{legacy_count} assets use legacy JPEG/PNG formats eligible for 30-70% WebP/AVIF savings.")
    if missing_dims_count > 0:
        top_findings.append(f"{missing_dims_count} images omit width/height dimensions, creating Cumulative Layout Shift.")
    if not top_findings:
        top_findings.append("All crawled image assets meet basic SEO & optimization standards.")

    summary = {
        "website_url": start_url,
        "origin": origin,
        "crawled_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
        "max_pages": max_pages,
        "pages_scanned": len(visited),
        "total_images": len(items),
        "broken_images": broken_count,
        "missing_alt": missing_alt_count,
        "oversized_images": oversized_count,
        "missing_dimensions": missing_dims_count,
        "legacy_formats": legacy_count,
        "above_fold_lazy": above_fold_lazy_count,
        "format_breakdown": format_counts,
        "top_findings": top_findings,
    }

    # Generate XLSX
    xlsx_bytes = build_audit_xlsx(summary, items, crawl_log)
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(xlsx_bytes)

    print(f"\n✔ Audit completed successfully!")
    print(f"✔ Multi-tab Excel workbook saved to: {output_path} ({len(xlsx_bytes):,} bytes)")
    print(f"   - Tab 1: Image Optimization (Matches reference sheet with =IMAGE(B2) & =LEN() formulas)")
    print(f"   - Tab 2: Overview (Executive KPI cards & findings)")
    print(f"   - Tab 3: Image Inventory ({len(items)} assets with technical dimensions & formats)")
    print(f"   - Tab 4: Recommendations (Actionable prioritized remediations)")
    print(f"   - Tab 5: Crawl Log ({len(crawl_log)} visited pages)\n")

    return {
        "summary": summary,
        "items": items,
        "crawl_log": crawl_log,
        "xlsx_path": output_path,
        "xlsx_bytes_len": len(xlsx_bytes)
    }


# -----------------------------------------------------------------------------
# 6. CLI Entrypoint
# -----------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Cogwheel SEO Studio — Website Image Optimization Audit Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 outputs/site_image_audit.py https://thenines.com
  python3 outputs/site_image_audit.py https://example.com --max-pages 25 --output report.xlsx
  python3 outputs/site_image_audit.py https://hotel.com --size-threshold 150 --subdomains
        """
    )
    parser.add_argument("url", nargs="?", help="Full website URL to audit (e.g. https://example.com)")
    parser.add_argument("--max-pages", type=int, default=50, help="Maximum pages to crawl (default: 50)")
    parser.add_argument("--delay", type=float, default=0.15, help="Delay between page requests in seconds (default: 0.15)")
    parser.add_argument("--timeout", type=int, default=10, help="HTTP request timeout in seconds (default: 10)")
    parser.add_argument("--subdomains", action="store_true", help="Allow crawling subdomains of target origin")
    parser.add_argument("--size-threshold", type=int, default=100, help="Oversized image threshold in KB (default: 100)")
    parser.add_argument("--output", default="outputs/image_optimization_audit.xlsx", help="Output .xlsx file path")

    args = parser.parse_args()

    target_url = args.url
    if not target_url:
        target_url = input("Enter website URL to audit (e.g. https://example.com): ").strip()

    if not target_url:
        print("Error: A valid target website URL is required.", file=sys.stderr)
        sys.exit(1)

    if not target_url.startswith("http://") and not target_url.startswith("https://"):
        target_url = "https://" + target_url

    try:
        run_image_audit(
            start_url=target_url,
            max_pages=args.max_pages,
            delay=args.delay,
            timeout=args.timeout,
            allow_subdomains=args.subdomains,
            size_threshold_kb=args.size_threshold,
            output_path=args.output
        )
    except KeyboardInterrupt:
        print("\nAudit interrupted by user.")
        sys.exit(130)
    except Exception as e:
        print(f"\nAudit failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
