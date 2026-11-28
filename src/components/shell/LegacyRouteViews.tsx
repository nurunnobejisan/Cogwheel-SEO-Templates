"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Skeleton } from "@/components/ui/index";
import { TASKS_CONFIG } from "@/tasks/tasks.config";

const RouteLoading = () => (
  <div className="space-y-4">
    <Skeleton className="h-8 w-64" />
    <Skeleton className="h-64 w-full" />
  </div>
);

const KeywordResearchView = dynamic(
  () => import("@/components/KeywordResearchView").then((m) => m.KeywordResearchView),
  { loading: RouteLoading }
);
const Studio = dynamic(() => import("@/components/Studio"), { loading: RouteLoading });
const GeoReadinessRadar = dynamic(
  () => import("@/components/GeoReadinessRadar").then((m) => m.GeoReadinessRadar),
  { loading: RouteLoading }
);
const VisibilitySuiteModal = dynamic(
  () => import("@/components/VisibilitySuiteModal").then((m) => m.VisibilitySuiteModal),
  { loading: RouteLoading }
);
const CompsetRankingMatrix = dynamic(
  () => import("@/components/CompsetRankingMatrix").then((m) => m.CompsetRankingMatrix),
  { loading: RouteLoading }
);
const ClientDeliverablesModal = dynamic(
  () => import("@/components/ClientDeliverablesModal").then((m) => m.ClientDeliverablesModal),
  { loading: RouteLoading }
);
const RunHistoryDrawer = dynamic(
  () => import("@/components/RunHistoryDrawer").then((m) => m.RunHistoryDrawer),
  { loading: RouteLoading }
);
const AiTrainingModal = dynamic(
  () => import("@/components/AiTrainingModal").then((m) => m.AiTrainingModal),
  { loading: RouteLoading }
);
const LabsView = dynamic(
  () => import("@/components/LabsView").then((m) => m.LabsView),
  { loading: RouteLoading }
);

export function LegacyKeywordsRoute() {
  const router = useRouter();
  const { activeProperty, updateProperty } = useWorkspace();
  return (
    <KeywordResearchView
      activeProperty={activeProperty}
      onBackToDashboard={() => router.push("/")}
      onOpenCopyStudio={() => router.push("/content")}
      onSelectProperty={(p) => updateProperty(p)}
    />
  );
}

export function LegacyStudioRoute({ initialStep = 1 }: { initialStep?: 1 | 2 | 3 | 4 }) {
  const { activeProperty } = useWorkspace();
  return <Studio key={initialStep} initialStep={initialStep} initialProperty={activeProperty} />;
}

export function LegacyGeoRoute() {
  const router = useRouter();
  const { activeProperty } = useWorkspace();
  return <GeoReadinessRadar property={activeProperty} onRunDeckGeneration={() => router.push("/reports/pptx")} />;
}

export function LegacyVisibilityRoute() {
  const router = useRouter();
  const { activeProperty, updateProperty } = useWorkspace();
  return (
    <VisibilitySuiteModal
      property={activeProperty}
      onClose={() => router.push("/geo")}
      onImportBatch={(batch) => {
        updateProperty(batch.property);
        if (batch.competitors && batch.competitors.length > 0) {
          try {
            window.localStorage.setItem("seo_studio_compset_override", JSON.stringify(batch.competitors));
          } catch {
            // ignore storage errors
          }
        }
      }}
    />
  );
}

export function LegacyCompsetRoute() {
  const router = useRouter();
  const { activeProperty } = useWorkspace();
  return <CompsetRankingMatrix property={activeProperty} onExportMemo={() => router.push("/reports/memo")} />;
}

export function LegacyReportsRoute({
  initialTab = "deck",
}: {
  initialTab?: "pptx" | "slides" | "preview" | "memo" | "email" | "deck";
}) {
  const router = useRouter();
  const { activeProperty, refreshRuns } = useWorkspace();
  return (
    <ClientDeliverablesModal
      initialTab={initialTab}
      defaultProperty={activeProperty}
      onClose={() => router.push("/")}
      onCompleted={() => void refreshRuns()}
    />
  );
}

export function LegacyHistoryRoute() {
  const router = useRouter();
  const readyTasks = TASKS_CONFIG.filter((t) => t.phase === 1 || t.status === "Done");
  const [selectedTaskId, setSelectedTaskId] = useState(readyTasks[0]?.id ?? TASKS_CONFIG[0].id);
  const task = TASKS_CONFIG.find((t) => t.id === selectedTaskId) ?? TASKS_CONFIG[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {readyTasks.map((t) => (
          <Button
            key={t.id}
            size="sm"
            variant={t.id === task.id ? "primary" : "secondary"}
            onClick={() => setSelectedTaskId(t.id)}
          >
            {t.name}
          </Button>
        ))}
      </div>
      <RunHistoryDrawer task={task} onClose={() => router.push("/reports")} />
    </div>
  );
}

export function LegacyAiTrainingRoute() {
  const router = useRouter();
  return <AiTrainingModal onClose={() => router.push("/")} />;
}

export function LegacyPropertySettingsRoute() {
  const { activeProperty, updateProperty, clearProperty, autofillPropertyByUrl } = useWorkspace();
  const [urlToFill, setUrlToFill] = useState(activeProperty.url);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDetect() {
    if (!urlToFill.trim()) {
      setError("Enter a website URL first.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const detected = await autofillPropertyByUrl(urlToFill);
      setUrlToFill(detected.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-[1200px] space-y-6">
      <div>
        <h1 className="text-title text-text">Property Profile</h1>
        <p className="mt-1 text-body text-text-muted">
          Configure the active property details used across audits, keyword matrices, and deliverables.
        </p>
      </div>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Auto-Detect by URL</CardTitle>
            <CardDescription>Fetch canonical metadata to populate property fields automatically.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            label="Website URL"
            type="url"
            placeholder="https://www.example.com"
            value={urlToFill}
            onChange={(e) => setUrlToFill(e.target.value)}
            error={error ?? undefined}
          />
          <Button variant="primary" loading={busy} onClick={() => void handleDetect()}>
            Auto-Detect
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Property Details</CardTitle>
            <CardDescription>Changes persist locally for this workspace.</CardDescription>
          </div>
          <Button variant="secondary" size="sm" onClick={clearProperty}>
            Clear Property
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Property Name"
            value={activeProperty.name}
            onChange={(e) => updateProperty({ name: e.target.value })}
          />
          <Input
            label="Brand / Group"
            value={activeProperty.brand}
            onChange={(e) => updateProperty({ brand: e.target.value })}
          />
          <Input
            label="City"
            value={activeProperty.city}
            onChange={(e) => updateProperty({ city: e.target.value })}
          />
          <Input
            label="State"
            maxLength={2}
            value={activeProperty.state}
            onChange={(e) => updateProperty({ state: e.target.value.toUpperCase() })}
          />
          <div className="sm:col-span-2">
            <Input
              label="Canonical URL"
              type="url"
              value={activeProperty.url}
              onChange={(e) => updateProperty({ url: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function LegacyLabsRoute() {
  const router = useRouter();
  const { activeProperty } = useWorkspace();
  return (
    <LabsView
      property={activeProperty}
      activeSubTab="sandbox"
      onRunDeckGeneration={() => router.push("/reports/pptx")}
      onExportMemo={() => router.push("/reports/memo")}
      onOpenImageAudit={() => router.push("/audit/images")}
      onOpenHeadingAudit={() => router.push("/audit/headings")}
    />
  );
}
