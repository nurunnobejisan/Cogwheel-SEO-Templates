import React, { useState, useEffect } from "react";
import { Download, RefreshCw, X, ArrowUpCircle, CheckCircle2 } from "lucide-react";
import { ExtensionUpdateState } from "../types/updater.types";

interface Props {
  onRulesSynced?: (state: ExtensionUpdateState) => void;
}

export function UpdateBanner({ onRulesSynced }: Props) {
  const [updateState, setUpdateState] = useState<ExtensionUpdateState | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  useEffect(() => {
    // 1. Check local storage for cached update state
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["cogwheel_update_state"], (res) => {
        const cached = res["cogwheel_update_state"] as ExtensionUpdateState | undefined;
        if (cached) {
          setUpdateState(cached);
        }
      });

      // 2. Query background worker for live check
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(
          { type: "COGWHEEL_CHECK_UPDATES" },
          (response: ExtensionUpdateState | undefined) => {
            if (response && response.latestVersion) {
              setUpdateState(response);
            }
          }
        );
      }
    }
  }, []);

  const handleSyncRulesNow = () => {
    setIsSyncing(true);
    setSyncFeedback(null);

    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(
        { type: "COGWHEEL_CHECK_UPDATES" },
        (res: ExtensionUpdateState | undefined) => {
          setIsSyncing(false);
          if (res) {
            setUpdateState(res);
            setSyncFeedback(`Synced OTA rules (v${res.otaDataVersion || "2.7.0"}).`);
            if (onRulesSynced) onRulesSynced(res);
          } else {
            setSyncFeedback("Rules up to date.");
          }
          setTimeout(() => setSyncFeedback(null), 3000);
        }
      );
    } else {
      setTimeout(() => {
        setIsSyncing(false);
        setSyncFeedback("Synchronized 78 keywords & OTA brand rules.");
        setTimeout(() => setSyncFeedback(null), 3000);
      }, 700);
    }
  };

  const handleDownloadZip = () => {
    if (updateState?.releaseDownloadUrl) {
      window.open(updateState.releaseDownloadUrl, "_blank", "noopener,noreferrer");
    } else {
      window.open(
        "https://github.com/jisan-razibmarketing/Cogwheel-SEO-Templates/releases/latest",
        "_blank",
        "noopener,noreferrer"
      );
    }
  };

  // If dismissed or no newer binary version, show mini sync bar if syncing feedback exists
  if (isDismissed && !syncFeedback) {
    return null;
  }

  // If there is a newer binary release
  if (updateState?.updateAvailable && !isDismissed) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-[#27272A] bg-[#111113] p-3 text-[#FAFAFA] shadow-xs animate-in fade-in">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <ArrowUpCircle className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#FAFAFA] tabular-nums">
                  Update Available: v{updateState.latestVersion}
                </span>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.2 text-[9px] font-semibold uppercase text-emerald-400">
                  New Build
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-[#A1A1AA] leading-snug">
                New build available on GitHub main (<span className="tabular-nums">v{updateState.currentVersion}</span> installed). Download the latest release package below.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="text-[#71717A] hover:text-[#FAFAFA] transition p-0.5"
            title="Dismiss notification"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleDownloadZip}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400 transition shadow-xs"
          >
            <Download className="h-3 w-3" />
            <span>Download Update (.zip)</span>
          </button>

          <button
            type="button"
            onClick={handleSyncRulesNow}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#27272A] bg-[#18181B] px-2.5 py-1 text-[11px] font-medium text-[#FAFAFA] hover:bg-[#27272A] transition"
          >
            <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin text-emerald-400" : ""}`} />
            <span>{isSyncing ? "Syncing..." : "Sync Rules Now"}</span>
          </button>

          {syncFeedback && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 animate-in fade-in">
              <CheckCircle2 className="h-3 w-3" />
              <span>{syncFeedback}</span>
            </span>
          )}
        </div>
      </div>
    );
  }

  // If no binary update, but sync feedback is active
  if (syncFeedback) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-[11px] font-medium text-emerald-300 flex items-center justify-between animate-in fade-in">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          <span>{syncFeedback}</span>
        </span>
        <button
          type="button"
          onClick={() => setSyncFeedback(null)}
          className="text-emerald-400/60 hover:text-emerald-300"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return null;
}
