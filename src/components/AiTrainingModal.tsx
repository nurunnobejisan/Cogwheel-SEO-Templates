"use client";

import { useEffect, useState } from "react";
import { TASKS_CONFIG } from "@/tasks/tasks.config";
import { Button, Card } from "./ui";

interface TrainingRule {
  id: string;
  taskId: string | null;
  title: string;
  ruleText: string;
  exampleBad?: string | null;
  exampleGood?: string | null;
  active: boolean;
  createdAt: string;
}

export function AiTrainingModal({ onClose }: { onClose: () => void }) {
  const [rules, setRules] = useState<TrainingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [taskId, setTaskId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [ruleText, setRuleText] = useState("");
  const [exampleGood, setExampleGood] = useState("");
  const [exampleBad, setExampleBad] = useState("");

  async function loadRules() {
    try {
      const res = await fetch("/api/ai-training", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load training rules");
      const json = (await res.json()) as { rules: TrainingRule[] };
      setRules(json.rules ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load training rules");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRules();
  }, []);

  async function handleAddRule() {
    if (!title.trim() || !ruleText.trim()) {
      setError("Please enter both a Rule Title and the Rule / Feedback instruction.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/ai-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: taskId || null,
          title: title.trim(),
          ruleText: ruleText.trim(),
          exampleGood: exampleGood.trim() || undefined,
          exampleBad: exampleBad.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save rule");
      setRules((prev) => [json.rule as TrainingRule, ...prev]);
      setTitle("");
      setRuleText("");
      setExampleGood("");
      setExampleBad("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save rule");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(rule: TrainingRule) {
    const next = !rule.active;
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, active: next } : r)));
    await fetch("/api/ai-training", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rule.id, active: next }),
    });
  }

  async function handleDelete(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/ai-training?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  const activeCount = rules.filter((r) => r.active).length;

  return (
    <Card
      className="animate-fade-in mb-6 border-slate-200"
      title={
        <div className="flex items-center gap-2.5">
          <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-light">
            AI Training
          </span>
          <span>Train AI &amp; Team Rules</span>
        </div>
      }
      subtitle="Add feedback from Michael or your SEO team. Active rules are automatically injected into every Claude prompt across the app."
      actions={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Task Scope</label>
              <select
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                className="input"
              >
                <option value="">All Tasks (Global Rule)</option>
                {TASKS_CONFIG.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.section} — {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Rule Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Soft Brand Vanity Site Rule"
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label">Training Instruction / Team Feedback *</label>
            <textarea
              rows={3}
              value={ruleText}
              onChange={(e) => setRuleText(e.target.value)}
              placeholder="Paste instructions, edge-case rules, or tone feedback for Claude..."
              className="input"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Good Example (Optional)</label>
              <input
                type="text"
                value={exampleGood}
                onChange={(e) => setExampleGood(e.target.value)}
                placeholder="Preferred output or decision..."
                className="input"
              />
            </div>
            <div>
              <label className="label">Avoid Example (Optional)</label>
              <input
                type="text"
                value={exampleBad}
                onChange={(e) => setExampleBad(e.target.value)}
                placeholder="What Claude should NOT do..."
                className="input"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-950 p-4 text-white">
            <Button onClick={() => void handleAddRule()} disabled={saving}>
              {saving ? "Saving Rule..." : "Save Training Rule"}
            </Button>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span className="h-2 w-2 rounded-full bg-brand" />
              <span>{activeCount} active rule(s) injected into Claude</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Trained Rules ({rules.length})
          </div>
          {loading ? (
            <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`flex flex-col justify-between gap-3 rounded-2xl border p-4 transition ${
                    rule.active
                      ? "border-slate-200 bg-white shadow-sm"
                      : "border-slate-200/60 bg-slate-50 opacity-60"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-display text-sm font-bold text-slate-900">
                        {rule.title}
                      </span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        {rule.taskId ?? "Global"}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600">{rule.ruleText}</p>
                    {rule.exampleGood && (
                      <div className="text-[11px] text-emerald-700">
                        <strong>Good:</strong> {rule.exampleGood}
                      </div>
                    )}
                    {rule.exampleBad && (
                      <div className="text-[11px] text-rose-700">
                        <strong>Avoid:</strong> {rule.exampleBad}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
                    <button
                      type="button"
                      onClick={() => void handleToggle(rule)}
                      className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                        rule.active
                          ? "bg-brand-50 text-slate-900"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {rule.active ? "Active" : "Paused"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(rule.id)}
                      className="text-xs font-medium text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
