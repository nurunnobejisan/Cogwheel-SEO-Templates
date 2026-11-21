import React, { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  ArrowRight,
  Copy,
  Check,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { QuickWinItem } from "../types/extension";

interface Props {
  quickWins: QuickWinItem[];
  onFixWithTemplate?: (templateId: string) => void;
  onFixIssue?: (win: QuickWinItem) => void;
}

interface DiffData {
  fileName: string;
  original: string;
  patch: string;
}

const ISSUE_DIFF_MAP: Record<string, DiffData> = {
  "title-len": {
    fileName: "<head> • Title Tag",
    original: `<title>Beachfront Hotels Panama City Beach | SpringHill Suites Panama City Beachfront Resort & Spa</title>`,
    patch: `<title>Beachfront Hotel Panama City Beach | SpringHill Suites</title>`,
  },
  "meta-len": {
    fileName: "<head> • Meta Description",
    original: `<meta name="description" content="Stay beachfront in Panama City Beach suites with lazy river pool access." />`,
    patch: `<meta name="description" content="Book direct at SpringHill Suites Panama City Beach for oceanfront suites, lazy river pool, free hot breakfast, and lowest rates guaranteed on Gulf Coast." />`,
  },
  "canonical-h1": {
    fileName: "<head> & <body> • Canonical & Heading Structure",
    original: `<!-- Missing canonical tag -->\n<h1>SpringHill Suites</h1>\n<h1>Panama City Beachfront Resort</h1>`,
    patch: `<link rel="canonical" href="https://www.marriott.com/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/" />\n<h1 class="hotel-primary-headline">SpringHill Suites Panama City Beachfront</h1>`,
  },
  "schema-hotel-missing": {
    fileName: "JSON-LD • Lodging Schema",
    original: `<!-- No Hotel or LodgingBusiness Schema detected in DOM -->`,
    patch: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "Hotel",\n  "name": "SpringHill Suites Panama City Beachfront",\n  "url": "https://www.marriott.com/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/",\n  "telephone": "+1-850-230-6004"\n}\n</script>`,
  },
  "og-missing": {
    fileName: "<head> • Open Graph & Social Cards",
    original: `<!-- Missing og:title, og:image, and Twitter Card tags -->`,
    patch: `<meta property="og:type" content="hotel" />\n<meta property="og:title" content="SpringHill Suites Panama City Beachfront | Official Site" />\n<meta property="og:image" content="https://cache.marriott.com/content/dam/marriott-renditions/ECPSB/ecpsb-exterior-0045-hor-feat.jpg" />\n<meta name="twitter:card" content="summary_large_image" />`,
  },
  "geo-ai-readiness": {
    fileName: "JSON-LD • FAQPage Schema for GEO Citations",
    original: `<!-- Thin Content (<450 words) and Missing FAQPage Entity Schema -->`,
    patch: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "FAQPage",\n  "mainEntity": [{\n    "@type": "Question",\n    "name": "Is SpringHill Suites Panama City Beach located directly on the beach?",\n    "acceptedAnswer": {\n      "@type": "Answer",\n      "text": "Yes, our resort is located directly beachfront on the Gulf of Mexico featuring private beach access and lazy river."\n    }\n  }]\n}\n</script>`,
  },
};

