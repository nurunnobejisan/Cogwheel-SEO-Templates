"use client";

import { useEffect, useState } from "react";
import type { DesignSettings, FeedbackCategory, TrainingChangeEntry } from "@/core/training-feedback";
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

const SEO_QUICK_PRESETS = [
  {
    taskId: "seo-only-visibility-report",
    label: "Vanity Site Rule",
    text: "Only include Slide 5 when the soft brand has a standalone vanity site; omit Slide 5 for brand-hosted properties.",
  },
  {
    taskId: "",
    label: "Strict Crawl Grounding",
    text: "Never invent amenities, dining venues, room counts, ratings, or addresses not verified in crawl data or property profile.",
  },
  {
    taskId: "title-meta",
    label: "Title <= 60 / Meta <= 155",
    text: "Keep all proposed SEO title tags <= 60 characters and meta descriptions <= 155 characters with direct-booking intent.",
  },
  {
    taskId: "usp-headline-optimization",
    label: "Direct-Booking USP Tone",
    text: "Lead with unique property differentiators (location, dining, suites) and encourage direct booking without hype.",
  },
];

const DESIGN_QUICK_PRESETS: Array<{
  label: string;
  text: string;
  patch: Partial<DesignSettings>;
}> = [
  { label: "Sky Blue Theme", text: "Switch app accent theme to sky blue", patch: { accentTheme: "sky" } },
  { label: "Emerald Theme", text: "Switch app accent theme to emerald green", patch: { accentTheme: "emerald" } },
  { label: "Default Lime Theme", text: "Switch app accent theme back to lime", patch: { accentTheme: "lime" } },
  { label: "Compact Layout", text: "Use compact spacing across the dashboard", patch: { density: "compact" } },
  { label: "Comfortable Layout", text: "Use comfortable spacing across the dashboard", patch: { density: "comfortable" } },
];

