"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { History, Play, Sparkles } from "lucide-react";
import { DataTable, FilterTabs, InlineAlert, PageHeader } from "@/components/data/index";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  toast,
} from "@/components/ui/index";
import { downloadBase64WithCountdown } from "@/lib/download-manager";
import { cn } from "@/lib/utils";
import { TASK_SECTIONS, TASKS_CONFIG, type TaskConfig, type TaskSection, type TaskStatus } from "@/tasks/tasks.config";

const CRAWL_TASK_IDS = new Set([
  "title-meta",
  "heading-structure",
  "technical-audit",
  "image-optimization",
  "duplicate-content-audit",
  "schema-markup",
  "sitemap-navigation-optimization",
  "site-tech-re-audit-report",
  "compsets-keywords-analysis",
  "keyword-ranking-report-comp-set",
  "internal-kickoff-strategy-list",
  "email-outreach-formatting",
  "competitors-backlink-analysis",
  "backlinking-strategy-execution",
  "google-map-citation",
  "ai-seo-visibility-report",
  "final-seo-geo-project-report",
]);

interface TaskRunItem {
  id: string;
  taskId: string;
  status: TaskStatus;
  outputUrl: string | null;
  output?: Record<string, unknown> | null;
  flags: Array<{ code: string; message: string; severity: string }>;
  createdAt: string;
}

