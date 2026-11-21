import React, { useState } from "react";
import { Check, Copy, X, Code, CheckCircle } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  issueTitle: string;
  issueCategory: string;
  description: string;
  codeSnippet: string;
  language: "html" | "json";
}

export function CopyFixedCodeDrawer({
  isOpen,
  onClose,
  issueTitle,
  issueCategory,
  description,
  codeSnippet,
  language,
}: Props) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = codeSnippet;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 p-3 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900 animate-in slide-in-from-bottom-4 duration-250 max-h-[85vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                AUTO-FIX APPLIED
              </span>
              <span className="text-[10px] font-bold uppercase text-slate-400">
                {issueCategory}
              </span>
            </div>
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              {issueTitle}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            title="Close Drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Fix Description */}
        <div className="mt-3 rounded-xl border border-emerald-200/60 bg-emerald-50/50 p-2.5 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200">
          <p className="font-medium">{description}</p>
          <p className="mt-1 text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
            Active state and radial scores updated. Copy the code snippet below to deploy this fix to your website or CMS.
          </p>
        </div>

        {/* Code Snippet Box */}
        <div className="mt-3 flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between rounded-t-xl bg-slate-900 px-3 py-1.5 text-[10px] font-bold text-slate-400">
            <span className="flex items-center gap-1.5 uppercase">
              <Code className="h-3 w-3 text-emerald-400" />
              {language === "json" ? "JSON-LD Script" : "HTML Snippet"}
            </span>
            <span>{codeSnippet.split("\n").length} lines</span>
          </div>
          <div className="overflow-y-auto rounded-b-xl border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-emerald-400 max-h-56 select-all">
            <pre className="whitespace-pre-wrap break-all">{codeSnippet}</pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Dismiss
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-bold text-white shadow-sm transition active:scale-95 ${
              copied
                ? "bg-emerald-700 dark:bg-emerald-600"
                : "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
            }`}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Fixed Code</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
