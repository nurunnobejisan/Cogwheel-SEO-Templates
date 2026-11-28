"use client";

import * as React from "react";
import { DataTable, PageHeader } from "@/components/data/index";
import { Badge, Button, SelectField, SelectItem } from "@/components/ui/index";
import { downloadBase64WithCountdown } from "@/lib/download-manager";
import { TASKS_CONFIG, type TaskStatus } from "@/tasks/tasks.config";

interface TaskRunItem {
  id: string;
  taskId: string;
  status: TaskStatus;
  outputUrl: string | null;
  output?: { xlsxBase64?: string; filename?: string } | null;
  flags: Array<{ code: string; message: string; severity: string }>;
  createdAt: string;
}

export function ReportsHistoryClient() {
  const readyTasks = React.useMemo(
    () => TASKS_CONFIG.filter((t) => t.phase === 1 || t.status === "Done"),
    []
  );
  const [selectedTaskId, setSelectedTaskId] = React.useState(readyTasks[0]?.id ?? TASKS_CONFIG[0].id);
  const [runs, setRuns] = React.useState<TaskRunItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/tasks/${selectedTaskId}/runs`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { runs: [] }))
      .then((json: { runs?: TaskRunItem[] }) => {
        if (!cancelled) setRuns(json.runs ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTaskId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Run History"
        description="Inspect execution logs, validation flags, and downloadable XLSX or Doc artifacts."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Reports", href: "/reports" },
          { label: "Run History" },
        ]}
      />

      <div className="max-w-xs">
        <SelectField label="Task Module" value={selectedTaskId} onValueChange={setSelectedTaskId}>
          {readyTasks.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectField>
      </div>

      <DataTable
        data={runs}
        loading={loading}
        emptyTitle="No recorded runs for this module"
        emptyDescription="Execute this workflow from the Tasks page to inspect historical runs."
        columns={[
          {
            accessorKey: "createdAt",
            header: "Executed",
            cell: ({ row }) => (
              <span className="nums">{new Date(row.original.createdAt).toLocaleString()}</span>
            ),
          },
          {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => (
              <Badge variant={row.original.status === "Done" ? "success" : row.original.status === "Flagged" ? "warning" : "neutral"} dot>
                {row.original.status}
              </Badge>
            ),
          },
          {
            id: "flags",
            header: "Flags",
            cell: ({ row }) => (
              <span className="nums text-text-muted">{row.original.flags.length}</span>
            ),
          },
          {
            id: "output",
            header: "Artifact",
            cell: ({ row }) => {
              const out = row.original.output;
              if (out?.xlsxBase64) {
                return (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      downloadBase64WithCountdown(
                        out.xlsxBase64!,
                        out.filename || `${row.original.taskId}.xlsx`,
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      )
                    }
                  >
                    Download XLSX
                  </Button>
                );
              }
              if (row.original.outputUrl) {
                return (
                  <a href={row.original.outputUrl} target="_blank" rel="noreferrer" className="text-link hover:underline">
                    Open output
                  </a>
                );
              }
              return <span className="text-text-subtle">—</span>;
            },
          },
        ]}
      />
    </div>
  );
}