export function TasksPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sectionParam = searchParams?.get("section") as TaskSection | null;
  const activeSection: TaskSection =
    sectionParam && TASK_SECTIONS.includes(sectionParam) ? sectionParam : "On Page";

  const { activeProperty, latestRuns, runsLoaded, refreshRuns, setAutoPilotOpen } = useWorkspace();

  const [filterMode, setFilterMode] = React.useState<"ready" | "all" | "upcoming">("ready");
  const [search, setSearch] = React.useState("");

  const [runModalTask, setRunModalTask] = React.useState<TaskConfig | null>(null);
  const [propForm, setPropForm] = React.useState({
    name: activeProperty.name,
    brand: activeProperty.brand,
    city: activeProperty.city,
    state: activeProperty.state,
  });
  const [runBusy, setRunBusy] = React.useState(false);
  const [runError, setRunError] = React.useState<string | null>(null);

  const [historyTask, setHistoryTask] = React.useState<TaskConfig | null>(null);
  const [historyItems, setHistoryItems] = React.useState<TaskRunItem[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);

  const [roadmapTask, setRoadmapTask] = React.useState<TaskConfig | null>(null);
  const [prioritizing, setPrioritizing] = React.useState(false);

  const readyCount = React.useMemo(
    () => TASKS_CONFIG.filter((t) => t.phase === 1 || t.status === "Done").length,
    []
  );

  const sectionTasks = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return TASKS_CONFIG.filter((t) => {
      if (t.section !== activeSection) return false;
      const isImpl = t.phase === 1 || t.status === "Done";
      if (filterMode === "ready" && !isImpl) return false;
      if (filterMode === "upcoming" && isImpl) return false;
      if (q && !t.name.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [activeSection, filterMode, search]);

  async function openHistory(task: TaskConfig) {
    setHistoryTask(task);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/runs`, { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as { runs?: TaskRunItem[] };
        setHistoryItems(json.runs ?? []);
      } else {
        setHistoryItems([]);
      }
    } finally {
      setHistoryLoading(false);
    }
  }

  function handleRunAction(task: TaskConfig) {
    const isImpl = task.phase === 1 || task.status === "Done";
    if (!isImpl) {
      setRoadmapTask(task);
      return;
    }
    if (task.id === "seo-baseline-ai-visibility") {
      router.push("/reports/slides");
      return;
    }
    if (task.id === "seo-only-visibility-report") {
      router.push("/reports/pptx");
      return;
    }
    if (task.id === "site-crawl") {
      router.push("/audit/pages");
      return;
    }
    if (task.id === "image-optimization") {
      router.push("/audit/images");
      return;
    }
    if (task.id === "heading-structure") {
      router.push("/audit/headings");
      return;
    }
    if (task.id === "keyword-research") {
      router.push("/keywords");
      return;
    }
    if (task.id === "usp-headline-optimization") {
      router.push("/content");
      return;
    }
    if (CRAWL_TASK_IDS.has(task.id)) {
      setRunError(null);
      setPropForm({
        name: activeProperty.name,
        brand: activeProperty.brand,
        city: activeProperty.city,
        state: activeProperty.state,
      });
      setRunModalTask(task);
      return;
    }
    router.push("/keywords/matrix");
  }

  async function executeCrawlTask(e: React.FormEvent) {
    e.preventDefault();
    if (!runModalTask) return;
    setRunBusy(true);
    setRunError(null);
    try {
      const res = await fetch(`/api/tasks/${runModalTask.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property: {
            name: propForm.name.trim(),
            brand: propForm.brand.trim(),
            city: propForm.city.trim(),
            state: propForm.state.trim().toUpperCase(),
            ...(activeProperty.url.trim() ? { url: activeProperty.url.trim() } : {}),
            allowedLocations: [],
            excludedLocations: [],
          },
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Task execution failed.");
      await refreshRuns();
      const finished = runModalTask;
      setRunModalTask(null);
      toast.success(`${finished.name} completed`);
      void openHistory(finished);
    } catch (err) {
      setRunError((err as Error).message);
    } finally {
      setRunBusy(false);
    }
  }

  async function prioritizeRoadmap(task: TaskConfig) {
    setPrioritizing(true);
    try {
      await fetch("/api/ai-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: "Team Request",
          category: "seo",
          taskId: task.id,
          feedbackText: `Prioritize roadmap task "${task.name}" (Phase ${task.phase}).`,
        }),
      });
      toast.success("Prioritized in AI Training feedback");
    } finally {
      setPrioritizing(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks Suite"
        description="Execute SEO & GEO workflow deliverables with dependency checks and run logs."
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Tasks" }]}
        primaryAction={
          <Button
            variant="primary"
            onClick={() => setAutoPilotOpen(true)}
            icon={<Play className="h-4 w-4" aria-hidden="true" />}
          >
            Run all ready tasks
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          value={filterMode}
          onChange={(v) => setFilterMode(v as "ready" | "all" | "upcoming")}
          options={[
            { id: "ready", label: "Active", count: readyCount },
            { id: "all", label: "All", count: TASKS_CONFIG.length },
            { id: "upcoming", label: "Upcoming", count: TASKS_CONFIG.length - readyCount },
          ]}
        />
        <div className="w-full sm:w-64">
          <Input
            type="search"
            placeholder="Filter tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter tasks"
          />
        </div>
      </div>

      {/* Mobile horizontal chips */}
      <nav aria-label="Task sections mobile" className="flex snap-x items-center gap-2 overflow-x-auto pb-1 lg:hidden">
        {TASK_SECTIONS.map((sec) => {
          const count = TASKS_CONFIG.filter((t) => t.section === sec).length;
          const active = sec === activeSection;
          return (
            <button
              key={sec}
              type="button"
              onClick={() => router.replace(`/tasks?section=${encodeURIComponent(sec)}`)}
              className={cn(
                "shrink-0 snap-start rounded-sm border px-3 py-1.5 text-caption font-medium",
                active
                  ? "border-sidebar-active bg-sidebar-active text-sidebar-text"
                  : "border-border bg-surface text-text-muted"
              )}
            >
              {sec} ({count})
            </button>
          );
        })}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Desktop vertical sub-nav */}
        <nav aria-label="Task sections" className="hidden space-y-1 lg:block">
          {TASK_SECTIONS.map((sec) => {
            const count = TASKS_CONFIG.filter((t) => t.section === sec).length;
            const active = sec === activeSection;
            return (
              <button
                key={sec}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => router.replace(`/tasks?section=${encodeURIComponent(sec)}`)}
                className={cn(
                  "relative flex h-9 w-full items-center justify-between rounded-sm px-3 text-body transition-colors",
                  active
                    ? "bg-sidebar-active font-medium text-sidebar-text"
                    : "text-text-muted hover:bg-surface-2 hover:text-text"
                )}
              >
                {active && (
                  <span aria-hidden="true" className="absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-r-full bg-brand" />
                )}
                <span>{sec}</span>
                <span className="nums text-caption opacity-80">{count}</span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          <DataTable
            data={sectionTasks}
            loading={!runsLoaded}
            emptyTitle={`No matching tasks in ${activeSection}`}
            emptyDescription="Switch filter tabs to All or Upcoming to inspect planned roadmap workflows."
            emptyAction={
              <Button variant="secondary" size="sm" onClick={() => setFilterMode("all")}>
                Show all tasks
              </Button>
            }
            columns={[
              {
                accessorKey: "name",
                header: "Task",
                cell: ({ row }) => (
                  <div className="min-w-0 max-w-sm">
                    <p className="font-medium text-text">{row.original.name}</p>
                    <p className="truncate text-caption text-text-muted">{row.original.description}</p>
                  </div>
                ),
              },
              {
                id: "status",
                header: "Status",
                cell: ({ row }) => {
                  const isImpl = row.original.phase === 1 || row.original.status === "Done";
                  if (!isImpl) return <Badge variant="warning">Phase {row.original.phase}</Badge>;
                  const st = latestRuns[row.original.id]?.status ?? "Not started";
                  const v = st === "Done" ? "success" : st === "Flagged" ? "warning" : st === "Running" ? "notice" : "neutral";
                  return <Badge variant={v} dot>{st}</Badge>;
                },
              },
              {
                accessorKey: "outputType",
                header: "Output",
                cell: ({ row }) => (
                  <Badge variant="outline">{row.original.outputType.toUpperCase()}</Badge>
                ),
              },
              {
                accessorKey: "dependsOn",
                header: "Dependencies",
                cell: ({ row }) =>
                  row.original.dependsOn.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {row.original.dependsOn.map((dep) => (
                        <Badge key={dep} variant="neutral">
                          {dep}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-text-subtle">—</span>
                  ),
              },
              {
                id: "lastRun",
                header: "Last run",
                cell: ({ row }) => {
                  const run = latestRuns[row.original.id];
                  return run ? (
                    <span className="nums text-caption text-text-muted">
                      {new Date(run.createdAt).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-text-subtle">—</span>
                  );
                },
              },
              {
                id: "actions",
                header: "Actions",
                cell: ({ row }) => {
                  const isImpl = row.original.phase === 1 || row.original.status === "Done";
                  return (
                    <div className="flex items-center gap-1.5">
                      {isImpl && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`History for ${row.original.name}`}
                          onClick={() => void openHistory(row.original)}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="icon"
                        aria-label={isImpl ? `Run ${row.original.name}` : `Inspect ${row.original.name}`}
                        onClick={() => handleRunAction(row.original)}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                },
              },
            ]}
          />
        </div>
      </div>

      {/* Run Task Property Dialog */}
      <Dialog open={Boolean(runModalTask)} onOpenChange={(open) => !open && setRunModalTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{runModalTask?.name}</DialogTitle>
            <DialogDescription>Uses the latest Site Crawl run and active property profile.</DialogDescription>
          </DialogHeader>
          <form onSubmit={executeCrawlTask} className="space-y-3 px-5 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Property Name"
                value={propForm.name}
                onChange={(e) => setPropForm((p) => ({ ...p, name: e.target.value }))}
              />
              <Input
                label="Brand"
                value={propForm.brand}
                onChange={(e) => setPropForm((p) => ({ ...p, brand: e.target.value }))}
              />
              <Input
                label="City"
                value={propForm.city}
                onChange={(e) => setPropForm((p) => ({ ...p, city: e.target.value }))}
              />
              <Input
                label="State"
                maxLength={2}
                value={propForm.state}
                onChange={(e) => setPropForm((p) => ({ ...p, state: e.target.value.toUpperCase() }))}
              />
            </div>
            {runError && <InlineAlert variant="error" title="Task failed" description={runError} />}
            <DialogFooter className="border-t-0 px-0 pb-0 pt-2">
              <Button variant="secondary" onClick={() => setRunModalTask(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={runBusy}>
                Run task
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Run History Sheet */}
      <Sheet open={Boolean(historyTask)} onOpenChange={(open) => !open && setHistoryTask(null)}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Run History: {historyTask?.name}</SheetTitle>
            <SheetDescription>Recorded task executions and downloadable artifacts.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            {historyLoading ? (
              <p className="text-caption text-text-muted">Loading runs...</p>
            ) : historyItems.length === 0 ? (
              <p className="text-caption text-text-muted">No runs recorded for this task yet.</p>
            ) : (
              historyItems.map((run) => {
                const output = run.output as { xlsxBase64?: string; filename?: string } | null | undefined;
                return (
                  <div key={run.id} className="surface-card space-y-2 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={run.status === "Done" ? "success" : run.status === "Flagged" ? "warning" : "neutral"}>
                        {run.status}
                      </Badge>
                      <span className="nums text-caption text-text-muted">
                        {new Date(run.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {run.flags.length > 0 && (
                      <p className="text-caption text-warning-fg">
                        {run.flags.map((f) => f.message).join(" · ")}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {run.outputUrl && (
                        <a
                          href={run.outputUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-caption font-medium text-link hover:underline"
                        >
                          Open output &rarr;
                        </a>
                      )}
                      {output?.xlsxBase64 && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            downloadBase64WithCountdown(
                              output.xlsxBase64!,
                              output.filename || `${run.taskId}.xlsx`,
                              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            )
                          }
                        >
                          Download XLSX
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Upcoming Roadmap Sheet */}
      <Sheet open={Boolean(roadmapTask)} onOpenChange={(open) => !open && setRoadmapTask(null)}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>{roadmapTask?.name}</SheetTitle>
            <SheetDescription>Scheduled for Phase {roadmapTask?.phase} release</SheetDescription>
          </SheetHeader>
          {roadmapTask && (
            <div className="space-y-4 p-5">
              <p className="max-w-[72ch] text-body text-text">{roadmapTask.description}</p>
              <div className="space-y-1.5">
                <p className="text-overline uppercase text-text-muted">Required Data Sources</p>
                <div className="flex flex-wrap gap-1.5">
                  {roadmapTask.dataSources.map((src) => (
                    <Badge key={src} variant="neutral">{src}</Badge>
                  ))}
                </div>
              </div>
              <Button
                variant="secondary"
                loading={prioritizing}
                icon={<Sparkles className="h-4 w-4" />}
                onClick={() => void prioritizeRoadmap(roadmapTask)}
              >
                Request Priority Access
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
