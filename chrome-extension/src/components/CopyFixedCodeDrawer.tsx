import React, { useState } from "react";
import { Check, Copy, X, Code, CheckCircle2 } from "lucide-react";

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

  const lineCount = codeSnippet.split("\n").length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-3 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg rounded-xl border border-[#27272A] bg-[#111113] p-4 text-[#FAFAFA] shadow-2xl transition-all max-h-[85vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#27272A] pb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                <span>AUTO-FIX APPLIED</span>
              </span>
              <span className="text-[10px] font-medium uppercase text-[#71717A]">
                {issueCategory}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-[#FAFAFA]">
              {issueTitle}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[#71717A] hover:bg-[#18181B] hover:text-[#FAFAFA] transition"
            title="Close Drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Fix Description */}
        <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5 text-xs text-emerald-300">
          <p className="font-medium text-emerald-200">{description}</p>
          <p className="mt-1 text-[11px] text-[#A1A1AA]">
            Active page state and health gauges updated. Copy the snippet below to deploy to your CMS.
          </p>
        </div>

        {/* Code Snippet Box */}
        <div className="mt-3 flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between rounded-t-lg border-t border-x border-[#27272A] bg-[#18181B] px-3 py-1.5 text-[10px] font-mono text-[#A1A1AA]">
            <span className="flex items-center gap-1.5 uppercase font-semibold">
              <Code className="h-3.5 w-3.5 text-emerald-400" />
              {language === "json" ? "JSON-LD Schema" : "HTML Snippet"}
            </span>
            <span className="tabular-nums">{lineCount} lines</span>
          </div>
          <div className="overflow-y-auto rounded-b-lg border border-[#27272A] bg-[#09090B] p-3 font-mono text-[11px] leading-relaxed text-emerald-300 max-h-56 select-all">
            <pre className="whitespace-pre-wrap break-all">{codeSnippet}</pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-3.5 flex items-center justify-between border-t border-[#27272A] pt-3">
          <span className="text-[11px] text-[#71717A]">
            Directly paste into your theme or CMS head tag
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#27272A] bg-[#18181B] px-3 py-1.5 text-xs font-medium text-[#A1A1AA] hover:bg-[#27272A] hover:text-[#FAFAFA] transition"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition shadow-xs"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Copied Patch</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Patch</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
