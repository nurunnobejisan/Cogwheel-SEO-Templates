"use client";

import * as React from "react";
import Link from "next/link";
import { Play, Sparkles } from "lucide-react";
import { DataTable, InlineAlert, KpiTile, PageHeader, ScoreRing } from "@/components/data/index";
import { GeoRadarSweep } from "@/components/motion/TelemetryScenes";
import { SignalPulse } from "@/components/motion";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/index";

const SCHEMA_FAMILIES = [
  {
    label: "Hotel / LodgingBusiness",
    types: ["Hotel", "LodgingBusiness", "Resort", "Motel", "BedAndBreakfast"],
    recommendation:
      "Declare Hotel or LodgingBusiness JSON-LD with name, address, geo coordinates, check-in/out times, and amenityFeature entries.",
  },
  {
    label: "Restaurant / Dining",
    types: ["Restaurant", "FoodEstablishment", "BarOrPub", "CafeOrCoffeeShop"],
    recommendation:
      "Add Restaurant schema with menu URL, openingHoursSpecification, servesCuisine, and priceRange.",
  },
  {
    label: "Spa / Wellness",
    types: ["DaySpa", "HealthAndBeautyBusiness", "BeautySalon", "Spa"],
    recommendation:
      "Add DaySpa or HealthAndBeautyBusiness schema listing treatments and a bookable service URL.",
  },
  {
    label: "FAQ / Direct answers",
    types: ["FAQPage", "Question", "Answer"],
    recommendation:
      "Publish FAQPage JSON-LD for policy questions (pets, parking, fees) with concise 40–60 word answers.",
  },
  {
    label: "Organization / Website",
    types: ["Organization", "WebSite", "BreadcrumbList"],
    recommendation:
      "Emit Organization + WebSite + BreadcrumbList so engines can resolve the brand entity and site structure.",
  },
];

