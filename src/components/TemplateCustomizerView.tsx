"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { type SeoTemplate, type TemplateVariables } from "@/packs/hotel/templates";
import {
  calculatePixelWidth,
  getTitlePixelStatus,
  getMetaDescPixelStatus,
  TITLE_PIXEL_LIMIT,
  META_DESC_PIXEL_LIMIT,
} from "@/engine/pixelCalculator";
import {
  resolveTemplate,
  type ResolutionResult,
  type TemplateSchema,
} from "../../validators/variableResolver";
import { escapeHtml } from "../../validators/xssProtection";
import { renderBracketTokens } from "../../shared/ts/template-render";

/**
 * Schema every customizer render validates against (Phase E wiring of
 * `validators/variableResolver`): all five catalog variables are required for
 * a complete export — clearing any field surfaces it in the preview audit.
 */
const CUSTOMIZER_SCHEMA: TemplateSchema = {
  id: "template-customizer",
  name: "Template Customizer",
  variables: {
    brandName: { name: "brandName", required: true, description: "Property / brand name" },
    primaryKeyword: { name: "primaryKeyword", required: true, description: "Primary keyword" },
    targetUrl: { name: "targetUrl", required: true, description: "Target URL" },
    locationNiche: { name: "locationNiche", required: true, description: "Location / niche" },
    competitorDomain: { name: "competitorDomain", required: true, description: "Competitor domain" },
  },
};

/** RFC-4180 field: wrap in quotes, double embedded quotes. */
export function csvEscapeField(value: string): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

/**
 * Clipboard-ready HTML for the customizer export. Every interpolated field
 * goes through `escapeHtml` (validators/xssProtection) — title and meta
 * description previously reached the clipboard unescaped.
 */
export function buildCustomizerExportHtml(title: string, description: string, markdown: string): string {
  return `<article>\n  <h1>${escapeHtml(title)}</h1>\n  <p>${escapeHtml(description)}</p>\n  <hr/>\n  <pre>${escapeHtml(markdown)}</pre>\n</article>`;
}

interface Props {
  template: SeoTemplate;
  relatedTemplates: SeoTemplate[];
}

