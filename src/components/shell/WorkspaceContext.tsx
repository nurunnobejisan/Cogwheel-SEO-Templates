"use client";

import * as React from "react";
import type { FullWebsiteAuditReport } from "@/core/full-audit/types";
import type { TaskStatus } from "@/tasks/tasks.config";

export interface ActiveProperty {
  name: string;
  brand: string;
  city: string;
  state: string;
  url: string;
}

export interface TaskRunSummary {
  id: string;
  taskId: string;
  status: TaskStatus;
  outputUrl: string | null;
  flags: Array<{ code: string; message: string; severity: string }>;
  createdAt: string;
}

export interface AiEngineStatus {
  provider: string;
  activeRules: number;
  providerIsFreeOnline: boolean;
  loaded: boolean;
}

export interface AuditHistoryEntry {
  date: string;
  score: number;
  issues: number;
}

interface WorkspaceContextValue {
  activeProperty: ActiveProperty;
  recentProperties: ActiveProperty[];
  selectProperty: (prop: ActiveProperty) => void;
  updateProperty: (patch: Partial<ActiveProperty>) => void;
  clearProperty: () => void;
  autofillPropertyByUrl: (url: string) => Promise<ActiveProperty>;
  isDark: boolean;
  toggleTheme: () => void;
  autoPilotOpen: boolean;
  setAutoPilotOpen: (open: boolean) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  latestRuns: Record<string, TaskRunSummary>;
  runsLoaded: boolean;
  aiStatus: AiEngineStatus;
  refreshRuns: () => Promise<void>;
  auditReport: FullWebsiteAuditReport | null;
  previousAuditReport: FullWebsiteAuditReport | null;
  auditHistory: AuditHistoryEntry[];
  auditLoading: boolean;
  auditError: string | null;
  runFullWebsiteAudit: (urlOverride?: string) => Promise<FullWebsiteAuditReport | null>;
}

const ACTIVE_PROPERTY_KEY = "seo_studio_active_property_v1";
const RECENT_PROPERTIES_KEY = "seo_studio_recent_properties_v1";
const AUDIT_REPORT_KEY = "seo_studio_last_audit_v1";
const AUDIT_HISTORY_KEY = "seo_studio_audit_history_v1";
const THEME_KEY = "seo_studio_theme";

