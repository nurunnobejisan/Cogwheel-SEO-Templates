import React, { useState, useRef } from "react";
import {
  Upload,
  FileText,
  CheckCircle2,
  Sparkles,
  Layers,
  Image as ImageIcon,
  Heading,
  X,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { ExtensionSiteBundle, SiteBundlePage } from "../types/extension";

interface SiteBundleModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTabUrl?: string;
  activeTabId?: number;
  initialBundle?: ExtensionSiteBundle | null;
  onBundleLoaded?: (bundle: ExtensionSiteBundle) => void;
}

export function SiteBundleModal({
  isOpen,
  onClose,
  activeTabUrl,
  activeTabId,
  initialBundle,
  onBundleLoaded,
}: SiteBundleModalProps) {
  const [bundle, setBundle] = useState<ExtensionSiteBundle | null>(initialBundle || null);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [fillStatus, setFillStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isFilling, setIsFilling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Find matching page for current active tab URL
  const currentPath = activeTabUrl ? new URL(activeTabUrl).pathname : "/";
  const matchedIndex = bundle
    ? bundle.pages.findIndex(
        (p) =>
          p.url === activeTabUrl ||
          p.path === currentPath ||
          p.path.replace(/\/$/, "") === currentPath.replace(/\/$/, "")
      )
    : -1;

  const activeIndex = matchedIndex >= 0 ? matchedIndex : Math.max(0, selectedPageIndex);
  const currentPage: SiteBundlePage | undefined = bundle?.pages[activeIndex];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as ExtensionSiteBundle;
        setBundle(parsed);
        if (onBundleLoaded) onBundleLoaded(parsed);
      } catch (err) {
        alert("Invalid extension-bundle.json file: " + String(err));
      }
    };
    reader.readAsText(file);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleAutoFillCms = () => {
    if (!currentPage || !activeTabId) return;
    setIsFilling(true);
    setFillStatus(null);

    const payload = {
      title: currentPage.new_title,
      metaDesc: currentPage.new_meta_description,
      headings: currentPage.headings,
      images: currentPage.images,
    };

    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.sendMessage) {
      chrome.tabs.sendMessage(activeTabId, { type: "AUTO_FILL_CMS", payload }, (response) => {
        setIsFilling(false);
        if (chrome.runtime.lastError || !response?.result?.success) {
          setFillStatus({
            success: false,
            message: "Auto-fill failed or no matching CMS fields found in live DOM.",
          });
        } else {
          const fields = response.result.filledFields.join(", ");
          setFillStatus({
            success: true,
            message: `Successfully auto-filled ${response.result.detectedCms}: ${fields}`,
          });
        }
      });
    } else {
      setIsFilling(false);
      setFillStatus({
        success: true,
        message: "Simulation mode: Auto-filled Title, Meta Description, and Image ALTs.",
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-xs text-xs animate-in fade-in duration-150">
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl border border-[#27272A] bg-[#09090B] shadow-2xl text-[#FAFAFA]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#27272A] px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Full Site SEO Bundle Importer</h2>
              <p className="text-[10px] text-[#A1A1AA]">
                {bundle
                  ? `${bundle.brand_name} (${bundle.domain}) · ${bundle.summary.total_pages} Pages Mapped`
                  : "Import /output/<domain>/extension-bundle.json for 1-Click CMS Auto-Fill"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-[#3F3F46] bg-[#18181B] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#27272A] transition"
            >
              <Upload className="h-3 w-3 text-emerald-400" />
              <span>{bundle ? "Re-import Bundle" : "Select Bundle JSON"}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-[#A1A1AA] hover:bg-[#18181B] hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        {!bundle ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-white">No Site Bundle Imported</h3>
            <p className="mt-1 max-w-sm text-[11px] text-[#A1A1AA]">
              Run <code className="text-emerald-400 font-mono">python -m cogwheel_auto --url &lt;domain&gt;</code> to
              generate the complete agency deliverable package, then upload{" "}
              <code className="text-emerald-400 font-mono">extension-bundle.json</code> here.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload extension-bundle.json</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Page Selector Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[#27272A] bg-[#121214] px-3 py-1.5">
              {bundle.pages.map((p, idx) => {
                const isCurrent = idx === activeIndex;
                const isTabMatch =
                  p.url === activeTabUrl ||
                  p.path === currentPath ||
                  p.path.replace(/\/$/, "") === currentPath.replace(/\/$/, "");
                return (
                  <button
                    key={p.page_id || idx}
                    type="button"
                    onClick={() => setSelectedPageIndex(idx)}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] whitespace-nowrap transition ${
                      isCurrent
                        ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold"
                        : "text-[#A1A1AA] hover:bg-[#18181B] hover:text-white"
                    }`}
                  >
                    <span>{p.path}</span>
                    {isTabMatch && (
                      <span className="rounded-full bg-emerald-400/20 px-1 text-[9px] text-emerald-400">
                        Active Tab
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected Page Optimization Viewer */}
            {currentPage && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Status / Matching Alert */}
                <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-emerald-400 text-xs">
                        Page Target: {currentPage.primary_keyword}
                      </span>
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] uppercase font-mono text-emerald-300">
                        {currentPage.archetype}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#A1A1AA] mt-0.5 truncate max-w-md">{currentPage.url}</p>
                  </div>
                  <button
                    type="button"
                    disabled={isFilling}
                    onClick={handleAutoFillCms}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition shadow-md disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{isFilling ? "Filling CMS..." : "Auto-Fill Live CMS (1-Click)"}</span>
                  </button>
                </div>

                {/* Fill Status Toast */}
                {fillStatus && (
                  <div
                    className={`flex items-center gap-2 rounded-xl p-2.5 text-[11px] ${
                      fillStatus.success
                        ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border border-rose-500/30 bg-rose-500/10 text-rose-300"
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{fillStatus.message}</span>
                  </div>
                )}

                {/* 1. Proposed SEO Title */}
                <div className="rounded-xl border border-[#27272A] bg-[#121214] p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                      Proposed SEO Title (Hard Cap &le; 60 chars)
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono text-[10px] font-bold ${
                          currentPage.title_length <= 60 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {currentPage.title_length} chars
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(currentPage.new_title, "title")}
                        className="text-[#71717A] hover:text-white"
                      >
                        {copiedKey === "title" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#18181B] border border-[#27272A] p-2 text-xs text-emerald-300 font-medium">
                    {currentPage.new_title}
                  </div>
                  {currentPage.old_title && (
                    <div className="text-[10px] text-[#71717A] truncate">
                      Old: <span className="line-through">{currentPage.old_title}</span>
                    </div>
                  )}
                </div>

                {/* 2. Proposed Meta Description */}
                <div className="rounded-xl border border-[#27272A] bg-[#121214] p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                      Proposed Meta Description (145–160 chars target)
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono text-[10px] font-bold ${
                          currentPage.meta_length <= 160 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {currentPage.meta_length} chars
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(currentPage.new_meta_description, "meta")}
                        className="text-[#71717A] hover:text-white"
                      >
                        {copiedKey === "meta" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#18181B] border border-[#27272A] p-2 text-xs text-emerald-300 font-medium leading-relaxed">
                    {currentPage.new_meta_description}
                  </div>
                </div>

                {/* 3. Heading Structure (H1, H2s, H3s) */}
                {currentPage.headings && currentPage.headings.length > 0 && (
                  <div className="rounded-xl border border-[#27272A] bg-[#121214] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Heading className="h-3.5 w-3.5 text-sky-400" />
                        <span className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                          Heading Outline ({currentPage.headings.length} Items)
                        </span>
                      </div>
                      <span className="text-[10px] text-[#A1A1AA]">
                        Health Score: <strong className="text-emerald-400">{currentPage.heading_health_score}/100</strong>
                      </span>
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                      {currentPage.headings.map((h, hIdx) => (
                        <div
                          key={hIdx}
                          className="flex items-center justify-between rounded-md bg-[#18181B] px-2 py-1 text-[11px]"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className={`rounded px-1 text-[9px] font-bold font-mono ${
                                h.new_level === "H1"
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : h.new_level === "TEXT"
                                  ? "bg-rose-500/20 text-rose-400"
                                  : "bg-sky-500/20 text-sky-400"
                              }`}
                            >
                              {h.new_level}
                            </span>
                            <span className="text-white truncate">{h.new_headline}</span>
                          </div>
                          {h.old_level !== h.new_level && (
                            <span className="text-[9px] text-amber-400 font-mono">
                              {h.old_level} &rarr; {h.new_level}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Images & Optimized ALT Texts */}
                {currentPage.images && currentPage.images.length > 0 && (
                  <div className="rounded-xl border border-[#27272A] bg-[#121214] p-3 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5 text-amber-400" />
                      <span className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                        Page Images &amp; Optimized ALT Texts ({currentPage.images.length} Assets)
                      </span>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {currentPage.images.map((img, iIdx) => (
                        <div
                          key={iIdx}
                          className="rounded-lg bg-[#18181B] border border-[#27272A] p-2 space-y-1"
                        >
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-semibold text-white truncate max-w-xs">{img.title}</span>
                            <span className="font-mono text-emerald-400">{img.length} chars</span>
                          </div>
                          <div className="text-[11px] text-emerald-300 font-medium">
                            {img.optimized_alt}
                          </div>
                          {img.old_alt && (
                            <div className="text-[9px] text-[#71717A] truncate">
                              Old ALT: <span className="line-through">{img.old_alt}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