export function TemplateCustomizerView({ template, relatedTemplates }: Props) {
  // 1. Dynamic Variables State
  const [vars, setVars] = useState<TemplateVariables>({ ...template.defaultVariables });

  // 2. Tab Navigation inside detail
  const [activeTab, setActiveTab] = useState<"customizer" | "serp" | "schema" | "mistakes">("customizer");

  // 3. SERP View Mode (Desktop vs. Mobile)
  const [serpMode, setSerpMode] = useState<"desktop" | "mobile">("desktop");

  // 4. Checklist Progress State (persisted in localStorage)
  const [checkedTasks, setCheckedTasks] = useState<Record<string, boolean>>({});

  // 5. Bookmarked state
  const [isBookmarked, setIsBookmarked] = useState(false);

  // 6. Toast Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load persistence from localStorage on mount
  useEffect(() => {
    try {
      const storedProgress = localStorage.getItem(`seo-studio_progress_${template.id}`);
      if (storedProgress) {
        setCheckedTasks(JSON.parse(storedProgress));
      }
      const storedBookmarks = localStorage.getItem("cogwheel_bookmarks");
      if (storedBookmarks) {
        const bookmarks: string[] = JSON.parse(storedBookmarks);
        setIsBookmarked(bookmarks.includes(template.id));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [template.id]);

  // Helper to trigger toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Toggle task completion
  const toggleTask = (taskId: string) => {
    setCheckedTasks((prev) => {
      const updated = { ...prev, [taskId]: !prev[taskId] };
      try {
        localStorage.setItem(`seo-studio_progress_${template.id}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Toggle bookmark
  const toggleBookmark = () => {
    try {
      const stored = localStorage.getItem("cogwheel_bookmarks");
      let list: string[] = stored ? JSON.parse(stored) : [];
      if (list.includes(template.id)) {
        list = list.filter((id) => id !== template.id);
        setIsBookmarked(false);
        showToast("Removed from Saved Templates");
      } else {
        list.push(template.id);
        setIsBookmarked(true);
        showToast("Template Saved to Bookmarks");
      }
      localStorage.setItem("cogwheel_bookmarks", JSON.stringify(list));
    } catch {}
  };

  // One renderer (Phase E): bracket tokens from the shared engine, then the
  // variableResolver validation layers (required-variable check + leak scan).
  const renderText = useCallback(
    (text: string): ResolutionResult => {
      if (!text) {
        return { success: true, output: "", missingVariables: [], unresolvedPlaceholders: [], warnings: [] };
      }
      const bracketed = renderBracketTokens(text, {
        "[Brand Name]": vars.brandName || "[Brand Name]",
        "[Primary Keyword]": vars.primaryKeyword || "[Primary Keyword]",
        "[Target URL]": vars.targetUrl || "[Target URL]",
        "[Location/Niche]": vars.locationNiche || "[Location/Niche]",
        "[LocationNiche]": vars.locationNiche || "[Location/Niche]",
        "[Competitor Domain]": vars.competitorDomain || "[Competitor Domain]",
      });
      return resolveTemplate(bracketed, CUSTOMIZER_SCHEMA, { ...vars }, { strict: false });
    },
    [vars]
  );

  // Compute customized Title and Meta Description
  const customizedTitle = useMemo(() => {
    return `${vars.brandName} — ${vars.primaryKeyword} in ${vars.locationNiche}`;
  }, [vars.brandName, vars.primaryKeyword, vars.locationNiche]);

  const customizedDesc = useMemo(() => {
    return `Discover luxury at ${vars.brandName}. Book direct for ${vars.primaryKeyword} in ${vars.locationNiche} with waterfront views, verified reviews, and best rates at ${vars.targetUrl}.`;
  }, [vars.brandName, vars.primaryKeyword, vars.locationNiche, vars.targetUrl]);

  // Pixel calculations
  const titlePixel = useMemo(() => getTitlePixelStatus(customizedTitle), [customizedTitle]);
  const descPixel = useMemo(() => getMetaDescPixelStatus(customizedDesc), [customizedDesc]);

  // Customized Markdown — full resolution (output + validation audit)
  const markdownResolution = useMemo(
    () => renderText(template.contentMarkdown),
    [template.contentMarkdown, renderText]
  );
  const customizedMarkdown = markdownResolution.output;

  // Dynamic JSON-LD Schema
  const dynamicSchema = useMemo(() => {
    const baseUrl = vars.targetUrl || "https://www.example.com";
    if (template.schemaType === "Hotel") {
      return {
        "@context": "https://schema.org",
        "@type": "Hotel",
        name: vars.brandName,
        url: baseUrl,
        description: customizedDesc,
        address: {
          "@type": "PostalAddress",
          addressLocality: vars.locationNiche,
        },
        amenityFeature: [
          { "@type": "LocationFeatureSpecification", name: "High-Speed Wi-Fi", value: true },
          { "@type": "LocationFeatureSpecification", name: "Valet Parking", value: true },
        ],
      };
    } else if (template.schemaType === "LocalBusiness") {
      return {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: vars.brandName,
        url: baseUrl,
        description: customizedDesc,
        telephone: "+1-800-555-0199",
        areaServed: vars.locationNiche,
      };
    } else if (template.schemaType === "FAQPage") {
      return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: `What makes ${vars.brandName} the premier ${vars.primaryKeyword} in ${vars.locationNiche}?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `${vars.brandName} delivers authentic hospitality, luxury amenities, and prime central access in ${vars.locationNiche}. Direct bookings receive guaranteed rates at ${vars.targetUrl}.`,
            },
          },
        ],
      };
    } else {
      return {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: customizedTitle,
        description: customizedDesc,
        author: {
          "@type": "Organization",
          name: vars.brandName,
        },
        publisher: {
          "@type": "Organization",
          name: "SEO Studio",
          url: baseUrl,
        },
      };
    }
  }, [vars, customizedTitle, customizedDesc, template.schemaType]);

  const schemaString = useMemo(() => JSON.stringify(dynamicSchema, null, 2), [dynamicSchema]);

  // Export actions
  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(customizedMarkdown);
    showToast("Markdown copied to clipboard!");
  };

  const handleCopyHtml = () => {
    const html = buildCustomizerExportHtml(customizedTitle, customizedDesc, customizedMarkdown);
    navigator.clipboard.writeText(html);
    showToast("Clean HTML copied to clipboard!");
  };

  const handleCopySchema = () => {
    navigator.clipboard.writeText(schemaString);
    showToast("JSON-LD Schema copied to clipboard!");
  };

  const handleDownloadCsv = () => {
    const headers = "ID,Task,Priority,Status,Description\n";
    const rows = template.checklist
      .map((c) =>
        [
          c.id,
          renderText(c.task).output,
          c.priority,
          checkedTasks[c.id] ? "Completed" : "Pending",
          renderText(c.description).output,
        ]
          .map(csvEscapeField)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${template.slug}-checklist.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Checklist CSV downloaded!");
  };

  const handleDownloadJson = () => {
    const payload = {
      templateId: template.id,
      title: customizedTitle,
      variables: vars,
      checklist: template.checklist.map((c) => ({
        ...c,
        completed: Boolean(checkedTasks[c.id]),
      })),
      schema: dynamicSchema,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${template.slug}-config.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("JSON payload downloaded!");
  };

  const completedCount = template.checklist.filter((c) => checkedTasks[c.id]).length;
  const progressPercent = Math.round((completedCount / template.checklist.length) * 100);

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-caption font-semibold text-white shadow-2xl transition animate-in fade-in slide-in-from-bottom-2 dark:bg-emerald-600">
          <svg className="h-4 w-4 text-emerald-400 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Multi-Format Export Bar & Action Header */}
      <section className="print:hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleBookmark}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-caption font-semibold transition ${
                isBookmarked
                  ? "border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-500/60 dark:bg-amber-950/40 dark:text-amber-300"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              <svg className={`h-4 w-4 ${isBookmarked ? "text-amber-500 fill-amber-500" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <span>{isBookmarked ? "Bookmarked" : "Save Template"}</span>
            </button>

            <div className="flex items-center gap-2 text-caption text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-800 dark:text-slate-200">Progress:</span>
              <div className="h-2 w-24 rounded-full bg-slate-100 overflow-hidden dark:bg-slate-800">
                <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
              </div>
              <span className="font-mono text-tiny">{completedCount}/{template.checklist.length}</span>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-caption font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Copy Markdown
            </button>
            <button
              type="button"
              onClick={handleCopyHtml}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-caption font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Copy HTML
            </button>
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-caption font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Download .CSV
            </button>
            <button
              type="button"
              onClick={handleDownloadJson}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-caption font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Download .JSON
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl bg-slate-900 px-3 py-1.5 text-caption font-bold text-white shadow-xs transition hover:bg-slate-800 dark:bg-brand dark:text-slate-950"
            >
              Print / PDF
            </button>
          </div>
        </div>
      </section>

      {/* Dynamic Placeholder Customizer Bar */}
      <section className="print:hidden rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div>
            <h3 className="font-display text-body font-bold text-slate-900 dark:text-white">
              Dynamic Template Customizer &amp; Placeholder Replacer
            </h3>
            <p className="text-caption text-slate-500 dark:text-slate-400">
              Type your property details below to update copy, checklist items, and SERP simulator in real time.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setVars({ ...template.defaultVariables })}
            className="text-caption font-semibold text-brand-dark hover:underline dark:text-brand"
          >
            Reset Defaults
          </button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="text-tiny font-bold text-slate-700 dark:text-slate-300">
              [Brand Name]
            </label>
            <input
              type="text"
              value={vars.brandName}
              onChange={(e) => setVars((v) => ({ ...v, brandName: e.target.value }))}
              placeholder="e.g. Ocean Palms Resort"
              className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-caption text-slate-900 focus:border-brand focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="text-tiny font-bold text-slate-700 dark:text-slate-300">
              [Primary Keyword]
            </label>
            <input
              type="text"
              value={vars.primaryKeyword}
              onChange={(e) => setVars((v) => ({ ...v, primaryKeyword: e.target.value }))}
              placeholder="e.g. luxury beachfront hotel"
              className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-caption text-slate-900 focus:border-brand focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="text-tiny font-bold text-slate-700 dark:text-slate-300">
              [Target URL]
            </label>
            <input
              type="url"
              value={vars.targetUrl}
              onChange={(e) => setVars((v) => ({ ...v, targetUrl: e.target.value }))}
              placeholder="https://www.example.com"
              className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-caption text-slate-900 focus:border-brand focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="text-tiny font-bold text-slate-700 dark:text-slate-300">
              [Location/Niche]
            </label>
            <input
              type="text"
              value={vars.locationNiche}
              onChange={(e) => setVars((v) => ({ ...v, locationNiche: e.target.value }))}
              placeholder="e.g. Miami Beach, FL"
              className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-caption text-slate-900 focus:border-brand focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="text-tiny font-bold text-slate-700 dark:text-slate-300">
              [Competitor Domain]
            </label>
            <input
              type="text"
              value={vars.competitorDomain}
              onChange={(e) => setVars((v) => ({ ...v, competitorDomain: e.target.value }))}
              placeholder="https://competitor.com"
              className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-caption text-slate-900 focus:border-brand focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>
      </section>

      {/* Main Tab Navigation */}
      <nav aria-label="Template Detail Sections" className="print:hidden flex items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab("customizer")}
          className={`rounded-xl px-3 py-1.5 text-caption font-bold transition ${
            activeTab === "customizer"
              ? "bg-slate-900 text-brand-light shadow-sm dark:bg-brand dark:text-slate-950"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          Template &amp; Checklist ({template.checklist.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("serp")}
          className={`rounded-xl px-3 py-1.5 text-caption font-bold transition ${
            activeTab === "serp"
              ? "bg-slate-900 text-brand-light shadow-sm dark:bg-brand dark:text-slate-950"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          Live SERP Simulator ({titlePixel.pixelWidth}px)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("schema")}
          className={`rounded-xl px-3 py-1.5 text-caption font-bold transition ${
            activeTab === "schema"
              ? "bg-slate-900 text-brand-light shadow-sm dark:bg-brand dark:text-slate-950"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          JSON-LD Schema Generator
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("mistakes")}
          className={`rounded-xl px-3 py-1.5 text-caption font-bold transition ${
            activeTab === "mistakes"
              ? "bg-slate-900 text-brand-light shadow-sm dark:bg-brand dark:text-slate-950"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          Mistakes &amp; KPI Benchmarks
        </button>
      </nav>

      {/* Tab 1: Template & Checklist */}
      {activeTab === "customizer" && (
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Markdown Content */}
          <article className="space-y-6 lg:col-span-2">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <span className="text-caption font-mono text-slate-500 dark:text-slate-400">
                  Customized Blueprint Preview
                </span>
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="text-caption font-bold text-brand-dark hover:underline dark:text-brand"
                >
                  Copy All &rarr;
                </button>
              </div>
              <div className="prose prose-slate max-w-none pt-4 text-caption dark:prose-invert">
                <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 font-mono text-slate-800 dark:bg-slate-950/80 dark:text-slate-200">
                  {customizedMarkdown}
                </pre>
              </div>
              {(markdownResolution.missingVariables.length > 0 ||
                markdownResolution.unresolvedPlaceholders.length > 0) && (
                <div
                  role="status"
                  className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-tiny text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
                >
                  Unresolved:{" "}
                  {Array.from(
                    new Set([
                      ...markdownResolution.missingVariables,
                      ...markdownResolution.unresolvedPlaceholders,
                    ])
                  ).join(", ")}{" "}
                  — fill the variable fields to complete substitution.
                </div>
              )}
            </div>
          </article>

          {/* Interactive Checklist Sidebar */}
          <aside aria-label="Action Checklist" className="space-y-6">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <h4 className="font-display text-body font-bold text-slate-900 dark:text-white">
                  Step-by-Step Task Checklist
                </h4>
                <span className="text-tiny font-mono font-bold text-emerald-600">
                  {progressPercent}% Done
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {template.checklist.map((c) => {
                  const isDone = Boolean(checkedTasks[c.id]);
                  return (
                    <div
                      key={c.id}
                      onClick={() => toggleTask(c.id)}
                      className={`cursor-pointer rounded-xl border p-3 transition ${
                        isDone
                          ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                          : "border-slate-200/80 bg-slate-50/50 hover:bg-white dark:border-slate-800 dark:bg-slate-950/40"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={isDone}
                          onChange={() => {}}
                          className="mt-0.5 h-4 w-4 rounded accent-emerald-600"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-caption font-bold ${
                                isDone
                                  ? "line-through text-slate-400 dark:text-slate-500"
                                  : "text-slate-900 dark:text-white"
                              }`}
                            >
                              {renderText(c.task).output}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-micro font-bold ${
                                c.priority === "Critical"
                                  ? "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                                  : "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                              }`}
                            >
                              {c.priority}
                            </span>
                          </div>
                          <p className="mt-1 text-tiny text-slate-500 dark:text-slate-400">
                            {renderText(c.description).output}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Tab 2: Live SERP Simulator */}
      {activeTab === "serp" && (
        <section className="space-y-6 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Live Google SERP Pixel Simulator
              </h3>
              <p className="text-caption text-slate-500 dark:text-slate-400">
                Exact physical width measurement in Arial 20px (Title: max {TITLE_PIXEL_LIMIT}px) and Arial 14px (Meta Description: max {META_DESC_PIXEL_LIMIT}px).
              </p>
            </div>

            {/* Desktop / Mobile Switcher */}
            <div className="flex items-center rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setSerpMode("desktop")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-caption font-semibold transition ${
                  serpMode === "desktop"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Desktop Preview
              </button>
              <button
                type="button"
                onClick={() => setSerpMode("mobile")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-caption font-semibold transition ${
                  serpMode === "mobile"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Mobile Preview
              </button>
            </div>
          </div>

          {/* Pixel Gauges & Counter Cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Title Pixel Meter */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="flex items-center justify-between text-caption">
                <span className="font-bold text-slate-700 dark:text-slate-300">Title Tag Width</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-micro font-bold ${
                    titlePixel.isOver
                      ? "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                      : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                  }`}
                >
                  {titlePixel.pixelWidth}px / {TITLE_PIXEL_LIMIT}px
                </span>
              </div>
              <div className="mt-2 h-2.5 w-full rounded-full bg-slate-200 overflow-hidden dark:bg-slate-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    titlePixel.isOver ? "bg-red-500" : titlePixel.pixelWidth > TITLE_PIXEL_LIMIT - 40 ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(titlePixel.percentage, 100)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-tiny text-slate-500 dark:text-slate-400">
                <span>{customizedTitle.length} Characters</span>
                <span>{titlePixel.isOver ? `Truncated by ${titlePixel.pixelWidth - TITLE_PIXEL_LIMIT}px` : `${titlePixel.remainingPx}px buffer remaining`}</span>
              </div>
            </div>

            {/* Description Pixel Meter */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="flex items-center justify-between text-caption">
                <span className="font-bold text-slate-700 dark:text-slate-300">Meta Description Width</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-micro font-bold ${
                    descPixel.isOver
                      ? "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                      : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                  }`}
                >
                  {descPixel.pixelWidth}px / {META_DESC_PIXEL_LIMIT}px
                </span>
              </div>
              <div className="mt-2 h-2.5 w-full rounded-full bg-slate-200 overflow-hidden dark:bg-slate-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    descPixel.isOver ? "bg-red-500" : descPixel.pixelWidth > META_DESC_PIXEL_LIMIT - 60 ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(descPixel.percentage, 100)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-tiny text-slate-500 dark:text-slate-400">
                <span>{customizedDesc.length} Characters</span>
                <span>{descPixel.isOver ? `Truncated by ${descPixel.pixelWidth - META_DESC_PIXEL_LIMIT}px` : `${descPixel.remainingPx}px buffer remaining`}</span>
              </div>
            </div>
          </div>

          {/* Rendered Google SERP Preview Box */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
            <div className="text-micro font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
              Google SERP Result Preview &bull; {serpMode.toUpperCase()} VIEWPORT
            </div>

            <div
              className={`space-y-1 font-sans ${
                serpMode === "mobile" ? "max-w-sm rounded-xl border border-slate-200 p-4 shadow-sm dark:border-slate-800" : "max-w-2xl"
              }`}
            >
              {/* URL & Breadcrumb */}
              <div className="flex items-center gap-2 text-caption">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-micro font-bold text-slate-700">
                  {vars.brandName ? vars.brandName.charAt(0) : "G"}
                </span>
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-tiny font-medium text-slate-800 dark:text-slate-200">
                    {vars.brandName || "Hotel Brand"}
                  </div>
                  <div className="truncate text-tiny text-slate-500">
                    {vars.targetUrl || "https://www.example.com"}
                  </div>
                </div>
              </div>

              {/* Title Link */}
              <h4 className="pt-1 text-base font-medium text-[#1a0dab] hover:underline cursor-pointer dark:text-[#8ab4f8] leading-snug">
                {customizedTitle}
              </h4>

              {/* Snippet Description */}
              <p className="text-caption text-[#4d5156] dark:text-[#bdc1c6] leading-relaxed pt-0.5">
                {customizedDesc}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Tab 3: JSON-LD Schema Generator */}
      {activeTab === "schema" && (
        <section className="space-y-6 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  JSON-LD Structured Data Generator
                </h3>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-micro font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  &check; Validated Schema ({template.schemaType})
                </span>
              </div>
              <p className="text-caption text-slate-500 dark:text-slate-400">
                Production-ready JSON-LD markup dynamically tailored to your customized inputs.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopySchema}
              className="rounded-xl bg-slate-900 px-4 py-2 text-caption font-bold text-white shadow-xs transition hover:bg-brand-dark dark:bg-brand dark:text-slate-950"
            >
              Copy Schema &rarr;
            </button>
          </div>

          <div className="rounded-xl bg-slate-950 p-4 font-mono text-caption text-emerald-400 overflow-x-auto">
            <pre className="whitespace-pre">{schemaString}</pre>
          </div>
        </section>
      )}

      {/* Tab 4: Common Mistakes & KPI Benchmarks */}
      {activeTab === "mistakes" && (
        <section className="space-y-6">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white mb-4">
              Common Mistakes &amp; Remediation Table
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-caption">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40">
                    <th className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300">Common Mistake</th>
                    <th className="py-2.5 px-3 font-bold text-red-600 dark:text-red-400">SEO Impact</th>
                    <th className="py-2.5 px-3 font-bold text-emerald-600 dark:text-emerald-400">Remediation Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {template.commonMistakes.map((m, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">{m.mistake}</td>
                      <td className="py-3 px-3 text-red-700 dark:text-red-300">{m.impact}</td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300">{m.remediation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white mb-4">
              Expected KPI Benchmarks &amp; Targets
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {template.kpiBenchmarks.map((kpi, i) => (
                <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="text-micro font-bold text-slate-400 uppercase tracking-wider">{kpi.timeframe}</div>
                  <div className="mt-1 font-display text-base font-bold text-slate-900 dark:text-white">{kpi.target}</div>
                  <div className="mt-1 text-caption text-slate-600 dark:text-slate-400">{kpi.metric}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Contextual Internal Links to 4 Related Templates */}
      <section className="print:hidden rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <h3 className="font-display text-body font-bold text-slate-900 dark:text-white mb-3">
          Related SEO Blueprints &amp; Checklists
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {relatedTemplates.map((rel) => (
            <Link
              key={rel.id}
              href={`/templates/${rel.categorySlug}/${rel.slug}`}
              className="card-hover group rounded-xl border border-slate-200/80 p-3.5 transition hover:border-brand dark:border-slate-800 dark:hover:border-brand"
            >
              <div className="text-micro font-bold text-slate-400 uppercase">{rel.category}</div>
              <h4 className="mt-1 text-caption font-bold text-slate-900 group-hover:text-brand-dark dark:text-white dark:group-hover:text-brand line-clamp-1">
                {rel.title}
              </h4>
              <p className="mt-1 text-tiny text-slate-500 line-clamp-2">{rel.metaDescription}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
