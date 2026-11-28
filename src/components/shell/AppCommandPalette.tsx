"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, ListChecks, Moon, Play, Sun } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/index";
import { TASKS_CONFIG } from "@/tasks/tasks.config";
import { useWorkspace, type ActiveProperty } from "./WorkspaceContext";

const ROUTE_SHORTCUTS: Array<{ label: string; subtitle: string; href: string }> = [
  { label: "Dashboard", subtitle: "Property health, issues, and recent runs", href: "/" },
  { label: "Audit Overview", subtitle: "11-dimension website audit metrics", href: "/audit" },
  { label: "Issue Report", subtitle: "Filterable SEO & GEO issue breakdown", href: "/audit/issues" },
  { label: "Crawled Pages", subtitle: "Status codes, titles, H1, and word counts", href: "/audit/pages" },
  { label: "Headings Audit", subtitle: "H1–H6 outline hierarchy diagnostics", href: "/audit/headings" },
  { label: "Images Audit", subtitle: "Alt text, dimensions, and oversized files", href: "/audit/images" },
  { label: "XML Sitemap Audit", subtitle: "URL discovery and indexability coverage", href: "/audit/sitemap" },
  { label: "Search Console", subtitle: "GSC performance and cannibalization", href: "/search-console" },
  { label: "Keyword Research", subtitle: "Demand grounding and page assignments", href: "/keywords" },
  { label: "Keyword Matrix", subtitle: "4-step pool allocation and inline matrix", href: "/keywords/matrix" },
  { label: "Content Studio", subtitle: "On-page copy editor and brand validator", href: "/content" },
  { label: "AI & GEO Radar", subtitle: "Schema, entities, and AI search readiness", href: "/geo" },
  { label: "AI Visibility Connector", subtitle: "Import and inspect visibility runs", href: "/geo/visibility" },
  { label: "Local Comp-Set Matrix", subtitle: "Benchmark rankings against local competitors", href: "/geo/compset" },
  { label: "Tasks Suite", subtitle: "All On-Page, Technical, Local & Reporting tasks", href: "/tasks" },
  { label: "Reports & Deliverables", subtitle: "Pitch Deck, Visibility PPTX, Memo, Email", href: "/reports" },
  { label: "Run History", subtitle: "Audit logs and downloadable outputs", href: "/reports/history" },
  { label: "AI Training Rules", subtitle: "Custom guidelines and guardrail rules", href: "/settings/ai-training" },
  { label: "Property Profile", subtitle: "Edit active property metadata", href: "/settings/property" },
  { label: "Chrome Extension Guide", subtitle: "Install the live page inspector extension", href: "/extension" },
  { label: "Templates Catalog", subtitle: "Public SEO & GEO template blueprints", href: "/templates" },
  { label: "Strategy Matrix", subtitle: "78-keyword vertical strategy matrix", href: "/strategy-matrix" },
  { label: "System Architecture", subtitle: "Technical multi-tier pipeline specs", href: "/architecture" },
];

export function AppCommandPalette() {
  const router = useRouter();
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    setAutoPilotOpen,
    isDark,
    toggleTheme,
    selectProperty,
  } = useWorkspace();

  const [query, setQuery] = React.useState("");
  const [propertyHits, setPropertyHits] = React.useState<ActiveProperty[]>([]);

  React.useEffect(() => {
    if (!commandPaletteOpen) {
      setQuery("");
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/properties/search?q=${encodeURIComponent(query.trim())}&limit=8`);
        if (!res.ok) return;
        const json = (await res.json()) as { matches?: ActiveProperty[] };
        if (!cancelled && json.matches) {
          setPropertyHits(json.matches);
        }
      } catch {
        // ignore search errors
      }
    }, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [commandPaletteOpen, query]);

  const navigate = (href: string) => {
    setCommandPaletteOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <CommandInput
        placeholder="Jump to route, run an action, or search properties..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No matching routes, tasks, or properties.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => {
              setCommandPaletteOpen(false);
              setAutoPilotOpen(true);
            }}
          >
            <span className="inline-flex items-center gap-2">
              <Play className="h-4 w-4 text-brand" aria-hidden="true" />
              <span>Run full audit pipeline</span>
            </span>
            <CommandShortcut>Pipeline</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setCommandPaletteOpen(false);
              toggleTheme();
            }}
          >
            <span className="inline-flex items-center gap-2">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span>Switch to {isDark ? "light" : "dark"} mode</span>
            </span>
            <CommandShortcut>Theme</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Routes">
          {ROUTE_SHORTCUTS.map((route) => (
            <CommandItem key={route.href} value={`${route.label} ${route.subtitle}`} onSelect={() => navigate(route.href)}>
              <div className="min-w-0">
                <p className="truncate font-medium text-text">{route.label}</p>
                <p className="truncate text-caption text-text-muted">{route.subtitle}</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-text-subtle" aria-hidden="true" />
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Tasks">
          {TASKS_CONFIG.map((task) => (
            <CommandItem
              key={task.id}
              value={`task ${task.name} ${task.section}`}
              onSelect={() => navigate(`/tasks?section=${encodeURIComponent(task.section)}`)}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <ListChecks className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
                <span className="truncate">{task.name}</span>
              </span>
              <CommandShortcut>{task.section}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        {propertyHits.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Properties">
              {propertyHits.map((prop) => (
                <CommandItem
                  key={`cmd-prop-${prop.name}-${prop.url}`}
                  value={`property ${prop.name} ${prop.city} ${prop.brand}`}
                  onSelect={() => {
                    selectProperty(prop);
                    setCommandPaletteOpen(false);
                  }}
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <Building2 className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                    <span className="truncate">{prop.name}</span>
                  </span>
                  <CommandShortcut>{[prop.city, prop.state].filter(Boolean).join(", ")}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
