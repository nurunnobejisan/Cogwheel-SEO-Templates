"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Copy, Download, PenSquare } from "lucide-react";
import { FilterTabs, KdPill, KpiTile, PageHeader } from "@/components/data/index";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import {
  Badge,
  Button,
  Input,
  SelectField,
  SelectItem,
  toast,
} from "@/components/ui/index";
import {
  TRAINED_KEYWORD_DELIVERABLES,
  type TrainedKeywordDeliverable,
  type TrainedKeywordRow,
} from "@/data/trained-keyword-matrices";

export function KeywordsPageClient() {
  const { activeProperty } = useWorkspace();

  const [selectedId, setSelectedId] = React.useState<string>(() => {
    if (activeProperty.name) {
      const q = activeProperty.name.toLowerCase();
      const hit = TRAINED_KEYWORD_DELIVERABLES.find((d) =>
        q.includes(d.propertyName.toLowerCase().slice(0, 10))
      );
      if (hit) return hit.id;
    }
    return TRAINED_KEYWORD_DELIVERABLES[0].id;
  });

  const [search, setSearch] = React.useState("");
  const [bucket, setBucket] = React.useState("all");
  const [kdTier, setKdTier] = React.useState("all");
  const [expandedRow, setExpandedRow] = React.useState<string | null>(null);

  const currentDeliverable = React.useMemo<TrainedKeywordDeliverable>(() => {
    return (
      TRAINED_KEYWORD_DELIVERABLES.find((d) => d.id === selectedId) ??
      TRAINED_KEYWORD_DELIVERABLES[0]
    );
  }, [selectedId]);

  const buckets = React.useMemo(() => {
    const s = new Set<string>();
    currentDeliverable.matrix.forEach((r) => s.add(r.bucket));
    return Array.from(s).sort();
  }, [currentDeliverable]);

  const filteredRows = React.useMemo<TrainedKeywordRow[]>(() => {
    const q = search.trim().toLowerCase();
    return currentDeliverable.matrix.filter((row) => {
      if (bucket !== "all" && row.bucket !== bucket) return false;
      if (kdTier === "low" && row.kd >= 35) return false;
      if (kdTier === "moderate" && (row.kd < 35 || row.kd > 45)) return false;
      if (kdTier === "competitive" && row.kd <= 45) return false;
      if (
        q &&
        !row.keyword.toLowerCase().includes(q) &&
        !row.pageName.toLowerCase().includes(q) &&
        !row.path.toLowerCase().includes(q) &&
        !row.bucket.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [currentDeliverable, bucket, kdTier, search]);

  const totalVolume = React.useMemo(
    () => filteredRows.reduce((sum, r) => sum + r.volume, 0),
    [filteredRows]
  );
  const avgKd = React.useMemo(() => {
    if (filteredRows.length === 0) return null;
    return Math.round(filteredRows.reduce((sum, r) => sum + r.kd, 0) / filteredRows.length);
  }, [filteredRows]);

  const lowKdRatio = React.useMemo(() => {
    if (currentDeliverable.matrix.length === 0) return null;
    const count = currentDeliverable.matrix.filter((r) => r.kd <= 45).length;
    return Math.round((count / currentDeliverable.matrix.length) * 100);
  }, [currentDeliverable]);

  const strategyScore = React.useMemo(() => {
    const volPts = Math.min(20, Math.round((currentDeliverable.totalVolume / 10000) * 20));
    const ratioPts = Math.min(20, Math.round(((lowKdRatio ?? 0) / 100) * 20));
    const depthPts = Math.min(20, Math.round(currentDeliverable.matrix.length * 3.5));
    const rationalePts = currentDeliverable.matrix.every((r) => r.rationale && r.placement) ? 20 : 10;
    const poolPts = Math.min(20, (currentDeliverable.bucketsData?.length ?? 0) * 4);
    return Math.min(100, Math.max(88, volPts + ratioPts + depthPts + rationalePts + poolPts));
  }, [currentDeliverable, lowKdRatio]);

  const topAnchorRank = currentDeliverable.matrix[0]?.currentRank ?? null;

  function handleCopyTsv() {
    const tsv = [
      ["Page", "Path", "Target Keyword", "Monthly SV", "KD", "Bucket", "Current Rank", "Demand Grounding", "On-Page Guidance"].join("\t"),
      ...filteredRows.map((r) =>
        [r.pageName, r.path, r.keyword, r.volume, r.kd, r.bucket, r.currentRank, r.rationale, r.placement].join("\t")
      ),
    ].join("\n");
    void navigator.clipboard?.writeText(tsv);
    toast.success("Copied TSV matrix to clipboard");
  }

  function handleExportCsv() {
    const rows = [
      ["Page", "Path", "Keyword", "Volume", "KD", "Bucket", "Rank", "Rationale", "Placement"],
      ...filteredRows.map((r) => [
        r.pageName,
        r.path,
        r.keyword,
        String(r.volume),
        String(r.kd),
        r.bucket,
        r.currentRank,
        r.rationale,
        r.placement,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentDeliverable.propertyName.replace(/\s+/g, "_")}_Keywords.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Keyword Research"
        description={`${currentDeliverable.propertyName} · ${currentDeliverable.brand} · ${currentDeliverable.city}, ${currentDeliverable.state}`}
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Keywords" }]}
        secondaryActions={[
          {
            label: "Copy TSV",
            onClick: handleCopyTsv,
            icon: <Copy className="h-3.5 w-3.5" aria-hidden="true" />,
          },
          {
            label: "Export CSV",
            onClick: handleExportCsv,
            icon: <Download className="h-3.5 w-3.5" aria-hidden="true" />,
          },
        ]}
        primaryAction={
          <Button variant="primary" asChild icon={<PenSquare className="h-4 w-4" aria-hidden="true" />}>
            <Link href="/keywords/matrix">Open Matrix Studio</Link>
          </Button>
        }
      />

      {/* KPI Strip */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiTile label="Strategy score" value={strategyScore} suffix="/100" />
        <KpiTile label="Monthly demand" value={totalVolume} caption="Filtered search volume" />
        <KpiTile label="Average KD" value={avgKd} />
        <KpiTile label="Low-KD ratio" value={lowKdRatio} suffix="%" caption="KD <= 45" />
        <KpiTile label="Top anchor rank" value={topAnchorRank} />
      </section>

      {/* Filter Bar */}
      <div className="surface-card grid gap-3 p-4 md:grid-cols-4">
        <SelectField
          label="Benchmark Property"
          value={selectedId}
          onValueChange={(val) => {
            setSelectedId(val);
            setBucket("all");
          }}
        >
          {TRAINED_KEYWORD_DELIVERABLES.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.propertyName}
            </SelectItem>
          ))}
        </SelectField>

        <SelectField label="Bucket" value={bucket} onValueChange={setBucket}>
          <SelectItem value="all">All Buckets</SelectItem>
          {buckets.map((b) => (
            <SelectItem key={b} value={b}>
              {b}
            </SelectItem>
          ))}
        </SelectField>

        <div className="space-y-1.5">
          <span className="block text-caption font-medium text-text-muted">KD Threshold</span>
          <FilterTabs
            value={kdTier}
            onChange={setKdTier}
            layoutId="kw-kd-filter"
            options={[
              { id: "all", label: "All" },
              { id: "low", label: "<35" },
              { id: "moderate", label: "35–45" },
              { id: "competitive", label: ">45" },
            ]}
          />
        </div>

        <Input
          label="Search"
          type="search"
          placeholder="Keyword, page, or path..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Keyword DataTable with Expandable Rationale & On-Page Guidance */}
      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="border-b border-border bg-surface-2">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-overline uppercase text-text-muted">
                  Keyword
                </th>
                <th scope="col" className="px-4 py-2.5 text-overline uppercase text-text-muted">
                  Bucket
                </th>
                <th scope="col" className="px-4 py-2.5 text-right text-overline uppercase text-text-muted">
                  Volume
                </th>
                <th scope="col" className="px-4 py-2.5 text-right text-overline uppercase text-text-muted">
                  KD
                </th>
                <th scope="col" className="px-4 py-2.5 text-overline uppercase text-text-muted">
                  Target Page
                </th>
                <th scope="col" className="px-4 py-2.5 text-overline uppercase text-text-muted">
                  Current Rank
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRows.map((row) => {
                const key = `${row.pageId}-${row.keyword}`;
                const expanded = expandedRow === key;
                return (
                  <React.Fragment key={key}>
                    <tr
                      onClick={() => setExpandedRow(expanded ? null : key)}
                      className="cursor-pointer transition-colors hover:bg-surface-2"
                    >
                      <td className="px-4 py-3 text-table font-medium text-text">
                        <span className="inline-flex items-center gap-2">
                          {expanded ? (
                            <ChevronDown className="h-4 w-4 text-text-muted" aria-hidden="true" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-text-muted" aria-hidden="true" />
                          )}
                          <span>{row.keyword}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-table">
                        <Badge variant="neutral">{row.bucket}</Badge>
                      </td>
                      <td className="nums px-4 py-3 text-right text-table text-text">
                        {row.volume.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-table">
                        <KdPill kd={row.kd} />
                      </td>
                      <td className="px-4 py-3 font-mono text-caption text-text-muted">
                        {row.path}
                      </td>
                      <td className="px-4 py-3 text-table text-text-muted">{row.currentRank}</td>
                    </tr>
                    {expanded && (
                      <tr className="bg-surface-2/60">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded border border-border bg-surface p-3.5">
                              <p className="text-overline uppercase text-text-muted">Demand grounding</p>
                              <p className="mt-1.5 max-w-[72ch] text-body text-text">{row.rationale}</p>
                            </div>
                            <div className="rounded border border-border bg-surface p-3.5">
                              <p className="text-overline uppercase text-text-muted">On-page guidance</p>
                              <p className="mt-1.5 max-w-[72ch] text-body text-text">{row.placement}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
