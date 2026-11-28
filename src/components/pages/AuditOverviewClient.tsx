"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileText,
  Globe,
  Heading,
  Image as ImageIcon,
  Link2,
  Map,
  Play,
  RefreshCw,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  CategoryCard,
  DistributionChart,
  EmptyState,
  InlineAlert,
  MetricRow,
  PageHeader,
  TrendChart,
  VitalsBar,
} from "@/components/data/index";
import { CrawlPulseScene } from "@/components/motion/TelemetryScenes";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@/components/ui/index";
import {
  AUDIT_DIMENSIONS,
  buildDistributionSeries,
  buildIssuesByDimension,
  buildMeasuredVitals,
} from "@/lib/audit-view-model";

const DIMENSION_ICONS: Record<string, React.ReactNode> = {
  security: <Shield className="h-4 w-4" aria-hidden="true" />,
  crawling: <Globe className="h-4 w-4" aria-hidden="true" />,
  redirects: <RefreshCw className="h-4 w-4" aria-hidden="true" />,
  sitemap: <Map className="h-4 w-4" aria-hidden="true" />,
  meta: <FileText className="h-4 w-4" aria-hidden="true" />,
  content: <FileText className="h-4 w-4" aria-hidden="true" />,
  headings: <Heading className="h-4 w-4" aria-hidden="true" />,
  images: <ImageIcon className="h-4 w-4" aria-hidden="true" />,
  links: <Link2 className="h-4 w-4" aria-hidden="true" />,
  speed: <Zap className="h-4 w-4" aria-hidden="true" />,
  geo: <Sparkles className="h-4 w-4" aria-hidden="true" />,
};

export function AuditOverviewClient() {
  const {
    activeProperty,
    auditReport,
    auditHistory,
    auditLoading,
    auditError,
    runFullWebsiteAudit,
  } = useWorkspace();

  const [exporting, setExporting] = React.useState(false);

  async function handleExport(format: "csv" | "html" | "pdf") {
    if (!auditReport) return;
    setExporting(true);
    try {
      const res = await fetch("/api/audit-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, report: auditReport }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `seo-audit-${auditReport.domain}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const byDimension = React.useMemo(() => buildIssuesByDimension(auditReport), [auditReport]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Website Audit"
        description={
          activeProperty.url
            ? `Technical, content, and schema audit for ${activeProperty.url}`
            : "Select a property or enter a URL to audit technical health, headings, images, and GEO signals."
        }
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Website Audit" }]}
        secondaryActions={[
          { label: "Issue Report", href: "/audit/issues" },
          { label: "Export CSV", onClick: () => void handleExport("csv"), disabled: !auditReport || exporting },
          { label: "Export PDF", onClick: () => void handleExport("pdf"), disabled: !auditReport || exporting },
        ]}
        primaryAction={
          <Button
            variant="primary"
            loading={auditLoading}
            onClick={() => void runFullWebsiteAudit()}
            icon={<Play className="h-4 w-4" aria-hidden="true" />}
          >
            Run full audit
          </Button>
        }
      />

      {auditError && (
        <InlineAlert
          variant="error"
          title="Audit failed"
          description={auditError}
          onRetry={() => void runFullWebsiteAudit()}
        />
      )}

      {auditLoading && (
        <CrawlPulseScene
          active
          label="Executing full website audit..."
          sublabel="Inspecting security headers, crawlability, headings, image alt coverage, schema, and GEO signals"
        />
      )}

      {!auditReport && !auditLoading ? (
        <EmptyState
          icon={<Globe className="h-5 w-5" aria-hidden="true" />}
          title="No website audit run yet"
          description="Run the audit engine on the active property URL to populate health trends, category breakdowns, and issue lists."
          action={
            <Button variant="primary" onClick={() => void runFullWebsiteAudit()}>
              Run full audit
            </Button>
          }
        />
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-2">
            {auditLoading ? (
              <>
                <Skeleton className="h-72 w-full" />
                <Skeleton className="h-72 w-full" />
              </>
            ) : (
              <>
                <TrendChart data={auditHistory} />
                <DistributionChart data={buildDistributionSeries(auditReport)} />
              </>
            )}
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <VitalsBar desktop={buildMeasuredVitals(auditReport)} mobile={buildMeasuredVitals(auditReport)} />
            <Card className="lg:col-span-2">
              <CardHeader>
                <div>
                  <CardTitle>Crawl &amp; Technical Summary</CardTitle>
                  <CardDescription>Measured fields from the latest inspection</CardDescription>
                </div>
                <Link href="/audit/pages" className="text-caption font-medium text-link hover:underline">
                  View crawled pages &rarr;
                </Link>
              </CardHeader>
              <CardContent className="grid gap-x-8 sm:grid-cols-2">
                <div>
                  <MetricRow label="HTTP status" value={auditReport?.technicalHealth.statusCode} />
                  <MetricRow label="HTTPS valid" value={auditReport ? (auditReport.technicalHealth.isHttps ? "Yes" : "No") : null} />
                  <MetricRow label="Compression" value={auditReport ? (auditReport.technicalHealth.hasCompression ? "Enabled" : "Disabled") : null} />
                  <MetricRow label="Robots.txt" value={auditReport ? (auditReport.crawlability.hasRobotsTxt ? "Found" : "Missing") : null} />
                </div>
                <div>
                  <MetricRow label="Title pixel width" value={auditReport ? `${auditReport.onPage.titlePixelWidth} px` : null} />
                  <MetricRow label="Total headings" value={auditReport?.headings.totalHeadings} />
                  <MetricRow label="Images found" value={auditReport?.images.totalImages} />
                  <MetricRow label="JSON-LD schemas" value={auditReport?.schemaValidation.schemasDetected.length} />
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-heading text-text">Audit Categories</h2>
              <Link href="/audit/issues" className="text-caption font-medium text-link hover:underline">
                Open Issue Report &rarr;
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {AUDIT_DIMENSIONS.map((dim) => {
                const items = byDimension[dim.id] ?? [];
                const errs = items.filter((i) => i.severity === "error").length;
                const warns = items.filter((i) => i.severity === "warning").length;
                return (
                  <CategoryCard
                    key={dim.id}
                    href={`/audit/issues?category=${dim.id}`}
                    name={dim.label}
                    icon={DIMENSION_ICONS[dim.id]}
                    errorCount={errs}
                    warningCount={warns}
                  />
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
