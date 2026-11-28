"use client";

import * as React from "react";
import Link from "next/link";
import { FileBarChart2, FileText, Mail, Presentation, Sparkles } from "lucide-react";
import { DataTable, PageHeader } from "@/components/data/index";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/index";
import { TASKS_CONFIG } from "@/tasks/tasks.config";

const DELIVERABLE_TYPES = [
  {
    type: "deck",
    title: "Executive Pitch Deck (PDF)",
    description: "White-label 2-page GM and asset manager summary ready to print or save as PDF.",
    icon: FileText,
  },
  {
    type: "pptx",
    title: "SEO Visibility Deck (PPTX)",
    description: "Downloadable PowerPoint deck with audit highlights and AI visibility placeholders.",
    icon: Presentation,
  },
  {
    type: "slides",
    title: "Google Slides Baseline",
    description: "Automated Google Slides baseline presentation synced to your workspace.",
    icon: Sparkles,
  },
  {
    type: "preview",
    title: "Slide Deck Preview",
    description: "Interactive slide-by-slide preview before client export.",
    icon: FileBarChart2,
  },
  {
    type: "memo",
    title: "Executive Memo",
    description: "Concise strategy memo summarizing priority SEO & GEO actions.",
    icon: FileText,
  },
  {
    type: "email",
    title: "Client Email Dispatcher",
    description: "Formatted client update email with attached report links and next steps.",
    icon: Mail,
  },
];

export function ReportsGalleryClient() {
  const { latestRuns, runsLoaded } = useWorkspace();

  const historyRows = React.useMemo(() => {
    return Object.values(latestRuns)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((r) => {
        const cfg = TASKS_CONFIG.find((t) => t.id === r.taskId);
        return {
          taskId: r.taskId,
          taskName: cfg?.name ?? r.taskId,
          date: new Date(r.createdAt).toLocaleString(),
          status: r.status,
          outputUrl: r.outputUrl,
        };
      });
  }, [latestRuns]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports & Deliverables"
        description="Generate client-ready presentations, memos, and email summaries."
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Reports" }]}
        secondaryActions={[{ label: "Run History", href: "/reports/history" }]}
      />

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {DELIVERABLE_TYPES.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.type} className="flex flex-col justify-between">
              <CardHeader className="border-b-0 pb-0">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-border bg-surface-2 text-text-muted">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <CardTitle>{item.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4 pt-2">
                <CardDescription className="max-w-[72ch]">{item.description}</CardDescription>
                <div>
                  <Button variant="secondary" size="sm" asChild>
                    <Link href={`/reports/${item.type}`}>Generate</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-heading text-text">Recent Deliverable Runs</h2>
          <Link href="/reports/history" className="text-caption font-medium text-link hover:underline">
            View all runs &rarr;
          </Link>
        </div>
        <DataTable
          data={historyRows}
          loading={!runsLoaded}
          emptyTitle="No report runs yet"
          emptyDescription="Generate any deliverable above or run a workflow task to populate history."
          columns={[
            { accessorKey: "taskName", header: "Task" },
            {
              accessorKey: "date",
              header: "Date",
              cell: ({ row }) => <span className="nums text-text-muted">{row.original.date}</span>,
            },
            {
              accessorKey: "status",
              header: "Status",
              cell: ({ row }) => (
                <Badge variant={row.original.status === "Done" ? "success" : "neutral"} dot>
                  {row.original.status}
                </Badge>
              ),
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
