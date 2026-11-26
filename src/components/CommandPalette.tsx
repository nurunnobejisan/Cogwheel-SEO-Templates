"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import trainedPropertiesData from "@/data/trained-properties.json";
import { TASKS_CONFIG, type TaskConfig } from "@/tasks/tasks.config";

interface TrainedProperty {
  name: string;
  brand: string;
  city: string;
  state: string;
  url: string;
}

const TRAINED_PROPERTIES = trainedPropertiesData as TrainedProperty[];

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProperty: (property: TrainedProperty) => void;
  onNavigateTab: (tab: "home" | "tasks" | "labs" | "crawl" | "keywords") => void;
  onNavigateLabsSubTab?: (subTab: "geo" | "compset" | "sandbox" | "templates" | "matrix" | "architecture") => void;
  onOpenDeliverables?: (initialTab?: "deck" | "pptx" | "memo") => void;
  onOpenVisibilitySuite?: () => void;
  onOpenSitemapAudit?: () => void;
  onOpenAiTraining?: () => void;
  onRunAutoPilot?: () => void;
  onSelectTask?: (task: TaskConfig) => void;
  onToggleTheme?: () => void;
}

interface PaletteItem {
  id: string;
  title: string;
  subtitle: string;
  category: "Navigation" | "Trained Hotels" | "Tasks" | "Actions";
  badge?: string;
  action: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onSelectProperty,
  onNavigateTab,
  onNavigateLabsSubTab,
  onOpenDeliverables,
  onOpenVisibilitySuite,
  onOpenSitemapAudit,
  onOpenAiTraining,
  onRunAutoPilot,
  onSelectTask,
  onToggleTheme,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const items = useMemo<PaletteItem[]>(() => {
    const list: PaletteItem[] = [];

    // Actions
    list.push({
      id: "action-autopilot",
      title: "Auto-Run Full Pipeline",
      subtitle: "Execute all 11 On-Page, Technical & GEO modules in one click",
      category: "Actions",
      badge: "One-Click",
      action: () => {
        onClose();
        onRunAutoPilot?.();
      },
    });

    list.push({
      id: "action-pitch-deck",
      title: "Executive 2-Page Pitch Deck (PDF)",
      subtitle: "Generate branded white-label direct booking audit for hotel GMs",
      category: "Actions",
      badge: "Print PDF",
      action: () => {
        onClose();
        onOpenDeliverables?.("deck");
      },
    });

    list.push({
      id: "action-visibility-suite",
      title: "VisibilitySuite Batch Connector",
      subtitle: "Drop batch JSON file or sync prompts with VisibilitySuite.ai",
      category: "Actions",
      badge: "Sync",
      action: () => {
        onClose();
        onOpenVisibilitySuite?.();
      },
    });

    list.push({
      id: "action-sitemap",
      title: "Bulk XML Sitemap Audit",
      subtitle: "Discover and categorize all /sitemap.xml URLs across room types & dining",
      category: "Actions",
      badge: "Crawler",
      action: () => {
        onClose();
        onOpenSitemapAudit?.();
      },
    });

    list.push({
      id: "action-extension",
      title: "Download Chrome Extension (.zip)",
      subtitle: "Install the SEO Studio & GEO Inspector extension for real-time hotel page audits",
      category: "Actions",
      badge: "Extension",
      action: () => {
        onClose();
        const a = document.createElement("a");
        a.href = "/cogwheel-seo-studio.zip";
        a.download = "cogwheel-seo-studio.zip";
        a.click();
      },
    });

    list.push({
      id: "action-theme",
      title: "Toggle Light / Dark Mode",
      subtitle: "Switch dashboard color scheme",
      category: "Actions",
      action: () => {
        onClose();
        onToggleTheme?.();
      },
    });

    // Navigation
    list.push({
      id: "nav-home",
      title: "Go to Home Dashboard",
      subtitle: "Property direct-booking score, comp-set wins & task readiness overview",
      category: "Navigation",
      action: () => {
        onClose();
        onNavigateTab("home");
      },
    });

    list.push({
      id: "nav-keywords",
      title: "Go to Keyword Research Matrix",
      subtitle: "Grounded client deliverables, 3-step rationales & page-to-keyword mapping",
      category: "Navigation",
      badge: "Trained",
      action: () => {
        onClose();
        onNavigateTab("keywords");
      },
    });

    list.push({
      id: "nav-tasks",
      title: "Go to Tasks Suite",
      subtitle: "Access all 11 On-Page, Technical, Off-Page & Reporting modules",
      category: "Navigation",
      action: () => {
        onClose();
        onNavigateTab("tasks");
      },
    });

    list.push({
      id: "nav-labs-geo",
      title: "Labs: AI & GEO Readiness Radar",
      subtitle: "ChatGPT Search, Google AI Overviews & Perplexity citation breakdown",
      category: "Navigation",
      badge: "Labs",
      action: () => {
        onClose();
        onNavigateLabsSubTab?.("geo");
        onNavigateTab("labs");
      },
    });

    list.push({
      id: "nav-labs-compset",
      title: "Labs: Local Comp-Set Ranking Matrix",
      subtitle: "Benchmark against local competitor hotels across primary battlegrounds",
      category: "Navigation",
      badge: "Labs",
      action: () => {
        onClose();
        onNavigateLabsSubTab?.("compset");
        onNavigateTab("labs");
      },
    });

    list.push({
      id: "nav-labs-sandbox",
      title: "Labs: Diagnostic Sandbox (8 Tools)",
      subtitle: "SERP Pixel analyzer, Schema generator, Multi-CMS exporters & duplicate checker",
      category: "Navigation",
      badge: "Labs",
      action: () => {
        onClose();
        onNavigateLabsSubTab?.("sandbox");
        onNavigateTab("labs");
      },
    });

    list.push({
      id: "nav-labs-templates",
      title: "Labs: SEO Templates Library",
      subtitle: "Browse and apply structured SEO templates for any task",
      category: "Navigation",
      badge: "Labs",
      action: () => {
        onClose();
        onNavigateLabsSubTab?.("templates");
        onNavigateTab("labs");
      },
    });

    list.push({
      id: "nav-labs-matrix",
      title: "Labs: 78-Keyword Strategy Matrix",
      subtitle: "6-funnel keyword matrix for hospitality SEO & GEO dominance",
      category: "Navigation",
      badge: "Labs",
      action: () => {
        onClose();
        onNavigateLabsSubTab?.("matrix");
        onNavigateTab("labs");
      },
    });

    list.push({
      id: "nav-labs-architecture",
      title: "Labs: System Architecture",
      subtitle: "Manifest V3, AI training data vault, hybrid inference routing & Python pipelines",
      category: "Navigation",
      badge: "Labs",
      action: () => {
        onClose();
        onNavigateLabsSubTab?.("architecture");
        onNavigateTab("labs");
      },
    });

    list.push({
      id: "nav-train-ai",
      title: "Train AI Knowledge Base",
      subtitle: "Custom agency rules & brand voice guidelines for Hilton, Marriott & boutique hotels",
      category: "Navigation",
      badge: "Rules",
      action: () => {
        onClose();
        onOpenAiTraining?.();
      },
    });

    // Trained Properties
    for (const prop of TRAINED_PROPERTIES) {
      list.push({
        id: `prop-${prop.name.toLowerCase().replace(/\s+/g, "-")}`,
        title: prop.name,
        subtitle: `${prop.city}, ${prop.state} • ${prop.brand}`,
        category: "Trained Hotels",
        badge: prop.city,
        action: () => {
          onClose();
          onSelectProperty(prop);
        },
      });
    }

    // Tasks (11)
    for (const task of TASKS_CONFIG) {
      list.push({
        id: `task-${task.id}`,
        title: `Task: ${task.name}`,
        subtitle: `${task.section} Module • ${task.description}`,
        category: "Tasks",
        badge: task.section,
        action: () => {
          onClose();
          onSelectTask?.(task);
        },
      });
    }

    return list;
  }, [
    onClose,
    onNavigateTab,
    onNavigateLabsSubTab,
    onOpenDeliverables,
    onOpenVisibilitySuite,
    onOpenSitemapAudit,
    onOpenAiTraining,
    onRunAutoPilot,
    onSelectProperty,
    onSelectTask,
    onToggleTheme,
  ]);

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [items, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < filteredItems.length ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = filteredItems[selectedIndex];
      if (selected) {
        selected.action();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/60 p-4 pt-20 backdrop-blur-sm sm:pt-28"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
        onKeyDown={handleKeyDown}
      >
        {/* Search Header */}
        <div className="flex items-center border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <svg className="mr-3 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, search hotel, or jump to task..."
            className="w-full bg-transparent text-body text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
          />
          <kbd className="hidden rounded bg-slate-100 px-2 py-0.5 font-mono text-micro text-slate-500 dark:bg-slate-800 dark:text-slate-400 sm:inline-block">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-caption text-slate-400">
              No matching commands or hotels found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex cursor-pointer items-center justify-between rounded-xl px-3.5 py-2.5 transition ${
                    isSelected
                      ? "bg-purple-50 text-purple-950 dark:bg-purple-950/50 dark:text-purple-100"
                      : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-caption font-semibold">
                        {item.title}
                      </span>
                      {item.badge && (
                        <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-micro font-bold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-tiny text-slate-400 dark:text-slate-500">
                      {item.subtitle}
                    </div>
                  </div>
                  <span className="shrink-0 text-micro font-medium text-slate-400 dark:text-slate-500">
                    {item.category}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-micro text-slate-400 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center gap-2">
            <span>Use</span>
            <kbd className="rounded bg-slate-200 px-1 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">&uarr;</kbd>
            <kbd className="rounded bg-slate-200 px-1 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">&darr;</kbd>
            <span>to navigate</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="rounded bg-slate-200 px-1 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">ENTER</kbd>
            <span>to select</span>
          </div>
        </div>
      </div>
    </div>
  );
}
