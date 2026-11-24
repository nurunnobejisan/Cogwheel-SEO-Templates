/**
 * Cogwheel SEO & GEO Studio - Client-Ready Audit Deliverables Generator
 *
 * Generates:
 * 1. Executive HTML Audit Report: Print-ready, white-label report for hotel owners & asset managers.
 * 2. Copy-Ready JSON-LD Package: Formatted <script type="application/ld+json"> for web developers.
 * 3. Portfolio CSV Export: Clean tabular row for monthly visibility decks and BI tracking.
 */

import { PageAuditData, ScoreBreakdown, ClientProfile, QuickWinItem } from "../types/extension";

/**
 * Escapes characters for safe HTML rendering.
 */
export function escapeHtml(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Escapes a cell value for RFC 4180 CSV compliance.
 */
export function escapeCsvCell(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Triggers an immediate browser file download for a string blob.
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Opens an HTML document string in a new browser tab for immediate viewing or printing.
 */
export function openHtmlInNewTab(htmlContent: string): void {
  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    // If pop-up blocked, fall back to download
    downloadFile(htmlContent, "executive-audit-report.html", "text/html;charset=utf-8");
  }
}

/**
 * Copies text to the user's clipboard safely.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textArea);
    return success;
  } catch {
    return false;
  }
}

/**
 * Derives the hotel brand name from page data or client profile.
 */
export function detectHotelBrand(pageData: PageAuditData, profile?: ClientProfile): string {
  if (profile?.brand && profile.brand !== "Independent") {
    return profile.brand;
  }
  const host = (pageData.hostname || "").toLowerCase();
  const url = (pageData.url || "").toLowerCase();
  const title = (pageData.title || "").toLowerCase();

  if (host.includes("marriott") || url.includes("marriott") || title.includes("marriott") || title.includes("bonvoy")) {
    return "Marriott";
  }
  if (host.includes("hilton") || url.includes("hilton") || title.includes("hilton") || title.includes("honors")) {
    return "Hilton";
  }
  if (host.includes("ihg") || url.includes("ihg") || title.includes("ihg") || title.includes("kimpton")) {
    return "IHG";
  }
  if (host.includes("hyatt") || url.includes("hyatt") || title.includes("hyatt")) {
    return "Hyatt";
  }
  return profile?.name || "Independent Luxury";
}

/**
 * Returns status pill label and CSS style based on score.
 */
function getScoreStatus(score: number): { label: string; bg: string; color: string; border: string } {
  if (score >= 90) {
    return {
      label: "OPTIMAL",
      bg: "#ecfdf5",
      color: "#059669",
      border: "#a7f3d0",
    };
  }
  if (score >= 70) {
    return {
      label: "NEEDS REVIEW",
      bg: "#fffbeb",
      color: "#d97706",
      border: "#fde68a",
    };
  }
  return {
    label: "CRITICAL",
    bg: "#fef2f2",
    color: "#dc2626",
    border: "#fecaca",
  };
}

/**
 * 1. Generates an Executive HTML Audit Report.
 * Clean, print-ready, white-label report suitable for hotel asset managers, owners, and CMOs.
 */
export function generateExecutiveHtmlReport(
  pageData: PageAuditData,
  scores: ScoreBreakdown,
  profile?: ClientProfile
): string {
  const brand = detectHotelBrand(pageData, profile);
  const auditDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const reportId = `AUD-${Date.now().toString(36).toUpperCase()}`;

  const overallStatus = getScoreStatus(scores.overall);
  const onPageStatus = getScoreStatus(scores.onPage);
  const schemaStatus = getScoreStatus(scores.schemaTechnical);
  const geoStatus = getScoreStatus(scores.geoAiReadiness);

  const titleLen = (pageData.title || "").trim().length;
  const titlePx = pageData.titlePixelWidth || 0;
  const metaLen = (pageData.metaDesc || "").trim().length;
  const metaPx = pageData.metaDescPixelWidth || 0;

  const quickWins = scores.quickWins || [];
  const hasStructuredSchema = (pageData.schemas || []).some((s) => {
    const t = String(s["@type"] || "").toLowerCase();
    return (
      t.includes("hotel") ||
      t.includes("lodging") ||
      t.includes("resort") ||
      t.includes("localbusiness") ||
      t.includes("organization") ||
      t.includes("website") ||
      t.includes("product") ||
      t.includes("article") ||
      t.includes("softwareapplication") ||
      t.includes("service")
    );
  });
  const hasFaqSchema = (pageData.schemas || []).some((s) =>
    String(s["@type"] || "").toLowerCase().includes("faq")
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Executive Audit Report - ${escapeHtml(pageData.hostname)}</title>
  <style>
    :root {
      --bg: #ffffff;
      --surface: #f8fafc;
      --surface-subtle: #f1f5f9;
      --border: #e2e8f0;
      --border-dark: #cbd5e1;
      --text: #0f172a;
      --text-muted: #64748b;
      --emerald: #059669;
      --amber: #d97706;
      --rose: #dc2626;
      --indigo: #4f46e5;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 32px;
      max-width: 1080px;
      margin: 0 auto;
    }

    .tabular-nums {
      font-variant-numeric: tabular-nums;
    }

    /* Print toolbar */
    .print-toolbar {
      position: sticky;
      top: 16px;
      z-index: 100;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      background: rgba(15, 23, 42, 0.9);
      backdrop-filter: blur(8px);
      padding: 10px 16px;
      border-radius: 12px;
      margin-bottom: 24px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      border: none;
      transition: all 0.15s ease;
    }

    .btn-primary {
      background: #10b981;
      color: #ffffff;
    }

    .btn-primary:hover {
      background: #059669;
    }

    .btn-secondary {
      background: #334155;
      color: #f1f5f9;
    }

    .btn-secondary:hover {
      background: #475569;
    }

    /* Header */
    .header {
      border-bottom: 2px solid var(--border);
      padding-bottom: 20px;
      margin-bottom: 28px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .brand-eyebrow {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--emerald);
      margin-bottom: 4px;
    }

    .report-title {
      font-size: 24px;
      font-weight: 800;
      color: var(--text);
      letter-spacing: -0.02em;
    }

    .meta-box {
      text-align: right;
      font-size: 12px;
      color: var(--text-muted);
    }

    .meta-id {
      font-weight: 700;
      color: var(--text);
    }

    /* Property Card */
    .property-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 28px;
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 20px;
      align-items: center;
    }

    .property-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 4px;
    }

    .property-value {
      font-size: 15px;
      font-weight: 600;
      color: var(--text);
      word-break: break-all;
    }

    .status-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 28px;
    }

    .kpi-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
      position: relative;
    }

    .kpi-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 8px;
    }

    .kpi-score {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: var(--text);
      margin-bottom: 8px;
    }

    .kpi-scale {
      font-size: 16px;
      font-weight: 500;
      color: var(--text-muted);
    }

    /* SERP Card */
    .serp-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 28px;
    }

    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .serp-box {
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      font-family: Arial, sans-serif;
    }

    .serp-breadcrumb {
      font-size: 12px;
      color: #202124;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .serp-title {
      font-size: 18px;
      color: #1a0dab;
      text-decoration: underline;
      line-height: 1.3;
      margin-bottom: 6px;
      font-weight: 400;
      word-break: break-word;
    }

    .serp-snippet {
      font-size: 13px;
      color: #4d5156;
      line-height: 1.5;
      word-break: break-word;
    }

    .spec-pills {
      display: flex;
      gap: 8px;
      margin-top: 10px;
      flex-wrap: wrap;
    }

    .spec-pill {
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 4px;
      background: var(--surface-subtle);
      border: 1px solid var(--border);
      color: var(--text-muted);
      font-weight: 500;
    }

    /* Remediation Table */
    .table-container {
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 28px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      text-align: left;
    }

    thead {
      background: var(--surface-subtle);
      border-bottom: 1px solid var(--border);
    }

    th {
      padding: 12px 16px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.05em;
    }

    td {
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
    }

    tr:last-child td {
      border-bottom: none;
    }

    .severity-pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .sev-high {
      background: #fef2f2;
      color: #dc2626;
      border: 1px solid #fecaca;
    }

    .sev-medium {
      background: #fffbeb;
      color: #d97706;
      border: 1px solid #fde68a;
    }

    .sev-low {
      background: #f0fdf4;
      color: #16a34a;
      border: 1px solid #bbf7d0;
    }

    /* Technical Appendix */
    .appendix-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 32px;
    }

    .appendix-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px 16px;
    }

    .appendix-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid var(--surface-subtle);
      font-size: 12px;
    }

    .appendix-row:last-child {
      border-bottom: none;
    }

    .appendix-label {
      color: var(--text-muted);
    }

    .appendix-val {
      font-weight: 600;
      color: var(--text);
    }

    /* Footer */
    .footer {
      border-top: 1px solid var(--border);
      padding-top: 20px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: var(--text-muted);
    }

    /* Print styles */
    @media print {
      body {
        padding: 0;
        background: #ffffff !important;
        color: #000000 !important;
      }

      .print-toolbar {
        display: none !important;
      }

      .kpi-card, .serp-card, .property-card, .table-container, .appendix-card {
        border-color: #cbd5e1 !important;
        background: #ffffff !important;
        page-break-inside: avoid;
      }

      .serp-box {
        border: 1px solid #94a3b8 !important;
      }

      @page {
        margin: 1.5cm;
      }
    }
  </style>
