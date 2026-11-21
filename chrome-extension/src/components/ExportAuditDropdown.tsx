import React, { useState, useRef, useEffect } from "react";
import {
  Download,
  ChevronDown,
  FileText,
  Code,
  Table,
  Check,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { PageAuditData, ScoreBreakdown, ClientProfile } from "../types/extension";
import {
  generateExecutiveHtmlReport,
  generateJsonLdPackage,
  generatePortfolioCsv,
  downloadFile,
  openHtmlInNewTab,
  copyTextToClipboard,
} from "../utils/auditExporters";

interface ExportAuditDropdownProps {
  pageData: PageAuditData;
  scores: ScoreBreakdown;
  activeProfile?: ClientProfile;
}

export function ExportAuditDropdown({
  pageData,
  scores,
  activeProfile,
}: ExportAuditDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const sanitizeSlug = (str: string): string => {
    return (str || "property")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const propertySlug = sanitizeSlug(pageData.hostname || "hotel");
  const dateSlug = new Date().toISOString().split("T")[0];

  // 1. Export Executive HTML Report
  const handleExportHtml = () => {
    setIsOpen(false);
    const html = generateExecutiveHtmlReport(pageData, scores, activeProfile);
    openHtmlInNewTab(html);
    downloadFile(
      html,
      `cogwheel-executive-audit-${propertySlug}-${dateSlug}.html`,
      "text/html;charset=utf-8"
    );
  };

  // 2. Export Copy-Ready JSON-LD Package
  const handleExportJsonLd = async () => {
    const jsonLd = generateJsonLdPackage(pageData, activeProfile);
    const success = await copyTextToClipboard(jsonLd);

    // Also offer direct file download
    downloadFile(
      jsonLd,
      `hotel-schema-package-${propertySlug}-${dateSlug}.jsonld`,
      "application/ld+json;charset=utf-8"
    );

    if (success) {
      setCopiedNotice("JSON-LD Package copied to clipboard!");
      setTimeout(() => {
        setCopiedNotice(null);
        setIsOpen(false);
      }, 1800);
    } else {
      setIsOpen(false);
    }
  };

  // 3. Export Portfolio CSV
  const handleExportCsv = () => {
    setIsOpen(false);
    const csv = generatePortfolioCsv(pageData, scores, activeProfile);
    downloadFile(
      csv,
      `cogwheel-portfolio-audit-${propertySlug}-${dateSlug}.csv`,
      "text/csv;charset=utf-8"
    );
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Export Audit Deliverables"
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="flex h-7 items-center gap-1.5 rounded-lg border border-[#27272A] bg-[#111113] px-2.5 text-xs font-medium text-[#A1A1AA] shadow-xs transition hover:bg-[#18181B] hover:text-[#FAFAFA]"
      >
        <Download className="h-3.5 w-3.5 text-emerald-400" />
        <span className="font-semibold text-[11px] tracking-wide text-[#FAFAFA]">
          Export
        </span>
        <ChevronDown
          className={`h-3 w-3 text-[#71717A] transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-2 w-80 rounded-xl border border-[#27272A] bg-[#111113]/95 p-1.5 shadow-2xl backdrop-blur-md z-50 animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Header Label */}
          <div className="px-2.5 py-1.5 border-b border-[#27272A]/80 mb-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717A]">
                Client Audit Deliverables
              </span>
              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                v2.7
              </span>
            </div>
          </div>

          {/* Feedback Banner if copied */}
          {copiedNotice && (
            <div className="mx-1 mb-1.5 flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
              <Check className="h-3.5 w-3.5 shrink-0" />
              <span>{copiedNotice}</span>
            </div>
          )}

          {/* Option 1: Executive HTML Report */}
          <button
            type="button"
            role="menuitem"
            onClick={handleExportHtml}
            className="flex w-full items-start gap-2.5 rounded-lg p-2 text-left transition hover:bg-[#18181B] group"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#27272A] bg-[#18181B] text-emerald-400 group-hover:border-emerald-500/40">
              <FileText className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#FAFAFA] group-hover:text-emerald-400 transition-colors">
                  Executive HTML Report
                </span>
                <span className="text-[9px] font-mono text-[#71717A] bg-[#18181B] px-1 py-0.2 rounded">
                  HTML / PDF
                </span>
              </div>
              <p className="text-[11px] text-[#A1A1AA] line-clamp-2 mt-0.5 leading-snug">
                Print-ready white-label report with 4 KPI scores, SERP preview, and remediation table.
              </p>
            </div>
          </button>

          {/* Option 2: Copy-Ready JSON-LD Package */}
          <button
            type="button"
            role="menuitem"
            onClick={handleExportJsonLd}
            className="flex w-full items-start gap-2.5 rounded-lg p-2 text-left transition hover:bg-[#18181B] group mt-0.5"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#27272A] bg-[#18181B] text-indigo-400 group-hover:border-indigo-500/40">
              <Code className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#FAFAFA] group-hover:text-indigo-400 transition-colors">
                  Copy JSON-LD Package
                </span>
                <span className="text-[9px] font-mono text-[#71717A] bg-[#18181B] px-1 py-0.2 rounded">
                  Structured Data
                </span>
              </div>
              <p className="text-[11px] text-[#A1A1AA] line-clamp-2 mt-0.5 leading-snug">
                Formatted &lt;script type=&quot;application/ld+json&quot;&gt; with Hotel &amp; FAQ schemas for developers.
              </p>
            </div>
          </button>

          {/* Option 3: Portfolio CSV Export */}
          <button
            type="button"
            role="menuitem"
            onClick={handleExportCsv}
            className="flex w-full items-start gap-2.5 rounded-lg p-2 text-left transition hover:bg-[#18181B] group mt-0.5"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#27272A] bg-[#18181B] text-sky-400 group-hover:border-sky-500/40">
              <Table className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#FAFAFA] group-hover:text-sky-400 transition-colors">
                  Portfolio CSV Export
                </span>
                <span className="text-[9px] font-mono text-[#71717A] bg-[#18181B] px-1 py-0.2 rounded">
                  CSV
                </span>
              </div>
              <p className="text-[11px] text-[#A1A1AA] line-clamp-2 mt-0.5 leading-snug">
                Clean tabular export for Monthly Visibility Decks, KPI dashboards, and tracking.
              </p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