const EMPTY_PROPERTY: ActiveProperty = {
  name: "",
  brand: "",
  city: "",
  state: "",
  url: "",
};

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [activeProperty, setActiveProperty] = React.useState<ActiveProperty>(EMPTY_PROPERTY);
  const [recentProperties, setRecentProperties] = React.useState<ActiveProperty[]>([]);
  const [isDark, setIsDark] = React.useState(false);
  const [autoPilotOpen, setAutoPilotOpen] = React.useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
  const [latestRuns, setLatestRuns] = React.useState<Record<string, TaskRunSummary>>({});
  const [runsLoaded, setRunsLoaded] = React.useState(false);
  const [aiStatus, setAiStatus] = React.useState<AiEngineStatus>({
    provider: "",
    activeRules: 0,
    providerIsFreeOnline: false,
    loaded: false,
  });

  const [auditReport, setAuditReport] = React.useState<FullWebsiteAuditReport | null>(null);
  const [previousAuditReport, setPreviousAuditReport] = React.useState<FullWebsiteAuditReport | null>(null);
  const [auditHistory, setAuditHistory] = React.useState<AuditHistoryEntry[]>([]);
  const [auditLoading, setAuditLoading] = React.useState(false);
  const [auditError, setAuditError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    try {
      const savedProp = window.localStorage.getItem(ACTIVE_PROPERTY_KEY);
      if (savedProp) {
        const parsed = JSON.parse(savedProp) as Partial<ActiveProperty>;
        setActiveProperty({ ...EMPTY_PROPERTY, ...parsed });
      }
      const savedRecent = window.localStorage.getItem(RECENT_PROPERTIES_KEY);
      if (savedRecent) {
        const parsedRecent = JSON.parse(savedRecent) as ActiveProperty[];
        if (Array.isArray(parsedRecent)) {
          setRecentProperties(parsedRecent.slice(0, 5));
        }
      }
      const savedAudit = window.sessionStorage.getItem(AUDIT_REPORT_KEY);
      if (savedAudit) {
        setAuditReport(JSON.parse(savedAudit) as FullWebsiteAuditReport);
      }
      const savedHist = window.localStorage.getItem(AUDIT_HISTORY_KEY);
      if (savedHist) {
        const parsedHist = JSON.parse(savedHist) as AuditHistoryEntry[];
        if (Array.isArray(parsedHist)) {
          setAuditHistory(parsedHist.slice(-10));
        }
      }
    } catch {
      // ignore invalid storage
    }
  }, []);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const persistProperty = React.useCallback((prop: ActiveProperty) => {
    try {
      window.localStorage.setItem(ACTIVE_PROPERTY_KEY, JSON.stringify(prop));
    } catch {
      // ignore storage errors
    }
  }, []);

  const pushRecent = React.useCallback((prop: ActiveProperty) => {
    if (!prop.name && !prop.url) return;
    setRecentProperties((prev) => {
      const deduped = [prop, ...prev.filter((item) => item.name !== prop.name || item.url !== prop.url)].slice(0, 5);
      try {
        window.localStorage.setItem(RECENT_PROPERTIES_KEY, JSON.stringify(deduped));
      } catch {
        // ignore storage errors
      }
      return deduped;
    });
  }, []);

  const selectProperty = React.useCallback(
    (prop: ActiveProperty) => {
      const normalized: ActiveProperty = { ...EMPTY_PROPERTY, ...prop };
      setActiveProperty(normalized);
      persistProperty(normalized);
      pushRecent(normalized);
    },
    [persistProperty, pushRecent]
  );

  const updateProperty = React.useCallback(
    (patch: Partial<ActiveProperty>) => {
      setActiveProperty((prev) => {
        const next = { ...prev, ...patch };
        persistProperty(next);
        return next;
      });
    },
    [persistProperty]
  );

  const clearProperty = React.useCallback(() => {
    setActiveProperty(EMPTY_PROPERTY);
    try {
      window.localStorage.removeItem(ACTIVE_PROPERTY_KEY);
    } catch {
      // ignore storage errors
    }
  }, []);

  const autofillPropertyByUrl = React.useCallback(
    async (rawUrl: string) => {
      const res = await fetch("/api/property-autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: rawUrl.trim() }),
      });
      const json = (await res.json()) as { error?: string; property?: ActiveProperty };
      if (!res.ok || !json.property) {
        throw new Error(json.error || "Could not auto-detect property from URL.");
      }
      selectProperty(json.property);
      return json.property;
    },
    [selectProperty]
  );

  const toggleTheme = React.useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      try {
        window.localStorage.setItem(THEME_KEY, next ? "dark" : "light");
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const refreshRuns = React.useCallback(async () => {
    try {
      const [summaryRes, trainingRes] = await Promise.all([
        fetch("/api/tasks/summary", { cache: "no-store" }),
        fetch("/api/ai-training", { cache: "no-store" }),
      ]);
      if (summaryRes.ok) {
        const data = (await summaryRes.json()) as { runs?: Record<string, TaskRunSummary> };
        if (data.runs) setLatestRuns(data.runs);
      }
      if (trainingRes.ok) {
        const tData = (await trainingRes.json()) as {
          provider?: string;
          providerIsFreeOnline?: boolean;
          rules?: Array<{ active: boolean }>;
        };
        setAiStatus({
          provider: tData.provider || "Provider not configured",
          activeRules: (tData.rules ?? []).filter((r) => r.active).length,
          providerIsFreeOnline: tData.providerIsFreeOnline === true,
          loaded: true,
        });
      }
    } catch {
      // ignore transient network errors
    } finally {
      setRunsLoaded(true);
    }
  }, []);

  React.useEffect(() => {
    void refreshRuns();
  }, [refreshRuns]);

  const runFullWebsiteAudit = React.useCallback(
    async (urlOverride?: string) => {
      const targetUrl = (urlOverride ?? activeProperty.url).trim();
      if (!targetUrl) {
        setAuditError("Enter or select a property URL before running a full audit.");
        return null;
      }

      setAuditLoading(true);
      setAuditError(null);
      try {
        const res = await fetch("/api/full-audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetUrl,
            maxPages: 25,
            includeGsc: true,
            includeGeo: true,
          }),
        });
        const json = (await res.json()) as {
          error?: string;
          details?: string;
          report?: FullWebsiteAuditReport;
        };
        if (!res.ok || !json.report) {
          throw new Error(json.details || json.error || "Full website audit failed.");
        }

        setAuditReport((prev) => {
          if (prev) setPreviousAuditReport(prev);
          return json.report!;
        });

        const entry: AuditHistoryEntry = {
          date: new Date(json.report.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          score: json.report.overallScore,
          issues: json.report.actionPlan.length,
        };
        setAuditHistory((prev) => {
          const updated = [...prev, entry].slice(-10);
          try {
            window.localStorage.setItem(AUDIT_HISTORY_KEY, JSON.stringify(updated));
          } catch {
            // ignore storage errors
          }
          return updated;
        });

        try {
          window.sessionStorage.setItem(AUDIT_REPORT_KEY, JSON.stringify(json.report));
        } catch {
          // ignore storage quota errors
        }

        return json.report;
      } catch (err) {
        setAuditError((err as Error).message);
        return null;
      } finally {
        setAuditLoading(false);
      }
    },
    [activeProperty.url]
  );

  return (
    <WorkspaceContext.Provider
      value={{
        activeProperty,
        recentProperties,
        selectProperty,
        updateProperty,
        clearProperty,
        autofillPropertyByUrl,
        isDark,
        toggleTheme,
        autoPilotOpen,
        setAutoPilotOpen,
        commandPaletteOpen,
        setCommandPaletteOpen,
        latestRuns,
        runsLoaded,
        aiStatus,
        refreshRuns,
        auditReport,
        previousAuditReport,
        auditHistory,
        auditLoading,
        auditError,
        runFullWebsiteAudit,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = React.useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used inside WorkspaceProvider");
  }
  return ctx;
}