</head>
<body>

  <!-- Print Toolbar (Hidden during print) -->
  <div class="print-toolbar no-print">
    <button class="btn btn-secondary" onclick="window.close()">Close Window</button>
    <button class="btn btn-primary" onclick="window.print()">Print / Save as PDF</button>
  </div>

  <!-- Executive Header -->
  <header class="header">
    <div>
      <div class="brand-eyebrow">COGWHEEL SEO & GEO STUDIO</div>
      <h1 class="report-title">${escapeHtml(pageData.siteCategoryLabel || "Universal")} Executive Search & GEO Audit</h1>
    </div>
    <div class="meta-box">
      <div class="meta-id">Report ID: ${reportId}</div>
      <div>Audit Date: ${auditDate}</div>
      <div>Version: v3.0 Universal</div>
    </div>
  </header>

  <!-- Property Metadata Card -->
  <div class="property-card">
    <div>
      <div class="property-label">Inspected Target URL</div>
      <div class="property-value">${escapeHtml(pageData.url)}</div>
    </div>
    <div>
      <div class="property-label">Category & Platform</div>
      <div class="property-value">${escapeHtml(pageData.siteCategoryLabel || "Universal")} &bull; ${escapeHtml(pageData.detectedCmsLabel || "Web")}</div>
    </div>
    <div>
      <div class="property-label">Overall Audit Grade</div>
      <span class="status-badge" style="background: ${overallStatus.bg}; color: ${overallStatus.color}; border: 1px solid ${overallStatus.border};">
        ${escapeHtml(scores.grade)} (${overallStatus.label})
      </span>
    </div>
  </div>

  <!-- KPI Score Cards -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-title">Composite SEO Score</div>
      <div class="kpi-score tabular-nums">${scores.overall}<span class="kpi-scale">/100</span></div>
      <span class="status-badge" style="background: ${overallStatus.bg}; color: ${overallStatus.color}; border: 1px solid ${overallStatus.border};">
        ${overallStatus.label}
      </span>
    </div>

    <div class="kpi-card">
      <div class="kpi-title">On-Page Architecture</div>
      <div class="kpi-score tabular-nums">${scores.onPage}<span class="kpi-scale">/100</span></div>
      <span class="status-badge" style="background: ${onPageStatus.bg}; color: ${onPageStatus.color}; border: 1px solid ${onPageStatus.border};">
        ${onPageStatus.label}
      </span>
    </div>

    <div class="kpi-card">
      <div class="kpi-title">Schema & Technical</div>
      <div class="kpi-score tabular-nums">${scores.schemaTechnical}<span class="kpi-scale">/100</span></div>
      <span class="status-badge" style="background: ${schemaStatus.bg}; color: ${schemaStatus.color}; border: 1px solid ${schemaStatus.border};">
        ${schemaStatus.label}
      </span>
    </div>

    <div class="kpi-card">
      <div class="kpi-title">GEO AI Readiness</div>
      <div class="kpi-score tabular-nums">${scores.geoAiReadiness}<span class="kpi-scale">/100</span></div>
      <span class="status-badge" style="background: ${geoStatus.bg}; color: ${geoStatus.color}; border: 1px solid ${geoStatus.border};">
        ${geoStatus.label}
      </span>
    </div>
  </div>

  <!-- SERP Preview Mockup -->
  <div class="serp-card">
    <div class="section-title">Live SERP & Snippet Presentation</div>
    <div class="serp-box">
      <div class="serp-breadcrumb">
        <span>https://${escapeHtml(pageData.hostname)}</span>
        <span>&rsaquo;</span>
        <span>${escapeHtml(pageData.pathname || "")}</span>
      </div>
      <div class="serp-title">${escapeHtml(pageData.title || "Untitled Document")}</div>
      <div class="serp-snippet">${escapeHtml(pageData.metaDesc || "No meta description provided by property web server.")}</div>
    </div>
    <div class="spec-pills tabular-nums">
      <span class="spec-pill">Title: ${titleLen} chars | ${titlePx}px (Limit: 580px)</span>
      <span class="spec-pill">Meta: ${metaLen} chars | ${metaPx}px (Limit: 920px)</span>
      <span class="spec-pill">Canonical: ${pageData.canonical ? "Present" : "Missing"}</span>
      <span class="spec-pill">Viewport: ${pageData.hasViewport ? "Mobile Optimized" : "Missing"}</span>
    </div>
  </div>

  <!-- Prioritized Remediation Roadmap -->
  <div class="section-title">Prioritized Remediation Roadmap (${quickWins.length} Items)</div>
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th style="width: 120px;">Severity</th>
          <th style="width: 200px;">Audit Check</th>
          <th>Diagnostic Finding & Ranking Impact</th>
          <th style="width: 220px;">Prescribed Technical Action</th>
        </tr>
      </thead>
      <tbody>
        ${
          quickWins.length === 0
            ? `<tr>
                <td colspan="4" style="text-align: center; color: var(--emerald); font-weight: 600; padding: 24px;">
                  All 6 core hospitality search quality gates passed. Property page is fully optimized.
                </td>
              </tr>`
            : quickWins
                .map((win) => {
                  const sevClass =
                    win.severity === "high"
                      ? "sev-high"
                      : win.severity === "medium"
                      ? "sev-medium"
                      : "sev-low";
                  return `<tr>
                    <td>
                      <span class="severity-pill ${sevClass}">${escapeHtml(win.severity)}</span>
                    </td>
                    <td style="font-weight: 600; color: var(--text);">
                      ${escapeHtml(win.title)}
                    </td>
                    <td style="color: var(--text-muted);">
                      ${escapeHtml(win.impact)}
                    </td>
                    <td>
                      <span style="font-family: monospace; font-size: 11px; background: var(--surface-subtle); padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border); display: inline-block;">
                        ${escapeHtml(win.templateIdToFix || "Apply Code Patch")}
                      </span>
                    </td>
                  </tr>`;
                })
                .join("")
        }
      </tbody>
    </table>
  </div>

  <!-- Technical Specifications Appendix -->
  <div class="section-title">Technical Specifications & DOM Inventory</div>
  <div class="appendix-grid tabular-nums">
    <div class="appendix-card">
      <div class="appendix-row">
        <span class="appendix-label">Self-Referencing Canonical</span>
        <span class="appendix-val">${pageData.canonical ? "Enforced" : "Missing Tag"}</span>
      </div>
      <div class="appendix-row">
        <span class="appendix-label">H1 Headings Detected</span>
        <span class="appendix-val">${pageData.h1Elements?.length || 0} tag(s)</span>
      </div>
      <div class="appendix-row">
        <span class="appendix-label">Body Content Word Count</span>
        <span class="appendix-val">${pageData.words || 0} words</span>
      </div>
      <div class="appendix-row">
        <span class="appendix-label">Internal Navigation Links</span>
        <span class="appendix-val">${pageData.links?.internal || 0} links</span>
      </div>
    </div>

    <div class="appendix-card">
      <div class="appendix-row">
        <span class="appendix-label">Schema.org Structured Data</span>
        <span class="appendix-val">${hasStructuredSchema ? "Verified" : "Action Required"}</span>
      </div>
      <div class="appendix-row">
        <span class="appendix-label">Schema.org/FAQPage for AI Engine</span>
        <span class="appendix-val">${hasFaqSchema ? "Verified" : "Missing"}</span>
      </div>
      <div class="appendix-row">
        <span class="appendix-label">Total Images / Missing Alt Attributes</span>
        <span class="appendix-val">${pageData.totalImages || 0} total / ${pageData.imagesWithoutAlt || 0} missing alt</span>
      </div>
      <div class="appendix-row">
        <span class="appendix-label">Open Graph & Social Share Protocol</span>
        <span class="appendix-val">${pageData.hasOgTitle && pageData.hasOgImage ? "Full Protocol" : "Incomplete"}</span>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <footer class="footer">
    <div>Generated by Cogwheel SEO & GEO Studio v3.0 Universal</div>
    <div>Confidential Stakeholder Deliverable</div>
  </footer>

