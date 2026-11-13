"use client";

import { useEffect, useState } from "react";
import type { TaskConfig, TaskStatus } from "@/tasks/tasks.config";
import { Button, Card } from "./ui";

interface RunFlag {
  code: string;
  message: string;
  severity: string;
}

interface TaskRunItem {
  id: string;
  taskId: string;
  status: TaskStatus;
  outputUrl: string | null;
  output?: Record<string, unknown> | null;
  flags: RunFlag[];
  createdAt: string;
}

interface Props {
  task: TaskConfig;
  onClose: () => void;
}

const BADGE: Record<TaskStatus, string> = {
  "Not started": "bg-slate-100 text-slate-600 border-slate-200",
  Running: "bg-sky-50 text-sky-700 border-sky-200",
  Done: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Flagged: "bg-amber-50 text-amber-800 border-amber-200",
};

function downloadBase64Xlsx(base64: string, filename: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function RunHistoryDrawer({ task, onClose }: Props) {
  const [runs, setRuns] = useState<TaskRunItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/tasks/${task.id}/runs`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { runs?: TaskRunItem[] };
        if (!cancelled && json.runs) {
          setRuns(json.runs);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [task.id]);

  return (
    <Card
      title={`${task.name} — Run History`}
      subtitle={`Recent executions, Flag Summaries, and downloadable outputs for ${task.id}.`}
      actions={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      {loading ? (
        <div className="py-6 text-center text-xs text-slate-500">Loading run history...</div>
      ) : runs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
          No recorded runs yet for {task.name}. Click <strong>Run Task</strong> to execute your first run.
        </div>
      ) : (
        <div className="space-y-3">
          {runs.slice(0, 10).map((run) => {
            const xlsxBase64 =
              run.output && typeof run.output.xlsxBase64 === "string" ? run.output.xlsxBase64 : null;
            const jsonLdScript =
              run.output && typeof run.output.combinedJsonLdScript === "string"
                ? run.output.combinedJsonLdScript
                : null;

            return (
              <div
                key={run.id}
                className="space-y-2.5 rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${BADGE[run.status]}`}
                    >
                      {run.status}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(run.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {run.outputUrl && (
                      <a
                        href={run.outputUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-hilton hover:bg-slate-100"
                      >
                        Open Output
                      </a>
                    )}
                    {xlsxBase64 && (
                      <button
                        type="button"
                        onClick={() => downloadBase64Xlsx(xlsxBase64, `${task.id}-${run.id.slice(0, 8)}.xlsx`)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Download .xlsx
                      </button>
                    )}
                    {jsonLdScript && (
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(jsonLdScript);
                          setCopiedId(run.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        {copiedId === run.id ? "Copied JSON-LD" : "Copy JSON-LD"}
                      </button>
                    )}
                  </div>
                </div>

                {run.flags.length > 0 && (
                  <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
                    <div className="font-semibold">Flag Summary ({run.flags.length})</div>
                    <ul className="list-disc space-y-0.5 pl-4">
                      {run.flags.map((f, idx) => (
                        <li key={`${run.id}-flag-${idx}`}>
                          <span className="font-mono text-[11px] uppercase">[{f.code}]</span> {f.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

