"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Globe, Play } from "lucide-react";
import { DataTable, FilterTabs, InlineAlert, KpiTile, PageHeader } from "@/components/data/index";
import { CrawlPulseScene } from "@/components/motion/TelemetryScenes";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import {
  Badge,
  Button,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/index";
import type { PageHeadingAudit } from "@/core/heading-audit/types";

interface CrawledPageRow {
  url: string;
  statusCode: number;
  title: string;
  titleLength: number;
  h1Count: number;
  words: number;
  loadTimeMs: number | null;
  issuesCount: number;
  issues: string[];
  headingsSummary?: string;
}

export function AuditPagesClient() {
  const searchParams = useSearchParams();
  const issueFilter = searchParams?.get("issue") ?? "";
  const { activeProperty, refreshRuns } = useWorkspace();

  const [urlInput, setUrlInput] = React.useState(activeProperty.url || "");
  const [maxPages, setMaxPages] = React.useState(25);
  const [crawlDepth, setCrawlDepth] = React.useState(3);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [pages, setPages] = React.useState<CrawledPageRow[]>([]);
  const [siteSummary, setSiteSummary] = React.useState<{
    robotsTxtPresent?: boolean;
    brokenLinks?: number;
    redirectChains?: number;
    crawled?: number;
    discovered?: number;
  } | null>(null);
  const [selectedPage, setSelectedPage] = React.useState<CrawledPageRow | null>(null);

  React.useEffect(() => {
    if (activeProperty.url && !urlInput) {
      setUrlInput(activeProperty.url);
    }
  }, [activeProperty.url, urlInput]);

  async function handleRunCrawl() {
    const target = urlInput.trim();
    if (!target) {
      setError("Enter a property URL to crawl.");
      return;
    }
    setError(null);
    setRunning(true);
    try {
      const [crawlRes, headingsRes] = await Promise.all([
        fetch("/api/tasks/site-crawl/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: target, maxPages, crawlDepth, batchSize: 10 }),
        }),
        fetch("/api/heading-audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: target, maxPages, delayMs: 80, timeoutMs: 10000, enableSitemaps: true }),
        }),
      ]);

      const crawlJson = await crawlRes.json();
      if (!crawlRes.ok) {
        throw new Error(crawlJson.error || "Site crawl failed.");
      }

      const summary = crawlJson.data?.siteSummary ?? {};
      const progress = crawlJson.data?.progress ?? {};
      setSiteSummary({
        robotsTxtPresent: summary.robotsTxtPresent,
        brokenLinks: (summary.brokenLinks ?? []).length,
        redirectChains: (summary.redirectChains ?? []).length,
        crawled: progress.crawled ?? 0,
        discovered: progress.discovered ?? 0,
      });

      if (headingsRes.ok) {
        const headingJson = (await headingsRes.json()) as { pages?: PageHeadingAudit[] };
        const mapped: CrawledPageRow[] = (headingJson.pages ?? []).map((p) => {
          const words = p.headings.reduce((acc, h) => acc + h.originalText.split(/\s+/).filter(Boolean).length, 0);
          return {
            url: p.pageUrl,
            statusCode: p.pageStatus || 200,
            title: p.pageTitle || "—",
            titleLength: (p.pageTitle || "").length,
            h1Count: p.h1Count,
            words,
            loadTimeMs: null,
            issuesCount: p.issues.length,
            issues: p.issues,
            headingsSummary: p.recommendationSummary,
          };
        });
        setPages(mapped);
      }

      await refreshRuns();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  const filteredPages = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return pages.filter((p) => {
      if (statusFilter === "errors" && p.statusCode < 400 && p.issuesCount === 0) return false;
      if (statusFilter === "200" && p.statusCode !== 200) return false;
      if (issueFilter && !p.issues.some((iss) => iss.toLowerCase().includes(issueFilter.toLowerCase()))) {
        if (issueFilter === "missing-h1" && p.h1Count !== 0) return false;
      }
      if (q && !p.url.toLowerCase().includes(q) && !p.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [pages, statusFilter, issueFilter, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Crawled Pages"
        description="Inspect HTTP status codes, title lengths, H1 counts, and per-page findings."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Website Audit", href: "/audit" },
          { label: "Crawled Pages" },
        ]}
        primaryAction={
          <Button
            variant="primary"
            loading={running}
            onClick={() => void handleRunCrawl()}
            icon={<Play className="h-4 w-4" aria-hidden="true" />}
          >
            Start site crawl
          </Button>
        }
      />

      {/* Crawl configuration strip */}
      <div className="surface-card grid gap-3 p-4 sm:grid-cols-[1fr_110px_110px]">
        <Input
          label="Target URL"
          type="url"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="https://www.example.com"
        />
        <Input
          label="Max pages"
          type="number"
          min={5}
          max={250}
          value={maxPages}
          onChange={(e) => setMaxPages(Number(e.target.value) || 25)}
        />
        <Input
          label="Depth"
          type="number"
          min={1}
          max={8}
          value={crawlDepth}
          onChange={(e) => setCrawlDepth(Number(e.target.value) || 3)}
        />
      </div>

      {error && (
        <InlineAlert
          variant="error"
          title="Site crawl failed"
          description={error}
          onRetry={() => void handleRunCrawl()}
        />
      )}

      {running && (
        <CrawlPulseScene
          active
          label="Crawling site pages & inspecting rendered DOM..."
          sublabel="Following robots.txt, XML sitemaps, status codes, and heading structure"
        />
      )}

      {siteSummary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiTile label="Pages crawled" value={siteSummary.crawled ?? 0} />
          <KpiTile label="URLs discovered" value={siteSummary.discovered ?? 0} />
          <KpiTile label="Broken links" value={siteSummary.brokenLinks ?? 0} />
          <KpiTile label="Redirect chains" value={siteSummary.redirectChains ?? 0} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { id: "all", label: "All pages", count: pages.length },
            { id: "200", label: "200 OK", count: pages.filter((p) => p.statusCode === 200).length },
            { id: "errors", label: "With issues", count: pages.filter((p) => p.issuesCount > 0 || p.statusCode >= 400).length },
          ]}
        />
        <div className="w-full sm:w-64">
          <Input
            type="search"
            placeholder="Filter URL or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter crawled URLs"
          />
        </div>
      </div>

      <DataTable
        data={filteredPages}
        loading={running}
        emptyTitle="No crawled pages loaded"
        emptyDescription="Enter a property URL above and run Start site crawl to inspect every discovered URL."
        emptyAction={
          <Button variant="primary" size="sm" icon={<Globe className="h-4 w-4" />} onClick={() => void handleRunCrawl()}>
            Start site crawl
          </Button>
        }
        onRowClick={(row) => setSelectedPage(row)}
        columns={[
          {
            accessorKey: "url",
            header: "URL",
            cell: ({ row }) => (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block max-w-xs truncate font-mono text-caption text-text">
                    {row.original.url}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{row.original.url}</TooltipContent>
              </Tooltip>
            ),
          },
          {
            accessorKey: "statusCode",
            header: "Status",
            cell: ({ row }) => (
              <Badge variant={row.original.statusCode >= 400 ? "error" : row.original.statusCode >= 300 ? "warning" : "success"}>
                {row.original.statusCode}
              </Badge>
            ),
          },
          {
            accessorKey: "titleLength",
            header: "Title Len",
            cell: ({ row }) => <span className="nums">{row.original.titleLength} ch</span>,
          },
          {
            accessorKey: "h1Count",
            header: "H1",
            cell: ({ row }) => (
              <Badge variant={row.original.h1Count === 1 ? "success" : "error"}>
                {row.original.h1Count}
              </Badge>
            ),
          },
          {
            accessorKey: "words",
            header: "Heading Words",
            cell: ({ row }) => <span className="nums">{row.original.words}</span>,
          },
          {
            accessorKey: "issuesCount",
            header: "Issues",
            cell: ({ row }) => (
              <Badge variant={row.original.issuesCount > 0 ? "warning" : "neutral"}>
                {row.original.issuesCount}
              </Badge>
            ),
          },
        ]}
      />

      <Sheet open={Boolean(selectedPage)} onOpenChange={(open) => !open && setSelectedPage(null)}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Page Diagnostics</SheetTitle>
            <SheetDescription className="truncate font-mono">{selectedPage?.url}</SheetDescription>
          </SheetHeader>
          {selectedPage && (
            <div className="space-y-4 overflow-y-auto p-5 text-body">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded border border-border bg-surface-2 p-3">
                  <p className="text-overline uppercase text-text-muted">HTTP Status</p>
                  <p className="nums mt-1 text-heading text-text">{selectedPage.statusCode}</p>
                </div>
                <div className="rounded border border-border bg-surface-2 p-3">
                  <p className="text-overline uppercase text-text-muted">H1 Count</p>
                  <p className="nums mt-1 text-heading text-text">{selectedPage.h1Count}</p>
                </div>
              </div>
              <div>
                <p className="text-overline uppercase text-text-muted">Title</p>
                <p className="mt-1 text-body text-text">{selectedPage.title}</p>
              </div>
              {selectedPage.issues.length > 0 && (
                <div className="space-y-2">
                  <p className="text-overline uppercase text-text-muted">Detected Issues</p>
                  <ul className="space-y-1.5">
                    {selectedPage.issues.map((iss) => (
                      <li key={iss} className="rounded-sm border border-warning/30 bg-warning-soft px-3 py-2 text-caption text-warning-fg">
                        {iss}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedPage.headingsSummary && (
                <div>
                  <p className="text-overline uppercase text-text-muted">Guidance</p>
                  <p className="mt-1 max-w-[72ch] text-caption text-text-muted">{selectedPage.headingsSummary}</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