</body>
</html>`;
}

/**
 * 2. Generates a Copy-Ready JSON-LD Package.
 * Combines detected schemas or synthesizes compliant structured data.
 */
export function generateJsonLdPackage(
  pageData: PageAuditData,
  profile?: ClientProfile
): string {
  const brand = detectHotelBrand(pageData, profile);
  const entityName = profile?.name || pageData.h1Elements?.[0] || pageData.title?.split("|")[0]?.split("-")[0]?.trim() || "Official Site";
  const propertyUrl = pageData.canonical || pageData.url || "https://example.com/page";
  const phone = profile?.phone || "+1-800-555-0199";
  const address = profile?.address || "100 Main St";
  const city = profile?.city || "New York";
  const state = profile?.state || "NY";
  const postal = profile?.postalCode || "10001";
  const cat = pageData.siteCategory || "general";

  // Existing schemas or fallback synthesis
  const existingSchemas = pageData.schemas || [];
  const hasStructured = existingSchemas.some((s) => {
    const t = String(s["@type"] || "").toLowerCase();
    return (
      t.includes("hotel") ||
      t.includes("lodging") ||
      t.includes("resort") ||
      t.includes("localbusiness") ||
      t.includes("organization") ||
      t.includes("website") ||
      t.includes("product") ||
      t.includes("article") ||
      t.includes("softwareapplication") ||
      t.includes("service")
    );
  });
  const hasFaq = existingSchemas.some((s) =>
    String(s["@type"] || "").toLowerCase().includes("faq")
  );

  const schemasToInclude: any[] = [...existingSchemas];

  if (!hasStructured) {
    if (cat === "ecommerce") {
      const ecom = pageData.ecommerce;
      schemasToInclude.push({
        "@type": "Product",
        "@id": `${propertyUrl}#product`,
        name: entityName,
        url: propertyUrl,
        description: pageData.metaDesc || "",
        brand: { "@type": "Brand", name: brand },
        offers: {
          "@type": "Offer",
          url: propertyUrl,
          priceCurrency: ecom?.currency || "USD",
          price: ecom?.price ? ecom.price.replace(/[^0-9.]/g, "") : "99.00",
          availability: `https://schema.org/${ecom?.availability || "InStock"}`,
          itemCondition: "https://schema.org/NewCondition",
        },
      });
    } else if (cat === "saas") {
      schemasToInclude.push({
        "@type": "SoftwareApplication",
        "@id": `${propertyUrl}#software`,
        name: entityName,
        url: propertyUrl,
        description: pageData.metaDesc || "",
        applicationCategory: "BusinessApplication",
        operatingSystem: "All",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      });
    } else if (cat === "editorial") {
      schemasToInclude.push({
        "@type": "Article",
        "@id": `${propertyUrl}#article`,
        headline: pageData.title || entityName,
        description: pageData.metaDesc || "",
        url: propertyUrl,
        mainEntityOfPage: propertyUrl,
        author: {
          "@type": "Person",
          name: profile?.name || pageData.hostname || "Editorial Team",
        },
        publisher: {
          "@type": "Organization",
          name: brand,
          url: pageData.origin || propertyUrl,
        },
      });
    } else if (cat === "local_business") {
      schemasToInclude.push({
        "@type": "LocalBusiness",
        "@id": `${propertyUrl}#localbusiness`,
        name: entityName,
        url: propertyUrl,
        telephone: phone,
        address: {
          "@type": "PostalAddress",
          streetAddress: address,
          addressLocality: city,
          addressRegion: state,
          postalCode: postal,
          addressCountry: "US",
        },
      });
    } else if (cat === "hospitality") {
      schemasToInclude.push({
        "@type": "Hotel",
        "@id": `${propertyUrl}#hotel`,
        name: entityName,
        brand: {
          "@type": "Brand",
          name: brand,
        },
        url: propertyUrl,
        telephone: phone,
        priceRange: "$$$",
        address: {
          "@type": "PostalAddress",
          streetAddress: address,
          addressLocality: city,
          addressRegion: state,
          postalCode: postal,
          addressCountry: "US",
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: 25.7617,
          longitude: -80.1918,
        },
        checkinTime: "16:00",
        checkoutTime: "11:00",
      });
    } else {
      schemasToInclude.push({
        "@type": "Organization",
        "@id": `${pageData.origin || propertyUrl}#organization`,
        name: brand,
        url: pageData.origin || propertyUrl,
        description: pageData.metaDesc || "",
      });
    }
  }

  if (!hasFaq) {
    schemasToInclude.push({
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: `What solutions or services does ${entityName} provide?`,
          acceptedAnswer: {
            "@type": "Answer",
            text: `${entityName} provides verified solutions with direct official access, enterprise reliability, and customer satisfaction guarantees.`,
          },
        },
        {
          "@type": "Question",
          name: `How can I contact or get started with ${entityName}?`,
          acceptedAnswer: {
            "@type": "Answer",
            text: `You can reach out directly via our official website at ${propertyUrl} or by calling ${phone} for immediate assistance.`,
          },
        },
      ],
    });
  }

  const payload = {
    "@context": "https://schema.org",
    "@graph": schemasToInclude,
  };

  return `<!-- Cogwheel SEO Studio - Validated Schema.org Structured Data Package -->
<!-- Property: ${propertyUrl} -->
<!-- Platform: ${pageData.detectedCmsLabel || "Universal"} | Category: ${pageData.siteCategoryLabel || cat.toUpperCase()} -->
<!-- Generated: ${new Date().toISOString()} -->
<script type="application/ld+json">
${JSON.stringify(payload, null, 2)}
</script>`;
}

