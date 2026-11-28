"use client";

import { useState } from "react";
import { Button } from "./ui";

interface ClientEmailProps {
  propertyName?: string;
  propertyCity?: string;
  propertyState?: string;
  top10Count?: number;
  improvedCount?: number;
  onClose?: () => void;
}

export function ClientEmailDispatcher({
  propertyName,
  propertyCity,
  propertyState,
  top10Count,
  improvedCount,
  onClose,
}: ClientEmailProps) {
  const displayName = propertyName?.trim() || "the property";
  const location = [propertyCity, propertyState].filter(Boolean).join(", ");
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState(
    `[Monthly SEO & GEO Update] ${displayName} — Visibility & Rankings Highlights`
  );

  // The template only states what the caller actually supplied. It does not
  // invent rankings, search volumes or AI citation scores.
  const defaultBody = `Hi Team,

Here is the monthly search and AI visibility summary for ${displayName}${location ? ` (${location})` : ""}.

Metrics provided to this draft:
• Top-10 search positions: ${top10Count ?? "not provided"}
• Positive ranking movements: ${improvedCount ?? "not provided"}
• AI / GEO citation score: not measured — no AI engine or licensed visibility provider is connected

Before sending:
1. Confirm the reporting window and keyword set with the account team.
2. Attach the measured audit deck exported from Full Website Audit → Export.
3. Remove any line above that your rank tracker does not support.

Best regards,
SEO Team`;

  const [body, setBody] = useState(defaultBody);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<"success" | "info" | "error">("info");
  const [copied, setCopied] = useState(false);

  const handleDispatch = async (action: "draft" | "send") => {
    setBusy(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/client-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          to: recipient,
          subject,
          body,
          propertyName,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to process email dispatch.");
      }

      setStatusType("success");
      setStatusMessage(
        data.cliResult?.message ||
          (action === "draft"
            ? "Draft request completed. Use “Open in Gmail Web” to review and send."
            : "Send request completed.")
      );

      // If user wants to review draft immediately
      if (data.webComposeUrl && action === "draft") {
        setTimeout(() => {
          window.open(data.webComposeUrl, "_blank", "noopener,noreferrer");
        }, 1200);
      }
    } catch (err: unknown) {
      setStatusType("error");
      const msg = err instanceof Error ? err.message : "Could not dispatch via Gmail CLI.";
      setStatusMessage(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleOpenWebCompose = () => {
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      recipient
    )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCopyClipboard = () => {
    navigator.clipboard.writeText(`${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand-50 px-3 py-1 text-caption font-semibold text-slate-800 dark:bg-brand-950/40 dark:text-brand-light">
            Client Deliverable Dispatcher
          </div>
          <h2 className="mt-2 font-display text-xl font-bold text-slate-900 dark:text-white">
            Dispatch Monthly Performance Memo
          </h2>
          <p className="text-caption text-slate-500 dark:text-slate-400">
            Compose a client-ready memo from the metrics you supply. The template never fills in
            rankings or citation scores on its own; use the local Gmail bridge only when explicitly
            enabled.
          </p>
        </div>

        {onClose && (
          <Button variant="ghost" onClick={onClose} className="text-caption">
            Close
          </Button>
        )}
      </div>

      {statusMessage && (
        <div
          className={`rounded-2xl p-4 text-caption font-semibold ${
            statusType === "success"
              ? "border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
              : statusType === "error"
              ? "border border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
              : "border border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
          }`}
        >
          {statusMessage}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="label">Client Recipient Email</label>
          <input
            type="email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="e.g. generalmanager@hotel.com"
            className="input font-mono text-caption"
          />
        </div>

        <div>
          <label className="label">Subject Line</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="input text-caption font-semibold"
          />
        </div>

        <div>
          <label className="label">Email Body (Executive Briefing)</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="input resize-y font-sans text-caption leading-relaxed"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={handleCopyClipboard}
            className="text-caption"
          >
            {copied ? "Copied" : "Copy Email Text"}
          </Button>
          <Button
            variant="secondary"
            onClick={handleOpenWebCompose}
            disabled={!recipient.trim()}
            className="text-caption"
          >
            Open in Gmail Web
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            disabled={busy || !recipient.trim()}
            onClick={() => handleDispatch("draft")}
            className="text-caption"
          >
            {busy ? "Saving..." : "Save Draft in Gmail"}
          </Button>
          <Button
            variant="primary"
            disabled={busy || !recipient.trim()}
            onClick={() => handleDispatch("send")}
            className="text-caption"
          >
            {busy ? "Sending..." : "Send Email"}
          </Button>
        </div>
      </div>
    </div>
  );
}
