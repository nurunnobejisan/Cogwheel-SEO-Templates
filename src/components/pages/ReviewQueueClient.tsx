"use client";

/**
 * Human review queue — operator page (v2 WP1).
 *
 * Lives inside the existing "Train AI" area (`/settings/ai-training/review`).
 * Lists pending rows from the three queues (golden-v2 candidates,
 * teacher-drafted triples, shadow-mode disagreements) with the input,
 * candidate output, gate results and source licence, and records
 * approve / edit-and-approve / reject decisions through the operator-only
 * `/api/review-queue` API.
 */

import * as React from "react";
import Link from "next/link";
import { Check, Pencil, X } from "lucide-react";
import { InlineAlert, KpiTile, PageHeader } from "@/components/data/index";
import {
  Badge,
  Button,
  Textarea,
  toast,
} from "@/components/ui/index";

interface GateResult {
  gate: string;
  passed: boolean;
  detail?: string;
}

interface ReviewRow {
  id: string;
  refId?: string;
  source: "golden_candidate" | "teacher_triple" | "shadow_disagreement";
  task?: string;
  input: unknown;
  candidateOutput: unknown;
  gateResults: GateResult[];
  sourceLicence: string;
  enqueuedAt: string;
  reviewed: boolean;
  reviewer?: string;
  reviewedAt?: string;
  decision?: "approved" | "rejected";
  action?: string;
  reason?: string;
  output?: unknown;
  originalOutput?: unknown;
}

interface Snapshot {
  rows?: ReviewRow[];
  stats?: { pending: number; approved: number; rejected: number };
}

const SOURCE_LABEL: Record<ReviewRow["source"], string> = {
  golden_candidate: "Golden v2 candidate",
  teacher_triple: "Teacher triple",
  shadow_disagreement: "Shadow disagreement",
};

function preview(value: unknown, max = 700): string {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (!text) return "(empty)";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function ReviewQueueClient() {
  const [rows, setRows] = React.useState<ReviewRow[]>([]);
  const [stats, setStats] = React.useState<Snapshot["stats"]>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [authed, setAuthed] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editText, setEditText] = React.useState("");
  const [reasonFor, setReasonFor] = React.useState<string | null>(null);
  const [reasonText, setReasonText] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/review-queue", { cache: "no-store" });
      if (res.status === 401) {
        setAuthed(false);
        setRows([]);
        return;
      }
      setAuthed(true);
      const json = (await res.json()) as Snapshot & { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Failed to load the review queue.");
        return;
      }
      setRows(json.rows ?? []);
      setStats(json.stats);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function decide(
    row: ReviewRow,
    action: "approve" | "edit_and_approve" | "reject",
    reason?: string,
    editedOutput?: string,
  ) {
    setBusyId(row.id);
    try {
      const res = await fetch("/api/review-queue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          action,
          ...(reason ? { reason } : {}),
          ...(editedOutput !== undefined ? { editedOutput } : {}),
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      if (!res.ok) {
        toast.error(json.error ?? "Decision failed");
        return;
      }
      toast.success(
        action === "reject"
          ? "Rejected — the row can never become training data."
          : "Approved — the row is eligible for export.",
      );
      setEditingId(null);
      setEditText("");
      setReasonFor(null);
      setReasonText("");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const pending = rows.filter((row) => !row.reviewed);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review Queue"
        description="Human decisions for golden-v2 candidates, teacher triples and shadow-mode disagreements. A rejected row is never exported to a builder."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Settings", href: "/settings/ai-training" },
          { label: "AI Training", href: "/settings/ai-training" },
          { label: "Review queue" },
        ]}
        primaryAction={
          <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiTile label="Pending" value={stats?.pending ?? 0} />
        <KpiTile label="Approved" value={stats?.approved ?? 0} />
        <KpiTile label="Rejected" value={stats?.rejected ?? 0} />
      </div>

      {!authed ? (
        <InlineAlert
          variant="warning"
          title="Operator authentication required"
          description="The review queue is operator-only. Sign in through the Operator Console to review rows."
          action={
            <Button variant="secondary" size="sm" asChild>
              <Link href="/platform">Open Operator Console</Link>
            </Button>
          }
        />
      ) : null}

      {authed && error ? (
        <InlineAlert variant="error" title="Could not load the queue" description={error} />
      ) : null}

      {authed && !loading && pending.length === 0 ? (
        <InlineAlert
          variant="success"
          title="Queue clear"
          description="No pending rows. Producers enqueue new work automatically on the next refresh."
        />
      ) : null}

      {authed
        ? pending.map((row) => (
            <div key={row.id} className="rounded-lg border border-border bg-surface p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{SOURCE_LABEL[row.source]}</Badge>
                {row.task ? <Badge>{row.task}</Badge> : null}
                <Badge>licence: {row.sourceLicence}</Badge>
                <span className="text-xs text-muted">{row.enqueuedAt}</span>
              </div>

              {row.gateResults.length ? (
                <div className="flex flex-wrap gap-2">
                  {row.gateResults.map((gate) => (
                    <Badge key={gate.gate}>
                      {gate.passed ? "✓" : "✗"} {gate.gate}
                    </Badge>
                  ))}
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-muted mb-1">Input</p>
                  <pre className="whitespace-pre-wrap break-words rounded bg-muted/40 p-2 text-xs">
                    {preview(row.input)}
                  </pre>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted mb-1">Candidate output</p>
                  <pre className="whitespace-pre-wrap break-words rounded bg-muted/40 p-2 text-xs">
                    {preview(row.candidateOutput)}
                  </pre>
                </div>
              </div>

              {editingId === row.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={editText}
                    onChange={(event) => setEditText(event.target.value)}
                    rows={8}
                    placeholder="Edited output (the original candidate is kept as provenance)"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Check className="h-3.5 w-3.5" />}
                      disabled={busyId === row.id || !editText.trim()}
                      onClick={() =>
                        void decide(row, "edit_and_approve", reasonText || undefined, editText)
                      }
                    >
                      Approve edit
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Check className="h-3.5 w-3.5" />}
                    disabled={busyId === row.id}
                    onClick={() => void decide(row, "approve", reasonFor === row.id ? reasonText : undefined)}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Pencil className="h-3.5 w-3.5" />}
                    disabled={busyId === row.id}
                    onClick={() => {
                      setEditingId(row.id);
                      setEditText(preview(row.candidateOutput, 100000));
                    }}
                  >
                    Edit &amp; approve
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<X className="h-3.5 w-3.5" />}
                    disabled={busyId === row.id}
                    onClick={() => void decide(row, "reject", reasonFor === row.id ? reasonText : undefined)}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setReasonFor(reasonFor === row.id ? null : row.id)}
                  >
                    {reasonFor === row.id ? "Hide reason" : "Add reason"}
                  </Button>
                </div>
              )}

              {reasonFor === row.id && editingId !== row.id ? (
                <Textarea
                  value={reasonText}
                  onChange={(event) => setReasonText(event.target.value)}
                  rows={2}
                  placeholder="Optional reason recorded with the decision"
                />
              ) : null}
            </div>
          ))
        : null}
    </div>
  );
}
