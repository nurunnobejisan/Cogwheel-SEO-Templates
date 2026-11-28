"use client";

import { useState, type ReactNode } from "react";
import { Button, Spinner } from "@/components/ui/index";
import { PanelCard as Card } from "@/components/data/index";
import type { TrainingCaptureResponse } from "@/lib/training-capture";

interface Props {
  title: string;
  subtitle?: string;
  /** Small read-only counts shown above the capture controls. */
  stats: Array<{ label: string; value: string | number }>;
  /** Extra explanatory copy between the stats and the consent controls. */
  note?: ReactNode;
  /** When set, the capture is blocked and this message is shown. */
  disabledReason?: string | null;
  /** Disable the button for reasons other than `disabledReason` (e.g. nothing to send). */
  disabled?: boolean;
  /** Performs the capture; consent + ToS are enforced here before it runs. */
  onCapture: () => Promise<TrainingCaptureResponse>;
}

/**
 * Shared expert-in-the-loop capture panel.
 *
 * Nothing is ever captured automatically: the operator must tick the rights
 * consent and the robots/ToS acknowledgement, then press the button. The
 * caller supplies the payload builder via `onCapture`.
 */
export function TrainingCaptureCard({ title, subtitle, stats, note, disabledReason, disabled, onCapture }: Props) {
  const [consent, setConsent] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrainingCaptureResponse | null>(null);

  async function handleCapture() {
    if (!consent) {
      setError("Confirm you have the rights to contribute this data.");
      return;
    }
    if (!tosAccepted) {
      setError("Accept the robots/ToS acknowledgement to capture.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await onCapture());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={title} subtitle={subtitle}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-caption text-slate-600">
          {stats.map((stat) => (
            <span key={stat.label}>
              {stat.label}: <strong className="tabular-nums text-slate-800">{stat.value}</strong>
            </span>
          ))}
        </div>

        {note ? <div className="text-caption text-slate-500">{note}</div> : null}

        {disabledReason ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-body text-amber-800">{disabledReason}</div>
        ) : null}

        <label className="flex items-start gap-2 text-body text-slate-700">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-emerald-600"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            I have the rights to contribute this data and consent to it training/improving the SEO Studio models. PII is
            stripped before storage.
          </span>
        </label>

        <label className="flex items-start gap-2 text-body text-slate-700">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-emerald-600"
            checked={tosAccepted}
            onChange={(e) => setTosAccepted(e.target.checked)}
          />
          <span>I accept that capture is gated by the site&apos;s robots.txt / terms of service.</span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleCapture} disabled={busy || disabled || Boolean(disabledReason)}>
            {busy ? <Spinner /> : null}
            Save reviewed data to training set
          </Button>
          {error && <span className="text-body text-red-600">{error}</span>}
          {result && (
            <span className="text-body text-emerald-700">
              Captured <code className="font-mono">{result.id.slice(0, 8)}</code> · tier {result.quality}
              {result.persistenceNote ? ` — ${result.persistenceNote}` : ""}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
