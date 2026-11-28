"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, RotateCcw } from "lucide-react";
import { DataTable, InlineAlert, KpiTile, PageHeader } from "@/components/data/index";
import {
  Badge,
  Button,
  Input,
  SelectField,
  SelectItem,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Textarea,
  toast,
} from "@/components/ui/index";
import type { FeedbackCategory, TrainingChangeEntry } from "@/core/training-feedback";
import { TASKS_CONFIG } from "@/tasks/tasks.config";

interface TrainingRule {
  id: string;
  taskId: string | null;
  title: string;
  ruleText: string;
  active: boolean;
  createdAt: string;
}

export function AiTrainingClient() {
  const [rules, setRules] = React.useState<TrainingRule[]>([]);
  const [history, setHistory] = React.useState<TrainingChangeEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isOperator, setIsOperator] = React.useState(false);

  const [search, setSearch] = React.useState("");
  const [selectedRule, setSelectedRule] = React.useState<TrainingRule | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [authorName, setAuthorName] = React.useState("");
  const [category, setCategory] = React.useState<FeedbackCategory>("seo");
  const [taskId, setTaskId] = React.useState("all");
  const [feedbackText, setFeedbackText] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [sessionRes, trainRes] = await Promise.all([
        fetch("/api/platform/session", { cache: "no-store" }),
        fetch("/api/ai-training", { cache: "no-store" }),
      ]);
      if (sessionRes.ok) {
        const sess = (await sessionRes.json()) as {
          authenticated?: boolean;
          devAuth?: boolean;
          principal?: { role?: string };
        };
        const allowed = Boolean(sess.devAuth) || (Boolean(sess.authenticated) && sess.principal?.role !== "viewer");
        setIsOperator(allowed);
      }
      if (trainRes.ok) {
        const json = (await trainRes.json()) as {
          rules?: TrainingRule[];
          history?: TrainingChangeEntry[];
        };
        setRules(json.rules ?? []);
        setHistory(json.history ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void loadAll();
  }, []);

  async function handleSubmitRule(e: React.FormEvent) {
    e.preventDefault();
    if (!authorName.trim() || !feedbackText.trim()) {
      toast.error("Enter your name and rule description.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/ai-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: authorName.trim(),
          category,
          feedbackText: feedbackText.trim(),
          taskId: category === "seo" && taskId !== "all" ? taskId : undefined,
        }),
      });
      const json = (await res.json()) as { error?: string; rules?: TrainingRule[]; history?: TrainingChangeEntry[] };
      if (!res.ok) throw new Error(json.error || "Could not save rule.");
      if (json.rules) setRules(json.rules);
      if (json.history) setHistory(json.history);
      setFeedbackText("");
      setCreateOpen(false);
      toast.success("Training rule saved");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRevert(historyId: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/ai-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revert", historyId }),
      });
      const json = (await res.json()) as { rules?: TrainingRule[]; history?: TrainingChangeEntry[] };
      if (res.ok) {
        if (json.rules) setRules(json.rules);
        if (json.history) setHistory(json.history);
        toast.success("Change reverted");
      }
    } finally {
      setSaving(false);
    }
  }

  const activeRules = rules.filter((r) => r.active);
  const filteredRules = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rules;
    return rules.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.ruleText.toLowerCase().includes(q) ||
        (r.taskId ?? "").toLowerCase().includes(q)
    );
  }, [rules, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Training Rules"
        description="Manage agency guardrails, brand standards, and workflow prompts."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Settings", href: "/settings/ai-training" },
          { label: "AI Training" },
        ]}
        primaryAction={
          isOperator ? (
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
              Add rule
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiTile label="Total rules" value={rules.length} />
        <KpiTile label="Active rules" value={activeRules.length} />
        <KpiTile label="Change log entries" value={history.length} />
      </div>

      {!isOperator ? (
        <InlineAlert
          variant="warning"
          title="Operator authentication required for rule details"
          description="Non-operator sessions display summary counts only. Sign in through the Operator Console to view, edit, or revert training rules."
          action={
            <Button variant="secondary" size="sm" asChild>
              <Link href="/platform">Open Operator Console</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-heading text-text">Active &amp; Archived Rules</h2>
            <div className="w-full sm:w-64">
              <Input
                type="search"
                placeholder="Search rules..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Filter training rules"
              />
            </div>
          </div>

          <DataTable
            data={filteredRules}
            loading={loading}
            emptyTitle="No training rules configured"
            emptyDescription="Add a custom SEO rule or brand voice guideline to shape generated copy."
            onRowClick={(row) => setSelectedRule(row)}
            columns={[
              { accessorKey: "title", header: "Title" },
              {
                accessorKey: "taskId",
                header: "Scope",
                cell: ({ row }) => (
                  <Badge variant="neutral">{row.original.taskId || "Global"}</Badge>
                ),
              },
              {
                accessorKey: "createdAt",
                header: "Updated",
                cell: ({ row }) => (
                  <span className="nums text-text-muted">
                    {new Date(row.original.createdAt).toLocaleDateString()}
                  </span>
                ),
              },
              {
                accessorKey: "active",
                header: "Status",
                cell: ({ row }) => (
                  <Badge variant={row.original.active ? "success" : "neutral"} dot>
                    {row.original.active ? "Active" : "Inactive"}
                  </Badge>
                ),
              },
            ]}
          />

          {history.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-heading text-text">Change History</h2>
              <DataTable
                data={history}
                enableColumnVisibility={false}
                columns={[
                  { accessorKey: "authorName", header: "Author" },
                  {
                    accessorKey: "category",
                    header: "Category",
                    cell: ({ row }) => <Badge variant="outline">{row.original.category}</Badge>,
                  },
                  { accessorKey: "summary", header: "Summary" },
                  {
                    id: "revert",
                    header: "Action",
                    cell: ({ row }) => (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={saving}
                        icon={<RotateCcw className="h-3.5 w-3.5" />}
                        onClick={() => void handleRevert(row.original.id)}
                      >
                        Revert
                      </Button>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </>
      )}

      {/* Rule Details Sheet */}
      <Sheet open={Boolean(selectedRule)} onOpenChange={(open) => !open && setSelectedRule(null)}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>{selectedRule?.title}</SheetTitle>
            <SheetDescription>Scope: {selectedRule?.taskId || "Global"}</SheetDescription>
          </SheetHeader>
          {selectedRule && (
            <div className="space-y-4 p-5">
              <Badge variant={selectedRule.active ? "success" : "neutral"} dot>
                {selectedRule.active ? "Active" : "Inactive"}
              </Badge>
              <p className="max-w-[72ch] text-body text-text">{selectedRule.ruleText}</p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Add Rule Sheet */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Add Training Rule</SheetTitle>
            <SheetDescription>Applied automatically during prompt synthesis and audit validation.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmitRule} className="space-y-4 p-5">
            <Input
              label="Author Name"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Operator name"
            />
            <SelectField
              label="Category"
              value={category}
              onValueChange={(val) => setCategory(val as FeedbackCategory)}
            >
              <SelectItem value="seo">SEO Rule</SelectItem>
              <SelectItem value="design">Workspace Preference</SelectItem>
            </SelectField>
            {category === "seo" && (
              <SelectField label="Target Task Scope" value={taskId} onValueChange={setTaskId}>
                <SelectItem value="all">Global (All Tasks)</SelectItem>
                {TASKS_CONFIG.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectField>
            )}
            <Textarea
              label="Rule Guidance"
              rows={5}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Always preserve franchise brand suffixes and omit discount claims..."
            />
            <SheetFooter className="border-t-0 px-0 pt-2">
              <Button variant="secondary" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={saving}>
                Save rule
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