export function AiTrainingModal({
  onClose,
  onDesignChange,
}: {
  onClose: () => void;
  onDesignChange?: (settings: DesignSettings) => void;
}) {
  const [tab, setTab] = useState<"feedback" | "rules" | "history">("feedback");
  const [rules, setRules] = useState<TrainingRule[]>([]);
  const [history, setHistory] = useState<TrainingChangeEntry[]>([]);
  const [designSettings, setDesignSettings] = useState<DesignSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [authorName, setAuthorName] = useState("");
  const [category, setCategory] = useState<FeedbackCategory>("seo");
  const [taskId, setTaskId] = useState<string>("");
  const [feedbackText, setFeedbackText] = useState("");
  const [lastOutcome, setLastOutcome] = useState<{
    status: "applied" | "blocked";
    message: string;
    entry: TrainingChangeEntry;
  } | null>(null);

  async function loadAll() {
    try {
      const res = await fetch("/api/ai-training", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load training data");
      const json = (await res.json()) as {
        rules?: TrainingRule[];
        history?: TrainingChangeEntry[];
        designSettings?: DesignSettings;
      };
      setRules(json.rules ?? []);
      setHistory(json.history ?? []);
      if (json.designSettings) {
        setDesignSettings(json.designSettings);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load training data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  async function submitFeedback(overridePatch?: Partial<DesignSettings>, overrideText?: string) {
    const name = authorName.trim();
    const text = (overrideText ?? feedbackText).trim();
    if (!name) {
      setError("Please enter your name before submitting feedback.");
      return;
    }
    if (!text) {
      setError("Please describe what you want to change.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/ai-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: name,
          category,
          feedbackText: text,
          taskId: category === "seo" ? (taskId || undefined) : undefined,
          ...(overridePatch ? { designPatch: overridePatch } : {}),
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        status?: "applied" | "blocked";
        message?: string;
        entry?: TrainingChangeEntry;
        rules?: TrainingRule[];
        history?: TrainingChangeEntry[];
        designSettings?: DesignSettings;
      };
      if (!res.ok) throw new Error(json.error || "Failed to apply feedback");
      if (json.rules) setRules(json.rules);
      if (json.history) setHistory(json.history);
      if (json.designSettings) {
        setDesignSettings(json.designSettings);
        onDesignChange?.(json.designSettings);
      }
      if (json.entry && json.status) {
        setLastOutcome({
          status: json.status,
          message: json.message ?? json.entry.summary,
          entry: json.entry,
        });
      }
      if (json.status === "applied") {
        setFeedbackText("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to apply feedback");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevert(historyId: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revert", historyId }),
      });
      const json = (await res.json()) as {
        error?: string;
        rules?: TrainingRule[];
        history?: TrainingChangeEntry[];
        designSettings?: DesignSettings;
      };
      if (!res.ok) throw new Error(json.error || "Failed to revert change");
      if (json.rules) setRules(json.rules);
      if (json.history) setHistory(json.history);
      if (json.designSettings) {
        setDesignSettings(json.designSettings);
        onDesignChange?.(json.designSettings);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revert change");
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
            Train AI
          </span>
          <span>Feedback, Auto-Apply &amp; Change History</span>
        </div>
      }
      subtitle="Submit SEO feedback or safe Design/UI tweaks with your name. Approved changes apply automatically and appear in History."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant={tab === "history" ? "primary" : "secondary"}
            onClick={() => setTab("history")}
          >
            History ({history.length})
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setTab("feedback")}
              className={`rounded-lg px-3 py-1.5 transition ${
                tab === "feedback" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Submit Feedback
            </button>
            <button
              type="button"
              onClick={() => setTab("rules")}
              className={`rounded-lg px-3 py-1.5 transition ${
                tab === "rules" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Active Rules ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setTab("history")}
              className={`rounded-lg px-3 py-1.5 transition ${
                tab === "history" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Change History ({history.length})
            </button>
          </div>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800">
            Guardrail: SEO feedback &amp; safe Design/UI only
          </span>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-700">
            {error}
          </div>
        )}

        {tab === "feedback" && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Your Name *
                </label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="e.g. Razib or Michael"
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Change Type *
                </label>
                <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setCategory("seo")}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                      category === "seo" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    SEO Feedback
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategory("design")}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                      category === "design" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Design / UI
                  </button>
                </div>
              </div>

              {category === "seo" ? (
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Task Scope (Optional)
                  </label>
                  <select
                    value={taskId}
                    onChange={(e) => setTaskId(e.target.value)}
                    className="input text-xs"
                  >
                    <option value="">Auto-Detect / All Tasks</option>
                    {TASKS_CONFIG.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                  <div className="font-bold text-slate-800">Current Design</div>
                  <div>
                    Theme: <strong>{designSettings?.accentTheme ?? "lime"}</strong> · Density:{" "}
                    <strong>{designSettings?.density ?? "comfortable"}</strong>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                What do you want to change? *
              </label>
              <textarea
                rows={3}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder={
                  category === "seo"
                    ? "e.g. Always keep meta descriptions under 155 characters and mention direct-booking perks..."
                    : "e.g. Switch accent theme to sky blue, or make layout compact, or hide summary cards..."
                }
                className="input text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                1-Click Quick Feedback
              </div>
              <div className="flex flex-wrap gap-1.5">
                {category === "seo"
                  ? SEO_QUICK_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setTaskId(preset.taskId);
                          setFeedbackText(preset.text);
                        }}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-brand hover:bg-brand-50"
                      >
                        + {preset.label}
                      </button>
                    ))
                  : DESIGN_QUICK_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          setFeedbackText(preset.text);
                          if (authorName.trim()) {
                            void submitFeedback(preset.patch, preset.text);
                          }
                        }}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-brand hover:bg-brand-50"
                      >
                        {preset.label}
                      </button>
                    ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="primary" disabled={saving} onClick={() => void submitFeedback()}>
                {saving ? "Applying..." : "Apply Feedback Automatically"}
              </Button>
              <span className="text-[11px] text-slate-500">
                Every change is logged with your name and can be reverted in History.
              </span>
            </div>

            {lastOutcome && (
              <div
                className={`rounded-2xl border p-4 text-xs ${
                  lastOutcome.status === "applied"
                    ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
                    : "border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">
                    {lastOutcome.status === "applied" ? "Applied Automatically" : "Blocked by Guardrail"}
                  </span>
                  <span className="text-[11px] opacity-80">
                    By {lastOutcome.entry.authorName} · {new Date(lastOutcome.entry.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="mt-1 font-medium">{lastOutcome.message}</p>
                <div className="mt-2 rounded-xl border border-black/5 bg-white/80 px-3 py-2 text-[11px]">
                  <strong>What Changed:</strong> {lastOutcome.entry.summary}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "rules" && (
          <div className="space-y-2.5">
            {loading ? (
              <p className="text-xs text-slate-500">Loading rules...</p>
            ) : rules.length === 0 ? (
              <p className="text-xs text-slate-500">No training rules yet.</p>
            ) : (
              rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`flex flex-col justify-between gap-3 rounded-2xl border p-3.5 sm:flex-row sm:items-start ${
                    rule.active ? "border-slate-200 bg-white" : "border-slate-200/60 bg-slate-50 opacity-70"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{rule.title}</span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {rule.taskId ?? "All Tasks"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{rule.ruleText}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleToggle(rule)}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                        rule.active
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-500"
                      }`}
                    >
                      {rule.active ? "Active" : "Paused"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(rule.id)}
                      className="rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-2.5">
            {history.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center text-xs text-slate-500">
                No feedback changes recorded yet. Submit SEO feedback or a Design tweak to see who changed what here.
              </div>
            ) : (
              history.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 sm:flex-row sm:items-start"
                >
                  <div className="space-y-1 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900">{entry.authorName}</span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                          entry.category === "seo"
                            ? "bg-emerald-50 text-emerald-700"
                            : entry.category === "design"
                              ? "bg-sky-50 text-sky-700"
                              : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {entry.category === "seo" ? "SEO Rule" : entry.category === "design" ? "Design / UI" : "Blocked"}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                          entry.status === "applied"
                            ? "bg-slate-100 text-slate-700"
                            : entry.status === "reverted"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {entry.status}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(entry.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-slate-600">
                      <strong>Asked:</strong> {entry.requestText}
                    </p>
                    <p className="text-slate-800">
                      <strong>Changed:</strong> {entry.summary}
                    </p>
                  </div>
                  {entry.status === "applied" && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleRevert(entry.id)}
                      className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-amber-300 hover:bg-amber-50"
                    >
                      Revert
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