export function QuickWinsList({ quickWins, onFixWithTemplate, onFixIssue }: Props) {
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);
  const [copiedIssueId, setCopiedIssueId] = useState<string | null>(null);

  if (quickWins.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
        <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>All 10 Core Quality Gates Passed</span>
        </div>
        <p className="mt-1 text-[11px] text-[#A1A1AA]">
          Zero critical SEO or GEO blocking issues detected on this live page. All 4 health gauges are at 100/100.
        </p>
      </div>
    );
  }

  const handleCopyPatch = async (id: string, patchCode: string) => {
    try {
      await navigator.clipboard.writeText(patchCode);
      setCopiedIssueId(id);
      setTimeout(() => setCopiedIssueId(null), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = patchCode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopiedIssueId(id);
      setTimeout(() => setCopiedIssueId(null), 2000);
    }
  };

  const handleApplyFix = (win: QuickWinItem) => {
    if (onFixIssue) {
      onFixIssue(win);
    } else if (onFixWithTemplate && win.templateIdToFix) {
      onFixWithTemplate(win.templateIdToFix);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIssueId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA]">
          Detected Issues &amp; Quick Wins ({quickWins.length})
        </span>
        <span className="text-[10px] font-medium text-[#71717A] tabular-nums">
          {quickWins.length} Remaining
        </span>
      </div>

      <div className="space-y-2">
        {quickWins.map((win) => {
          const isHigh = win.severity === "high";
          const isMed = win.severity === "medium";
          const isExpanded = expandedIssueId === win.id;
          const diff = ISSUE_DIFF_MAP[win.id] || {
            fileName: "Code Patch",
            original: `<!-- Unoptimized Configuration -->`,
            patch: `<!-- Optimized Fix Snippet -->`,
          };

          return (
            <div
              key={win.id}
              className={`rounded-xl border transition ${
                isHigh
                  ? "border-[#27272A] bg-[#111113] hover:border-rose-900/50"
                  : isMed
                  ? "border-[#27272A] bg-[#111113] hover:border-amber-900/50"
                  : "border-[#27272A] bg-[#111113] hover:border-sky-900/50"
              }`}
            >
              {/* Item Header */}
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    {isHigh ? (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                    ) : isMed ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    ) : (
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs font-semibold text-[#FAFAFA]">
                          {win.title}
                        </h4>
                        <span
                          className={`rounded px-1.5 py-0.2 text-[9px] font-semibold uppercase ${
                            isHigh
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              : isMed
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                          }`}
                        >
                          {win.severity}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-[#A1A1AA]">
                        {win.impact}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleExpand(win.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-[#27272A] bg-[#18181B] px-2 py-1 text-[10px] font-medium text-[#A1A1AA] hover:bg-[#27272A] hover:text-[#FAFAFA] transition"
                      title={isExpanded ? "Collapse inline diff" : "Preview inline code diff"}
                    >
                      <span>Diff</span>
                      {isExpanded ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApplyFix(win)}
                      title={`Apply fix for ${win.title}`}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-1 text-[10px] font-semibold text-slate-950 transition hover:bg-emerald-400 active:scale-95 shadow-xs"
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>Fix</span>
                      <ArrowRight className="h-2.5 w-2.5 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Inline Code-Diff Preview Drawer */}
              {isExpanded && (
                <div className="border-t border-[#27272A] bg-[#09090B] p-3 text-xs animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#71717A] mb-2">
                    <span className="text-[#A1A1AA] font-semibold">{diff.fileName}</span>
                    <span>Inline Code Diff</span>
                  </div>

                  {/* Red Original Block */}
                  <div className="rounded-md border border-rose-900/40 bg-rose-950/20 p-2 font-mono text-[10.5px] leading-relaxed text-rose-300">
                    <div className="text-[9px] font-bold uppercase text-rose-400/80 select-none mb-0.5">
                      - Original (Unoptimized)
                    </div>
                    <pre className="whitespace-pre-wrap break-all">{diff.original}</pre>
                  </div>

                  {/* Green Patch Block */}
                  <div className="mt-1.5 rounded-md border border-emerald-900/40 bg-emerald-950/20 p-2 font-mono text-[10.5px] leading-relaxed text-emerald-300">
                    <div className="text-[9px] font-bold uppercase text-emerald-400/80 select-none mb-0.5">
                      + Patch (Optimized)
                    </div>
                    <pre className="whitespace-pre-wrap break-all">{diff.patch}</pre>
                  </div>

                  {/* Action Bar inside Diff */}
                  <div className="mt-2.5 flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => handleCopyPatch(win.id, diff.patch)}
                      className="inline-flex items-center gap-1 rounded-md border border-[#27272A] bg-[#18181B] px-2.5 py-1 text-[11px] font-medium text-[#FAFAFA] hover:bg-[#27272A] transition"
                    >
                      {copiedIssueId === win.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-semibold">Copied Patch</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 text-[#A1A1AA]" />
                          <span>Copy Patch</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApplyFix(win)}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400 transition"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Apply Patch Now</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