/**
 * 3. Generates Portfolio CSV Export.
 * Clean tabular row for portfolios, monthly visibility decks, and BI reporting.
 */
export function generatePortfolioCsv(
  pageData: PageAuditData,
  scores: ScoreBreakdown,
  profile?: ClientProfile
): string {
  const brand = detectHotelBrand(pageData, profile);
  const auditDate = new Date().toISOString();

  const titleLen = (pageData.title || "").trim().length;
  const titlePx = pageData.titlePixelWidth || 0;
  const metaLen = (pageData.metaDesc || "").trim().length;
  const metaPx = pageData.metaDescPixelWidth || 0;

  const hasStructured = (pageData.schemas || []).some((s) => {
    const t = String(s["@type"] || "").toLowerCase();
    return (
      t.includes("hotel") ||
      t.includes("lodging") ||
      t.includes("resort") ||
      t.includes("localbusiness") ||
      t.includes("organization") ||
      t.includes("website") ||
      t.includes("product") ||
      t.includes("article") ||
      t.includes("softwareapplication") ||
      t.includes("service")
    );
  });
  const hasFaqSchema = (pageData.schemas || []).some((s) =>
    String(s["@type"] || "").toLowerCase().includes("faq")
  );

  const quickWins = scores.quickWins || [];
  const remediationSummary = quickWins.map((w) => `${w.severity.toUpperCase()}: ${w.title}`).join("; ");

  const headers = [
    "Target URL",
    "Domain",
    "Brand",
    "Site Category",
    "Detected CMS",
    "Composite Score",
    "Grade",
    "On-Page Score",
    "Schema Score",
    "GEO AI Score",
    "Title Tag",
    "Title Length Chars",
    "Title Pixel Width",
    "Meta Description",
    "Meta Description Length Chars",
    "Meta Description Pixel Width",
    "Canonical URL",
    "Primary H1",
    "H1 Tag Count",
    "Word Count",
    "Total Images",
    "Missing Alt Images",
    "Has Structured Schema",
    "Has FAQ Schema",
    "Has Open Graph",
    "Critical Issues Count",
    "Remediation Summary",
    "Audit Timestamp",
  ];

  const row = [
    pageData.url,
    pageData.hostname,
    brand,
    pageData.siteCategoryLabel || pageData.siteCategory || "General",
    pageData.detectedCmsLabel || pageData.detectedCms || "Standard DOM",
    scores.overall,
    scores.grade,
    scores.onPage,
    scores.schemaTechnical,
    scores.geoAiReadiness,
    pageData.title,
    titleLen,
    titlePx,
    pageData.metaDesc,
    metaLen,
    metaPx,
    pageData.canonical,
    pageData.h1Elements?.[0] || "",
    pageData.h1Elements?.length || 0,
    pageData.words,
    pageData.totalImages,
    pageData.imagesWithoutAlt,
    hasStructured ? "YES" : "NO",
    hasFaqSchema ? "YES" : "NO",
    pageData.hasOgTitle && pageData.hasOgImage ? "YES" : "NO",
    quickWins.length,
    remediationSummary,
    auditDate,
  ];

  const headerLine = headers.map(escapeCsvCell).join(",");
  const rowLine = row.map(escapeCsvCell).join(",");

  return `${headerLine}\n${rowLine}\n`;
}
