import React, { useState } from "react";
import { AlertCircle, Globe, Info, RefreshCw } from "lucide-react";

type Provenance = "measured" | "estimated" | "unavailable";

interface CheckDetail {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

interface GeoReport {
  url: string;
  capturedAt: string;
  llmsTxt: {
    provenance: Provenance;
    status: "present" | "absent" | "invalid" | "unavailable";
    httpStatus: number | null;
    score: number | null;
    reason?: string;
    parsed: { title: string | null; sectionCount: number; linkCount: number; bytes: number } | null;
    checks: CheckDetail[];
  };
  aiCrawlers: {
    provenance: Provenance;
    status: "present" | "absent" | "unavailable";
    reason?: string;
    blockedBots: string[];
    allowedBots: string[];
    unmentionedBots: string[];
  };
  citability: {
    provenance: Provenance;
    score: number;
    formula: string;
    version: string;
    components: Array<{ id: string; label: string; weight: number; score: number }>;
  };
  drift: {
    provenance: Provenance;
    status: "pass" | "fail" | "no_baseline";
    scoreDelta: number | null;
    failThreshold: number;
    regressions: string[];
    reason?: string;
  };
}

const API_BASE = "https://cogwheel-seo-templates.vercel.app";

const PROVENANCE_STYLE: Record<Provenance, string> = {
  measured: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  estimated: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  unavailable: "border-zinc-600/60 bg-zinc-700/20 text-zinc-400",
};

function ProvenanceBadge({ value }: { value: Provenance }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${PROVENANCE_STYLE[value]}`}
    >
      {value}
    </span>
  );
}

function Row({
  label,
  value,
  provenance,
  detail,
}: {
  label: string;
  value: string;
  provenance: Provenance;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border border-[#27272A] bg-[#09090B] px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#A1A1AA]">{label}</span>
        <ProvenanceBadge value={provenance} />
      </div>
      <div className="mt-1 text-xs font-semibold text-[#FAFAFA]">{value}</div>
      {detail && <div className="mt-1 text-[10px] leading-relaxed text-[#71717A]">{detail}</div>}
    </div>
  );
}

export function GeoVisibilityCard({ url }: { url: string }) {
  const [report, setReport] = useState<GeoReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showFormula, setShowFormula] = useState(false);

  const targetUrl = (url || "").trim();

  const runCheck = async () => {
    if (!targetUrl) {
      setError("Open a public page first; there is no URL to check.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/geo/check`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl, persist: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          res.status === 401
            ? "Sign in to the Cogwheel web app in this browser to run a GEO check."
            : data.error || data.details || `HTTP ${res.status}`
        );
        setReport(null);
      } else {
        setReport(data.report as GeoReport);
      }
    } catch (e) {
      setError(String(e));
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const llms = report?.llmsTxt;
  const crawlers = report?.aiCrawlers;
  const citability = report?.citability;
  const drift = report?.drift;

  return (
    <div className="rounded-xl border border-[#27272A] bg-[#111113] p-4 text-[#FAFAFA]">
      <div className="flex items-start justify-between gap-2 border-b border-[#27272A] pb-2.5">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA]">
            <Globe className="h-3 w-3" />
            GEO · AI Visibility
          </div>
          <div className="mt-1 text-[10px] text-[#71717A]">
            Measured from the live page. Scores are labelled; nothing is inferred.
          </div>
        </div>
        <button
          type="button"
          onClick={runCheck}
          disabled={loading || !targetUrl}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#27272A] bg-[#18181B] px-2.5 py-1.5 text-[10px] font-semibold text-[#FAFAFA] hover:border-emerald-500/40 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Checking" : report ? "Re-check" : "Check page"}
        </button>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-2 text-[10px] text-rose-300">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!report && !error && (
        <div className="mt-3 rounded-lg border border-dashed border-[#27272A] px-2.5 py-3 text-[10px] text-[#71717A]">
          Not measured yet. Run a check to fetch llms.txt, AI-crawler rules, citability and drift for this page.
        </div>
      )}

      {report && (
        <div className="mt-3 space-y-2">
          <Row
            label="Citability"
            value={citability ? `${citability.score}/100` : "No score"}
            provenance={citability?.provenance ?? "unavailable"}
            detail={citability ? `Estimated heuristic v${citability.version}. Tap for the formula.` : undefined}
          />
          {citability && (
            <button
              type="button"
              onClick={() => setShowFormula((value) => !value)}
              className="flex w-full items-center gap-1 text-left text-[10px] font-semibold text-emerald-400 hover:text-emerald-300"
            >
              <Info className="h-3 w-3" />
              {showFormula ? "Hide formula and inputs" : "Show formula and inputs"}
            </button>
          )}
          {citability && showFormula && (
            <div className="rounded-lg border border-[#27272A] bg-[#09090B] p-2.5">
              <div className="text-[10px] font-mono text-[#A1A1AA]">{citability.formula}</div>
              <ul className="mt-1.5 space-y-1">
                {citability.components.map((component) => (
                  <li key={component.id} className="flex items-center justify-between gap-2 text-[10px] text-[#71717A]">
                    <span>{component.label}</span>
                    <span className="font-mono text-[#A1A1AA]">
                      {component.score}/100 · weight {(component.weight * 100).toFixed(0)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Row
            label="llms.txt"
            value={
              llms
                ? `${llms.status}${llms.httpStatus ? ` · HTTP ${llms.httpStatus}` : ""}${llms.score !== null ? ` · ${llms.score}/100` : ""}`
                : "Not measured"
            }
            provenance={llms?.provenance ?? "unavailable"}
            detail={llms?.reason || (llms?.parsed ? `${llms.parsed.sectionCount} sections · ${llms.parsed.linkCount} links · ${llms.parsed.bytes} bytes` : undefined)}
          />

          <Row
            label="AI crawlers"
            value={
              crawlers
                ? crawlers.status === "unavailable"
                  ? "Unavailable"
                  : `${crawlers.status}${crawlers.blockedBots.length > 0 ? ` · blocked: ${crawlers.blockedBots.join(", ")}` : " · no blocked bots"}`
                : "Not measured"
            }
            provenance={crawlers?.provenance ?? "unavailable"}
            detail={crawlers?.reason}
          />

          <Row
            label="Drift since last audit"
            value={
              !drift
                ? "Not measured"
                : drift.status === "no_baseline"
                ? "No baseline"
                : drift.scoreDelta === null
                ? drift.status
                : `${drift.status} · ${drift.scoreDelta >= 0 ? "+" : ""}${drift.scoreDelta} points`
            }
            provenance={drift?.provenance ?? "unavailable"}
            detail={
              drift?.status === "no_baseline"
                ? "This is the first stored snapshot; drift starts at the next audit."
                : drift?.regressions?.length
                ? drift.regressions.join(" ")
                : drift?.reason
            }
          />
        </div>
      )}
    </div>
  );
}
