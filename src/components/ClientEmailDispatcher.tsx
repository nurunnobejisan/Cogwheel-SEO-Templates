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
  propertyName = "Renaissance Shoals Resort & Spa",
  propertyCity = "Florence",
  propertyState = "AL",
  top10Count = 18,
  improvedCount = 4,
  onClose,
}: ClientEmailProps) {
  const [recipient, setRecipient] = useState("gm@renaissanceshoals.com");
  const [subject, setSubject] = useState(
    `[Monthly SEO & GEO Update] ${propertyName} — Visibility & Rankings Highlights`
  );

  const defaultBody = `Hi Team,

Here is your executive search and AI visibility summary for ${propertyName} (${propertyCity}, ${propertyState}) for this month:

🚀 Key Highlights & Ranking Wins:
• Total Top 10 Search Positions: ${top10Count} keywords
• Positive Ranking Momentum: +${improvedCount} core terms improved
• #1 Ranking: "florence alabama resort" (880 monthly search volume)
• #2 Ranking: "hotels in florence al" (1,600 monthly search volume)
• Generative AI Citation Score: 78/100 (Indexed in ChatGPT Search & Google AI Overviews)

🔍 Priority Technical Actions for Next Cycle:
1. Add DaySpa schema to capture AI voice and conversational search bookings.
2. Publish Pet Policy FAQ block to resolve unverified OTA fees in Google AI Overviews.
3. Optimize wedding and corporate conference landing pages for seasonal inquiry surges.

The complete PowerPoint Monthly Visibility Deck and 1-Page Executive Memo are attached.

Please let me know if you would like to review this on our monthly strategy call.

Best regards,
Razib Marketing — Cogwheel SEO Team
Connected via: riboynjsr@gmail.com`;

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
            ? "Draft successfully saved in your riboynjsr@gmail.com account!"
            : "Email dispatched successfully!")
      );

      // If user wants to review draft immediately
      if (data.webComposeUrl && action === "draft") {
        setTimeout(() => {
          window.open(data.webComposeUrl, "_blank", "noopener,noreferrer");
        }, 1200);
      }
    } catch (err: any) {
      setStatusType("error");
      setStatusMessage(err.message || "Could not dispatch via Gmail CLI.");
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
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand-50 px-3 py-1 text-xs font-semibold text-slate-800 dark:bg-brand-950/40 dark:text-brand-light">
            ✉️ 1-Click Client Dispatcher
          </div>
          <h2 className="mt-2 font-display text-xl font-bold text-slate-900 dark:text-white">
            Dispatch Monthly Performance Memo
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Send an executive summary to hotel leadership via your connected Gmail (
            <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">
              riboynjsr@gmail.com
            </span>
            ).
          </p>
        </div>

        {onClose && (
          <Button variant="ghost" onClick={onClose} className="text-xs">
            Close
          </Button>
        )}
      </div>

      {statusMessage && (
        <div
          className={`rounded-2xl p-4 text-xs font-semibold ${
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
            className="input font-mono text-xs"
          />
        </div>

        <div>
          <label className="label">Subject Line</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="input text-xs font-semibold"
          />
        </div>

        <div>
          <label className="label">Email Body (Executive Briefing)</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="input resize-y font-sans text-xs leading-relaxed"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={handleCopyClipboard}
            className="text-xs"
          >
            {copied ? "✓ Copied to Clipboard" : "📋 Copy Email Text"}
          </Button>
          <Button
            variant="secondary"
            onClick={handleOpenWebCompose}
            className="text-xs"
          >
            ↗ Open in Gmail Web
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => handleDispatch("draft")}
            className="text-xs"
          >
            {busy ? "Saving..." : "📝 Save Draft in Gmail"}
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => handleDispatch("send")}
            className="text-xs"
          >
            {busy ? "Sending..." : "🚀 Send Email via riboynjsr@gmail.com"}
          </Button>
        </div>
      </div>
    </div>
  );
}
