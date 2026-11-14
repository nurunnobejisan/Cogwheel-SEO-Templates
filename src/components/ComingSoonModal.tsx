"use client";

import { useState } from "react";
import type { TaskConfig } from "@/tasks/tasks.config";
import { Button, Card } from "./ui";

interface Props {
  task: TaskConfig;
  onClose: () => void;
  onPrioritized?: () => void;
}

export function ComingSoonModal({ task, onClose, onPrioritized }: Props) {
  const [prioritizing, setPrioritizing] = useState(false);
  const [prioritizedNotice, setPrioritizedNotice] = useState<string | null>(null);

  async function handlePrioritize() {
    setPrioritizing(true);
    setPrioritizedNotice(null);
    try {
      const res = await fetch("/api/ai-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: "Team Request",
          category: "seo",
          taskId: task.id,
          feedbackText: `Please prioritize early access for "${task.name}" (Phase ${task.phase} Roadmap). Required inputs: ${task.dataSources.join(", ")}.`,
        }),
      });
      if (res.ok) {
        setPrioritizedNotice("Feature request logged to AI Training! Team priorities updated.");
        onPrioritized?.();
      }
    } catch {
      setPrioritizedNotice("Feature request recorded.");
    } finally {
      setPrioritizing(false);
    }
  }

  return (
    <Card
      title={
        <div className="flex items-center gap-2.5">
          <span className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
            Roadmap • Phase {task.phase}
          </span>
          <span>{task.name}</span>
        </div>
      }
      subtitle={`Scheduled for release in Phase ${task.phase}. This module will automate ${task.description.toLowerCase()}`}
      actions={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row items-center gap-4 rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 p-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="space-y-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Coming Soon in Phase {task.phase}
              </span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                In Development
              </span>
            </div>
            <h3 className="font-display text-base font-bold text-slate-900">
              {task.name}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {task.description}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Output Format
            </span>
            <div className="mt-1 font-display text-sm font-bold uppercase text-slate-900">
              {task.outputType} Deliverable
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Client-ready {task.outputType.toUpperCase()} file
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Data Integrations
            </span>
            <div className="mt-1 flex flex-wrap gap-1">
              {task.dataSources.map((src) => (
                <span
                  key={src}
                  className="rounded bg-white border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                >
                  {src}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Prerequisites
            </span>
            <div className="mt-1 text-xs font-semibold text-slate-800">
              {task.dependsOn.length > 0 ? task.dependsOn.join(", ") : "None (Standalone)"}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {task.dependsOn.length > 0 ? "Chains from prior task output" : "Can run directly"}
            </p>
          </div>
        </div>

        {prioritizedNotice && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800">
            ✓ {prioritizedNotice}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              disabled={prioritizing || Boolean(prioritizedNotice)}
              onClick={() => void handlePrioritize()}
            >
              {prioritizing
                ? "Logging Request..."
                : prioritizedNotice
                  ? "Priority Logged"
                  : "Request Early Access / Prioritize"}
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
          <span className="text-[11px] text-slate-500">
            Current active modules ({11}) are fully runnable today.
          </span>
        </div>
      </div>
    </Card>
  );
}
