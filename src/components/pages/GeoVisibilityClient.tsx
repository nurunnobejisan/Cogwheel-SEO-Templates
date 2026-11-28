"use client";

import * as React from "react";
import { Copy, Download, Upload } from "lucide-react";
import { InlineAlert, PageHeader } from "@/components/data/index";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
} from "@/components/ui/index";
import { downloadTextWithCountdown } from "@/lib/download-manager";

export function GeoVisibilityClient() {
  const { activeProperty, updateProperty } = useWorkspace();
  const [competitorsText, setCompetitorsText] = React.useState("");
  const [pasteJson, setPasteJson] = React.useState("");
  const [apiKey, setApiKey] = React.useState("");
  const [workspaceId, setWorkspaceId] = React.useState("");
  const [syncBusy, setSyncBusy] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<{
    variant: "success" | "error" | "notice";
    title: string;
    description: string;
  } | null>(null);

  const propertyName = activeProperty.name.trim() || "[property name]";
  const propertyUrl = activeProperty.url.trim();
  const locationLabel =
    [activeProperty.city.trim(), activeProperty.state.trim()].filter(Boolean).join(", ") || "[city, state]";

  const competitors = React.useMemo(
    () =>
      competitorsText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [name, domain] = line.split(",").map((part) => part.trim());
          return { name: name || domain || "", domain: domain || "" };
        })
        .filter((c) => c.name && c.domain),
    [competitorsText]
  );

  const batchPayload = React.useMemo(
    () => ({
      organization: {
        brandName: activeProperty.name,
        domain: propertyUrl,
        city: activeProperty.city,
        state: activeProperty.state,
        source: "SEO & GEO Studio",
      },
      promptsBatch: [
        {
          prompt: `Best boutique hotel with river view and spa in ${locationLabel}`,
          category: "Discovery",
          targetEngines: ["ChatGPT", "Perplexity", "Google AI Overviews"],
        },
        {
          prompt: `Does ${propertyName} allow pets and what are the pet fees?`,
          category: "Amenities",
          targetEngines: ["Google AI Overviews", "ChatGPT"],
        },
        {
          prompt: `Spa packages and treatment pricing at ${propertyName}`,
          category: "Spa & Wellness",
          targetEngines: ["Perplexity", "ChatGPT"],
        },
        {
          prompt: `Where to stay near downtown ${activeProperty.city || "[city]"} with dining`,
          category: "Dining",
          targetEngines: ["ChatGPT", "Google AI Overviews"],
        },
        {
          prompt: `Corporate meeting and wedding venues at ${propertyName}`,
          category: "Groups & Events",
          targetEngines: ["Copilot", "Perplexity"],
        },
      ],
      competitors,
    }),
    [activeProperty, propertyName, propertyUrl, locationLabel, competitors]
  );

  const jsonString = React.useMemo(() => JSON.stringify(batchPayload, null, 2), [batchPayload]);

  function ingestJson(raw: string) {
    try {
      const parsed = JSON.parse(raw) as {
        organization?: { brandName?: string; city?: string; state?: string; domain?: string };
        competitors?: Array<{ name: string; domain: string }>;
        promptsBatch?: unknown[];
        score?: number;
        citationScore?: number;
        geoScore?: number;
      };

      if (parsed.organization) {
        const org = parsed.organization;
        updateProperty({
          name: org.brandName || activeProperty.name,
          brand: org.brandName || activeProperty.brand,
          city: org.city || activeProperty.city,
          state: org.state || activeProperty.state,
          url: org.domain || activeProperty.url,
        });
        if (Array.isArray(parsed.competitors) && parsed.competitors.length > 0) {
          try {
            window.localStorage.setItem("seo_studio_compset_override", JSON.stringify(parsed.competitors));
          } catch {
            // ignore storage errors
          }
        }
        setStatusMessage({
          variant: "success",
          title: "Batch ingested",
          description: `Updated property to ${org.brandName || activeProperty.name} with ${(parsed.competitors ?? []).length} competitors and ${(parsed.promptsBatch ?? []).length} prompts.`,
        });
        return;
      }

      const numericScore = parsed.score ?? parsed.citationScore ?? parsed.geoScore;
      if (typeof numericScore === "number") {
        try {
          window.localStorage.setItem("seo_studio_visibility_score_v1", String(numericScore));
        } catch {
          // ignore storage errors
        }
        setStatusMessage({
          variant: "success",
          title: "Visibility score imported",
          description: `Imported citation score: ${numericScore}%`,
        });
        return;
      }

      throw new Error("Missing organization or score fields in JSON payload.");
    } catch (err) {
      setStatusMessage({
        variant: "error",
        title: "Invalid JSON batch",
        description: (err as Error).message,
      });
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setPasteJson(text);
    ingestJson(text);
  }

  async function handleRemoteSync() {
    if (!apiKey.trim()) {
      setStatusMessage({
        variant: "error",
        title: "API key required",
        description: "Enter a VisibilitySuite API key before syncing.",
      });
      return;
    }
    setSyncBusy(true);
    try {
      const res = await fetch("/api/visibility-suite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync",
          apiKey: apiKey.trim(),
          workspaceId: workspaceId.trim(),
          payload: batchPayload,
        }),
      });
      const data = (await res.json()) as { error?: string; score?: number; message?: string };
      if (!res.ok) throw new Error(data.error || "Sync request failed.");
      if (typeof data.score === "number") {
        try {
          window.localStorage.setItem("seo_studio_visibility_score_v1", String(data.score));
        } catch {
          // ignore storage errors
        }
      }
      setStatusMessage({
        variant: "success",
        title: "Remote sync complete",
        description: data.message || "Synced prompts and competitors with VisibilitySuite.",
      });
    } catch (err) {
      setStatusMessage({
        variant: "error",
        title: "Sync failed",
        description: (err as Error).message,
      });
    } finally {
      setSyncBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Visibility Connector"
        description="Import external AI citation snapshots, export prompt batches, or sync with VisibilitySuite."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "AI & GEO", href: "/geo" },
          { label: "Visibility Connector" },
        ]}
      />

      {statusMessage && (
        <InlineAlert
          variant={statusMessage.variant}
          title={statusMessage.title}
          description={statusMessage.description}
        />
      )}

      <Tabs defaultValue="ingest">
        <TabsList>
          <TabsTrigger value="ingest">Ingest Batch JSON</TabsTrigger>
          <TabsTrigger value="export">Generate Prompt Batch</TabsTrigger>
          <TabsTrigger value="api">API Sync</TabsTrigger>
        </TabsList>

        <TabsContent value="ingest" className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Upload or Paste VisibilitySuite Export</CardTitle>
                <CardDescription>Accepts JSON batch snapshots containing organization metadata or citation scores.</CardDescription>
              </div>
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-sm border border-border bg-surface px-3.5 text-caption font-medium text-text hover:bg-surface-2">
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Choose JSON file</span>
                <input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => void handleFileUpload(e)} />
              </label>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                label="JSON Payload"
                rows={8}
                value={pasteJson}
                onChange={(e) => setPasteJson(e.target.value)}
                placeholder='{ "organization": { "brandName": "..." } }'
                className="font-mono text-caption"
              />
              <Button variant="primary" onClick={() => ingestJson(pasteJson)} disabled={!pasteJson.trim()}>
                Ingest JSON
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Prompt &amp; Comp-Set Batch Generator</CardTitle>
                <CardDescription>Supply one competitor per line as Name, domain.com</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Copy className="h-3.5 w-3.5" />}
                  onClick={() => {
                    void navigator.clipboard?.writeText(jsonString);
                    toast.success("Copied JSON batch");
                  }}
                >
                  Copy JSON
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Download className="h-3.5 w-3.5" />}
                  onClick={() =>
                    downloadTextWithCountdown(
                      `${propertyName.replace(/[^a-zA-Z0-9]/g, "_")}_VisibilitySuite_Batch.json`,
                      jsonString,
                      "application/json",
                      3
                    )
                  }
                >
                  Download JSON
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Textarea
                label="Competitors (Name, domain)"
                rows={8}
                value={competitorsText}
                onChange={(e) => setCompetitorsText(e.target.value)}
                placeholder={"The Ritz-Carlton, ritzcarlton.com\nFour Seasons, fourseasons.com"}
              />
              <Textarea label="Generated Batch Preview" rows={8} value={jsonString} readOnly className="font-mono text-caption" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>VisibilitySuite API Credentials</CardTitle>
                <CardDescription>Push your prompt batch directly to a licensed VisibilitySuite workspace.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="API Key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="vs_live_..."
                />
                <Input
                  label="Workspace ID"
                  value={workspaceId}
                  onChange={(e) => setWorkspaceId(e.target.value)}
                  placeholder="ws_..."
                />
              </div>
              <Button variant="primary" loading={syncBusy} onClick={() => void handleRemoteSync()}>
                Sync Prompts
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