export function GeoOverviewClient() {
  const { activeProperty, auditReport, auditLoading, auditError, runFullWebsiteAudit } = useWorkspace();
  const [importedScore, setImportedScore] = React.useState<number | null>(null);

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem("seo_studio_visibility_score_v1");
      if (saved) {
        const parsed = Number(saved);
        if (!Number.isNaN(parsed)) setImportedScore(parsed);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const geo = auditReport?.aiGeoVisibility;
  const schemasDetected = auditReport?.schemaValidation.schemasDetected ?? [];
  const headlineScore = importedScore ?? geo?.visibilityScore ?? null;
  const isProviderConnected = importedScore !== null || Boolean(geo?.dataAvailable);

  const city = activeProperty.city || "the local market";
  const name = activeProperty.name || "Target property";

  const promptTemplates = [
    { category: "Local discovery", prompt: `Best boutique hotel with dining and spa in ${city}` },
    { category: "Amenity validation", prompt: `Does ${name} allow pets and what are the pet fees?` },
    { category: "Booking intent", prompt: `Official booking perks and suite options at ${name}` },
    { category: "Groups & events", prompt: `Meeting rooms and wedding venues at ${name}` },
  ];

  const engines = [
    {
      name: "ChatGPT",
      value: geo?.dataAvailable ? geo.estimatedCitationsAcrossEngines.chatgptSearch : null,
      connected: isProviderConnected,
    },
    {
      name: "Perplexity",
      value: geo?.dataAvailable ? geo.estimatedCitationsAcrossEngines.perplexity : null,
      connected: isProviderConnected,
    },
    {
      name: "Gemini",
      value: geo?.dataAvailable ? geo.engineBreakdown?.gemini ?? null : null,
      connected: isProviderConnected,
    },
    {
      name: "AI Overviews",
      value: geo?.dataAvailable ? geo.estimatedCitationsAcrossEngines.googleAiOverviews : null,
      connected: isProviderConnected,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI & GEO Readiness"
        description="Evaluate structured entity signals, llms.txt coverage, and generative engine citation readiness."
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "AI & GEO" }]}
        secondaryActions={[
          { label: "AI Visibility Connector", href: "/geo/visibility" },
          { label: "Comp-Set Matrix", href: "/geo/compset" },
        ]}
        primaryAction={
          <Button
            variant="primary"
            loading={auditLoading}
            onClick={() => void runFullWebsiteAudit()}
            icon={<Play className="h-4 w-4" aria-hidden="true" />}
          >
            Scan GEO signals
          </Button>
        }
      />

      {auditError && (
        <InlineAlert
          variant="error"
          title="GEO audit failed"
          description={auditError}
          onRetry={() => void runFullWebsiteAudit()}
        />
      )}

      {/* Provider Connection Row */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3.5">
          <div className="flex items-center gap-2.5">
            <SignalPulse tone={isProviderConnected ? "success" : "warning"} active={isProviderConnected} />
            <span className="text-body font-medium text-text">
              VisibilitySuite: {isProviderConnected ? "Connected" : "Not connected"}
            </span>
            {isProviderConnected && (
              <Badge variant="success" dot>
                Live Sync
              </Badge>
            )}
          </div>
          <Button variant="secondary" size="sm" asChild>
            <Link href="/geo/visibility">
              {isProviderConnected ? "Manage connector" : "Connect"}
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* ScoreRing + Radar */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col justify-between p-5">
          <ScoreRing score={headlineScore} label="GEO Readiness" />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <KpiTile label="Entity clarity" value={geo?.brandEntityClarity ?? null} suffix="/100" />
            <KpiTile label="Fact density" value={geo?.factDensityScore ?? null} suffix="/100" />
          </div>
        </Card>

        <GeoRadarSweep score={headlineScore} engines={engines} />
      </section>

      {/* Underline Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="schema">Schema &amp; Entities</TabsTrigger>
          <TabsTrigger value="prompts">Prompt Set</TabsTrigger>
          <TabsTrigger value="engines">AI Engines</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {geo ? (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Methodology &amp; Entity Strengths</CardTitle>
                  <CardDescription>{geo.methodology}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {geo.recommendations.length > 0 ? (
                  <ul className="space-y-2">
                    {geo.recommendations.map((rec) => (
                      <li key={rec} className="flex items-start gap-2 text-body text-text">
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-caption text-text-muted">No critical GEO recommendations raised.</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <InlineAlert
              variant="notice"
              title="Run a GEO scan to measure on-page signals"
              description="Scans JSON-LD schema types, heading clarity, answer coverage, and AI crawler accessibility without fabricating engine scores."
            />
          )}
        </TabsContent>

        <TabsContent value="schema">
          <DataTable
            data={SCHEMA_FAMILIES.map((fam) => ({
              family: fam.label,
              detected: auditReport ? (fam.types.some((t) => schemasDetected.includes(t)) ? "Detected" : "Missing") : "Not measured",
              recommendation: fam.recommendation,
            }))}
            enableColumnVisibility={false}
            columns={[
              { accessorKey: "family", header: "Schema Family" },
              {
                accessorKey: "detected",
                header: "Status",
                cell: ({ row }) => {
                  const s = row.original.detected;
                  return (
                    <Badge variant={s === "Detected" ? "success" : s === "Missing" ? "warning" : "neutral"}>
                      {s}
                    </Badge>
                  );
                },
              },
              {
                accessorKey: "recommendation",
                header: "Guidance",
                cell: ({ row }) => (
                  <span className="block max-w-md text-caption text-text-muted">{row.original.recommendation}</span>
                ),
              },
            ]}
          />
        </TabsContent>

        <TabsContent value="prompts">
          <DataTable
            data={promptTemplates}
            enableColumnVisibility={false}
            columns={[
              {
                accessorKey: "category",
                header: "Category",
                cell: ({ row }) => <Badge variant="neutral">{row.original.category}</Badge>,
              },
              { accessorKey: "prompt", header: "Evaluation Prompt" },
            ]}
          />
        </TabsContent>

        <TabsContent value="engines">
          <DataTable
            data={engines}
            enableColumnVisibility={false}
            columns={[
              { accessorKey: "name", header: "AI Engine" },
              {
                accessorKey: "connected",
                header: "Provider State",
                cell: ({ row }) => (
                  <Badge variant={row.original.connected ? "success" : "neutral"}>
                    {row.original.connected ? "Connected" : "Not connected"}
                  </Badge>
                ),
              },
              {
                accessorKey: "value",
                header: "Citation Share",
                cell: ({ row }) => (
                  <span className="nums text-text-muted">
                    {row.original.value !== null ? `${row.original.value}%` : "Not measured"}
                  </span>
                ),
              },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
