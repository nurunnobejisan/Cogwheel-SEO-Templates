"use client";

import * as React from "react";
import Link from "next/link";
import { Building2, ExternalLink, Globe, Play, Search } from "lucide-react";
import {
  DataTable,
  DistributionChart,
  InlineAlert,
  KpiTile,
  MetricRow,
  PageHeader,
  ScoreRing,
  VitalsBar,
} from "@/components/data/index";
import { CrawlPulseScene } from "@/components/motion/TelemetryScenes";
import { TelemetryGrid } from "@/components/motion";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Skeleton } from "@/components/ui/index";
import {
  buildDistributionSeries,
  buildMeasuredVitals,
  summarizeSeverityCounts,
} from "@/lib/audit-view-model";
import { TASKS_CONFIG } from "@/tasks/tasks.config";

interface RecentRunRow {
  taskId: string;
  taskName: string;
  section: string;
  date: string;
  status: string;
  outputUrl: string | null;
}

export function DashboardPageClient() {
  const {
    activeProperty,
    autofillPropertyByUrl,
    setCommandPaletteOpen,
    setAutoPilotOpen,
    latestRuns,
    runsLoaded,
    auditReport,
    previousAuditReport,
    auditLoading,
    auditError,
    runFullWebsiteAudit,
  } = useWorkspace();

  const [urlInput, setUrlInput] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [addError, setAddError] = React.useState<string | null>(null);

  const hasProperty = Boolean(activeProperty.name.trim() || activeProperty.url.trim());

  async function handleAddByUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!urlInput.trim()) {
      setAddError("Enter a property website URL.");
      return;
    }
    setAddError(null);
    setAdding(true);
    try {
      await autofillPropertyByUrl(urlInput);
      setUrlInput("");
    } catch (err) {
      setAddError((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  const readyTasks = React.useMemo(
    () => TASKS_CONFIG.filter((t) => t.phase === 1 || t.status === "Done"),
    []
  );
  const completedCount = React.useMemo(
    () => readyTasks.filter((t) => latestRuns[t.id]?.status === "Done").length,
    [readyTasks, latestRuns]
  );
  const nextThreeTasks = React.useMemo(
    () => readyTasks.filter((t) => latestRuns[t.id]?.status !== "Done").slice(0, 3),
    [readyTasks, latestRuns]
  );

  const recentRunRows = React.useMemo<RecentRunRow[]>(() => {
    return Object.values(latestRuns)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((r) => {
        const cfg = TASKS_CONFIG.find((t) => t.id === r.taskId);
        return {
          taskId: r.taskId,
          taskName: cfg?.name ?? r.taskId,
          section: cfg?.section ?? "Audit",
          date: new Date(r.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          status: r.status,
          outputUrl: r.outputUrl,
        };
      });
  }, [latestRuns]);

  if (!hasProperty) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          description="Select an existing client property or add a website URL to start auditing."
        />

        <TelemetryGrid className="mx-auto max-w-2xl p-6 md:p-8">
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-border bg-surface-2 text-brand">
                <Building2 className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h2 className="text-heading text-text">Choose a property</h2>
                <p className="max-w-[72ch] text-body text-text-muted">
                  Search trained hospitality and multi-vertical properties from the switcher or detect metadata from any URL.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                icon={<Search className="h-4 w-4" aria-hidden="true" />}
                onClick={() => setCommandPaletteOpen(true)}
              >
                Choose a property
              </Button>
            </div>

            <form onSubmit={handleAddByUrl} className="space-y-3 border-t border-border pt-5">
              <p className="text-caption font-medium text-text-muted">Or add by URL</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <Input
                  type="url"
                  placeholder="https://www.example.com"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  error={addError ?? undefined}
                  aria-label="Property URL"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  loading={adding}
                  icon={<Globe className="h-4 w-4" aria-hidden="true" />}
                  className="shrink-0"
                >
                  Add property
                </Button>
              </div>
            </form>
          </div>
        </TelemetryGrid>
      </div>
    );
  }

  const currentCounts = summarizeSeverityCounts(auditReport);
  const prevCounts = summarizeSeverityCounts(previousAuditReport);
  const errorDelta =
    currentCounts.errors !== null && prevCounts.errors !== null
      ? currentCounts.errors - prevCounts.errors
      : null;
  const warningDelta =
    currentCounts.warnings !== null && prevCounts.warnings !== null
      ? currentCounts.warnings - prevCounts.warnings
      : null;
  const noticeDelta =
    currentCounts.notices !== null && prevCounts.notices !== null
      ? currentCounts.notices - prevCounts.notices
      : null;

  const lastCrawlText = auditReport
    ? `Last crawl: ${new Date(auditReport.createdAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : "Last crawl: Not run yet";

  const progressPct = readyTasks.length > 0 ? Math.round((completedCount / readyTasks.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={activeProperty.name || activeProperty.url}
        description={lastCrawlText}
        meta={
          activeProperty.url ? (
            <a
              href={activeProperty.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-caption text-link hover:underline"
            >
              <span>{activeProperty.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          ) : undefined
        }
        secondaryActions={[
          { label: "Open Audit Overview", href: "/audit" },
          { label: "Pipeline Runner", onClick: () => setAutoPilotOpen(true) },
        ]}
        primaryAction={
          <Button
            variant="primary"
            size="md"
            loading={auditLoading}
            onClick={() => void runFullWebsiteAudit()}
            icon={<Play className="h-4 w-4" aria-hidden="true" />}
          >
            Run full audit
          </Button>
        }
      />

      {auditError && (
        <InlineAlert
          variant="error"
          title="Audit could not complete"
          description={auditError}
          onRetry={() => void runFullWebsiteAudit()}
        />
      )}

      {auditLoading && (
        <CrawlPulseScene
          active
          label={`Auditing ${activeProperty.name || activeProperty.url}...`}
          sublabel="Evaluating technical health, crawlability, headings, images, schema, and GEO readiness"
        />
      )}

      {/* Row 1: ScoreRing + 4 KPI Tiles */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="flex items-center p-4 md:p-5 sm:col-span-2 lg:col-span-1">
          {auditLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <ScoreRing score={auditReport?.overallScore ?? null} />
          )}
        </Card>
        <KpiTile
          label="Errors"
          value={currentCounts.errors}
          delta={errorDelta}
          goodWhen="down"
          caption={auditReport ? "P0 & P1 critical items" : "Not measured"}
        />
        <KpiTile
          label="Warnings"
          value={currentCounts.warnings}
          delta={warningDelta}
          goodWhen="down"
          caption={auditReport ? "P2 optimization items" : "Not measured"}
        />
        <KpiTile
          label="Notices"
          value={currentCounts.notices}
          delta={noticeDelta}
          goodWhen="down"
          caption={auditReport ? "P3 informational checks" : "Not measured"}
        />
        <KpiTile
          label="Pages crawled"
          value={auditReport ? Math.max(1, auditReport.crawlability.discoveredSitemaps.length) : null}
          caption={auditReport ? "Sitemaps & target root" : "Not measured"}
        />
      </section>

      {/* Row 2: Distribution Chart (2fr) + Vitals Bar (1fr) */}
      <section className="grid gap-4 lg:grid-cols-3">
        <DistributionChart
          className="lg:col-span-2"
          data={buildDistributionSeries(auditReport)}
        />
        <VitalsBar desktop={buildMeasuredVitals(auditReport)} mobile={buildMeasuredVitals(auditReport)} />
      </section>

      {/* Row 3: Domain Metrics + Task Progress */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Domain Metrics</CardTitle>
              <CardDescription>Crawlability, response latency, and indexation signals</CardDescription>
            </div>
            <Link href="/audit/pages" className="text-caption font-medium text-link hover:underline">
              Inspect pages &rarr;
            </Link>
          </CardHeader>
          <CardContent className="divide-y divide-border/50">
            <MetricRow
              label="Indexable status"
              value={auditReport ? (auditReport.crawlability.isIndexable ? "Indexable" : "Blocked") : null}
            />
            <MetricRow
              label="Average response time"
              value={auditReport ? `${auditReport.technicalHealth.responseTimeMs} ms` : null}
            />
            <MetricRow
              label="Canonical self-referencing"
              value={auditReport ? (auditReport.crawlability.isCanonicalSelfReferencing ? "Yes" : "No") : null}
            />
            <MetricRow
              label="Internal / External links"
              value={
                auditReport
                  ? `${auditReport.crawlability.totalInternalLinksDiscovered} / ${auditReport.crawlability.totalExternalLinksDiscovered}`
                  : null
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Task Progress</CardTitle>
              <CardDescription className="nums">
                {completedCount} / {readyTasks.length} ready workflows completed
              </CardDescription>
            </div>
            <Link href="/tasks" className="text-caption font-medium text-link hover:underline">
              All tasks &rarr;
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full rounded-full bg-brand transition-all duration-panel" style={{ width: `${progressPct}%` }} />
            </div>

            <ul className="divide-y divide-border">
              {nextThreeTasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link
                      href={`/tasks?section=${encodeURIComponent(task.section)}`}
                      className="block truncate text-body font-medium text-text hover:text-link"
                    >
                      {task.name}
                    </Link>
                    <span className="text-caption text-text-muted">{task.section}</span>
                  </div>
                  <Badge variant="outline">{task.outputType.toUpperCase()}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Row 4: Recent Runs DataTable */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-heading text-text">Recent Runs</h2>
          <Link href="/reports/history" className="text-caption font-medium text-link hover:underline">
            Full history &rarr;
          </Link>
        </div>

        <DataTable
          data={recentRunRows}
          loading={!runsLoaded}
          pageSize={8}
          enableColumnVisibility={false}
          emptyTitle="No task runs recorded yet"
          emptyDescription="Launch any task workflow or run the full audit pipeline to populate run logs."
          emptyAction={
            <Button variant="secondary" size="sm" asChild>
              <Link href="/tasks">Open Tasks</Link>
            </Button>
          }
          columns={[
            {
              accessorKey: "taskName",
              header: "Task",
              cell: ({ row }) => (
                <Link href={`/tasks?section=${encodeURIComponent(row.original.section)}`} className="font-medium text-text hover:text-link">
                  {row.original.taskName}
                </Link>
              ),
            },
            {
              accessorKey: "date",
              header: "Date",
              cell: ({ row }) => <span className="nums text-text-muted">{row.original.date}</span>,
            },
            {
              accessorKey: "status",
              header: "Status",
              cell: ({ row }) => {
                const s = row.original.status;
                const variant = s === "Done" ? "success" : s === "Flagged" ? "warning" : s === "Running" ? "notice" : "neutral";
                return <Badge variant={variant} dot>{s}</Badge>;
              },
            },
            {
              accessorKey: "outputUrl",
              header: "Output",
              cell: ({ row }) =>
                row.original.outputUrl ? (
                  <a href={row.original.outputUrl} target="_blank" rel="noreferrer" className="text-link hover:underline">
                    Open output
                  </a>
                ) : (
                  <span className="text-text-subtle">—</span>
                ),
            },
          ]}
        />
      </section>
    </div>
  );
}
