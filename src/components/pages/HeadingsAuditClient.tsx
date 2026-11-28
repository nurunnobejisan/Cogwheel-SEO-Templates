"use client";

import * as React from "react";
import { Download, Heading, Play } from "lucide-react";
import { DataTable, FilterTabs, InlineAlert, KpiTile, PageHeader } from "@/components/data/index";
import { CrawlPulseScene } from "@/components/motion/TelemetryScenes";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/index";
import type { HeadingAuditSummary, PageHeadingAudit } from "@/core/heading-audit/types";

interface HeadingAuditResponse {
  success: boolean;
  summary: HeadingAuditSummary;
  pages: PageHeadingAudit[];
  filename: string;
  xlsxBase64: string;
  googleSheetUrl?: string | null;
  error?: string;
}

export function HeadingsAuditClient() {
  const { activeProperty } = useWorkspace();
  const [urlInput, setUrlInput] = React.useState(activeProperty.url || "");
  const [maxPages, setMaxPages] = React.useState(50);
  const [enableSitemaps, setEnableSitemaps] = React.useState(true);
  const [saveToGoogleSheets, setSaveToGoogleSheets] = React.useState(false);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<HeadingAuditResponse | null>(null);
  const [filterType, setFilterType] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [selectedPage, setSelectedPage] = React.useState<PageHeadingAudit | null>(null);

  React.useEffect(() => {
    if (activeProperty.url && !urlInput) {
      setUrlInput(activeProperty.url);
    }
  }, [activeProperty.url, urlInput]);

  async function runAudit() {
    let target = urlInput.trim();
    if (!target) {
      setError("Enter a website URL to audit headings.");
      return;
    }
    if (!target.startsWith("http://") && !target.startsWith("https://")) {
      target = `https://${target}`;
      setUrlInput(target);
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/heading-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: target,
          maxPages,
          delayMs: 100,
          timeoutMs: 10000,
          enableSitemaps,
          saveToGoogleSheets,
        }),
      });
      const data = (await res.json()) as HeadingAuditResponse;
      if (!res.ok) {
        throw new Error(data.error || "Failed to execute heading audit.");
      }
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function downloadXlsx() {
    if (!result?.xlsxBase64) return;
    const chars = atob(result.xlsxBase64);
    const bytes = new Uint8Array(chars.length);
    for (let i = 0; i < chars.length; i++) bytes[i] = chars.charCodeAt(i);
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename || "heading-structure-audit.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredPages = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return (result?.pages ?? []).filter((page) => {
      if (filterType === "issues" && page.issues.length === 0 && page.h1Count === 1 && !page.hasSkippedLevels) {
        return false;
      }
      if (filterType === "missing-h1" && page.h1Count > 0 && !page.missingH1) return false;
      if (filterType === "multi-h1" && page.h1Count <= 1 && !page.multipleH1) return false;
      if (filterType === "skipped" && !page.hasSkippedLevels) return false;
      if (q && !page.pageUrl.toLowerCase().includes(q) && !page.pageTitle.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [result, filterType, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Heading Structure Audit"
        description="Evaluate H1–H6 outline hierarchy, skipped levels, and template placeholder leakage."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Website Audit", href: "/audit" },
          { label: "Headings" },
        ]}
        secondaryActions={[
          {
            label: "Export XLSX",
            onClick: downloadXlsx,
            disabled: !result?.xlsxBase64,
            icon: <Download className="h-3.5 w-3.5" aria-hidden="true" />,
          },
        ]}
        primaryAction={
          <Button
            variant="primary"
            loading={loading}
            onClick={() => void runAudit()}
            icon={<Play className="h-4 w-4" aria-hidden="true" />}
          >
            Audit headings
          </Button>
        }
      />

      <div className="surface-card space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <Input
            label="Target Website URL"
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://www.example.com"
          />
          <Input
            label="Max pages"
            type="number"
            min={5}
            max={200}
            value={maxPages}
            onChange={(e) => setMaxPages(Number(e.target.value) || 50)}
          />
        </div>
        <div className="flex flex-wrap gap-6">
          <Checkbox
            label="Discover URLs from XML sitemaps"
            checked={enableSitemaps}
            onCheckedChange={(v) => setEnableSitemaps(Boolean(v))}
          />
          <Checkbox
            label="Export directly to Google Sheets"
            checked={saveToGoogleSheets}
            onCheckedChange={(v) => setSaveToGoogleSheets(Boolean(v))}
          />
        </div>
      </div>

      {error && (
        <InlineAlert
          variant="error"
          title="Heading audit failed"
          description={error}
          onRetry={() => void runAudit()}
        />
      )}

      {loading && (
        <CrawlPulseScene
          active
          label="Scanning pages for H1–H6 structure..."
          sublabel="Checking missing H1 tags, duplicate H1s, and skipped heading levels"
        />
      )}

      {result && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiTile label="Pages audited" value={result.summary.totalPagesAudited} />
          <KpiTile label="Total headings" value={result.summary.totalHeadingsAudited} />
          <KpiTile label="Missing H1" value={result.summary.pagesMissingH1Count} />
          <KpiTile label="Skipped levels" value={result.summary.pagesWithSkippedLevelsCount} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          value={filterType}
          onChange={setFilterType}
          options={[
            { id: "all", label: "All", count: result?.pages.length ?? 0 },
            {
              id: "issues",
              label: "With issues",
              count: (result?.pages ?? []).filter((p) => p.issues.length > 0 || p.hasSkippedLevels || p.h1Count !== 1).length,
            },
            { id: "missing-h1", label: "Missing H1", count: result?.summary.pagesMissingH1Count ?? 0 },
            { id: "multi-h1", label: "Multiple H1", count: result?.summary.pagesMultipleH1Count ?? 0 },
            { id: "skipped", label: "Skipped", count: result?.summary.pagesWithSkippedLevelsCount ?? 0 },
          ]}
        />
        <div className="w-full sm:w-64">
          <Input
            type="search"
            placeholder="Search URL or heading..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter heading audit pages"
          />
        </div>
      </div>

      <DataTable
        data={filteredPages}
        loading={loading}
        emptyTitle="No heading audit results yet"
        emptyDescription="Enter a property URL above and click Audit headings to inspect H1–H6 hierarchy."
        emptyAction={
          <Button variant="primary" size="sm" icon={<Heading className="h-4 w-4" />} onClick={() => void runAudit()}>
            Audit headings
          </Button>
        }
        onRowClick={(row) => setSelectedPage(row)}
        columns={[
          {
            accessorKey: "pageUrl",
            header: "Page URL",
            cell: ({ row }) => (
              <span className="block max-w-xs truncate font-mono text-caption text-text">{row.original.pageUrl}</span>
            ),
          },
          {
            accessorKey: "h1Count",
            header: "H1",
            cell: ({ row }) => (
              <Badge variant={row.original.h1Count === 1 ? "success" : "error"}>{row.original.h1Count}</Badge>
            ),
          },
          {
            accessorKey: "h2Count",
            header: "H2",
            cell: ({ row }) => <span className="nums">{row.original.h2Count}</span>,
          },
          {
            accessorKey: "h3Count",
            header: "H3",
            cell: ({ row }) => <span className="nums">{row.original.h3Count}</span>,
          },
          {
            accessorKey: "hasSkippedLevels",
            header: "Hierarchy",
            cell: ({ row }) => (
              <Badge variant={row.original.hasSkippedLevels ? "warning" : "success"}>
                {row.original.hasSkippedLevels ? "Skipped" : "Valid"}
              </Badge>
            ),
          },
          {
            accessorKey: "issues",
            header: "Findings",
            cell: ({ row }) => (
              <Badge variant={row.original.issues.length > 0 ? "warning" : "neutral"}>
                {row.original.issues.length}
              </Badge>
            ),
          },
        ]}
      />

      <InlineAlert
        variant="notice"
        title="Heading structure guidance"
        description="Keep exactly one semantic H1 per URL matching primary search intent, then nest H2 sections and H3 subsections without skipping levels."
      />

      <Sheet open={Boolean(selectedPage)} onOpenChange={(open) => !open && setSelectedPage(null)}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Heading Outline</SheetTitle>
            <SheetDescription className="truncate font-mono">{selectedPage?.pageUrl}</SheetDescription>
          </SheetHeader>
          {selectedPage && (
            <div className="space-y-4 overflow-y-auto p-5">
              <p className="text-caption text-text-muted">{selectedPage.recommendationSummary}</p>
              <ul className="space-y-2">
                {selectedPage.headings.map((h) => (
                  <li key={h.id} className="rounded border border-border bg-surface-2 p-3 text-body">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={h.issues.length > 0 ? "warning" : "neutral"}>{h.tag}</Badge>
                      {h.optimizedLevel !== h.tag && (
                        <span className="font-mono text-caption text-link">Suggested: {h.optimizedLevel}</span>
                      )}
                    </div>
                    <p className="mt-1.5 font-medium text-text">{h.originalText}</p>
                    {h.optimizedText && h.optimizedText !== h.originalText && (
                      <p className="mt-1 text-caption text-success-fg">Optimized: {h.optimizedText}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
