"use client";

import * as React from "react";
import { Map, Play } from "lucide-react";
import { DataTable, FilterTabs, InlineAlert, KpiTile, PageHeader } from "@/components/data/index";
import { CrawlPulseScene } from "@/components/motion/TelemetryScenes";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { Badge, Button, Input } from "@/components/ui/index";

interface DiscoveredUrl {
  url: string;
  category: string;
  depth: number;
  isHttps: boolean;
  hasTrailingSlash: boolean;
}

interface SitemapCategory {
  name: string;
  count: number;
  urls: string[];
}

interface SitemapAuditResult {
  success: boolean;
  sitemapUrl: string;
  totalUrls: number;
  categories: SitemapCategory[];
  discoveredUrls: DiscoveredUrl[];
  healthScore: number;
  issues: string[];
}

export function SitemapAuditClient() {
  const { activeProperty } = useWorkspace();
  const [sitemapInput, setSitemapInput] = React.useState(
    activeProperty.url ? `${activeProperty.url.replace(/\/+$/, "")}/sitemap.xml` : ""
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<SitemapAuditResult | null>(null);
  const [selectedCategory, setSelectedCategory] = React.useState("All");

  React.useEffect(() => {
    if (activeProperty.url && !sitemapInput) {
      setSitemapInput(`${activeProperty.url.replace(/\/+$/, "")}/sitemap.xml`);
    }
  }, [activeProperty.url, sitemapInput]);

  async function runAudit(overrideUrl?: string) {
    const target = (overrideUrl ?? sitemapInput).trim();
    if (!target) {
      setError("Enter a sitemap URL or website domain.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sitemap-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to inspect sitemap.");
      }
      setResult(data as SitemapAuditResult);
      setSelectedCategory("All");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const filteredUrls = React.useMemo(() => {
    if (!result) return [];
    if (selectedCategory === "All") return result.discoveredUrls;
    return result.discoveredUrls.filter((u) => u.category === selectedCategory);
  }, [result, selectedCategory]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="XML Sitemap Audit"
        description="Discover sitemap URLs, verify HTTPS & trailing-slash consistency, and categorize pages."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Website Audit", href: "/audit" },
          { label: "XML Sitemap" },
        ]}
        primaryAction={
          <Button
            variant="primary"
            loading={loading}
            onClick={() => void runAudit()}
            icon={<Play className="h-4 w-4" aria-hidden="true" />}
          >
            Inspect sitemap
          </Button>
        }
      />

      <div className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <Input
          label="Sitemap or Property URL"
          type="url"
          value={sitemapInput}
          onChange={(e) => setSitemapInput(e.target.value)}
          placeholder="https://www.example.com/sitemap.xml"
        />
        <Button variant="secondary" className="shrink-0" onClick={() => void runAudit("https://www.arrivehotels.com/sitemap.xml")}>
          Sample: Arrive
        </Button>
      </div>

      {error && (
        <InlineAlert
          variant="error"
          title="Sitemap audit failed"
          description={error}
          onRetry={() => void runAudit()}
        />
      )}

      {loading && (
        <CrawlPulseScene
          active
          label="Parsing XML sitemap index & categorizing URLs..."
          sublabel="Validating canonical HTTPS structure, depth, and URL hygiene"
        />
      )}

      {result && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile label="Total URLs" value={result.totalUrls} />
            <KpiTile label="Health score" value={result.healthScore} suffix="%" />
            <KpiTile label="Categories" value={result.categories.length} />
            <KpiTile label="Issues" value={result.issues.length} />
          </div>

          {result.issues.length > 0 && (
            <InlineAlert
              variant="warning"
              title="Sitemap structural observations"
              description={result.issues.join(" · ")}
            />
          )}

          <FilterTabs
            value={selectedCategory}
            onChange={setSelectedCategory}
            options={[
              { id: "All", label: "All URLs", count: result.discoveredUrls.length },
              ...result.categories.map((cat) => ({ id: cat.name, label: cat.name, count: cat.count })),
            ]}
          />
        </>
      )}

      <DataTable
        data={filteredUrls}
        loading={loading}
        emptyTitle="No sitemap loaded"
        emptyDescription="Enter a /sitemap.xml URL above and click Inspect sitemap to analyze discovered pages."
        emptyAction={
          <Button variant="primary" size="sm" icon={<Map className="h-4 w-4" />} onClick={() => void runAudit()}>
            Inspect sitemap
          </Button>
        }
        columns={[
          {
            accessorKey: "url",
            header: "Discovered URL",
            cell: ({ row }) => (
              <span className="block max-w-md truncate font-mono text-caption text-text">{row.original.url}</span>
            ),
          },
          {
            accessorKey: "category",
            header: "Category",
            cell: ({ row }) => <Badge variant="neutral">{row.original.category}</Badge>,
          },
          {
            accessorKey: "depth",
            header: "Depth",
            cell: ({ row }) => <span className="nums">{row.original.depth}</span>,
          },
          {
            accessorKey: "isHttps",
            header: "Protocol",
            cell: ({ row }) => (
              <Badge variant={row.original.isHttps ? "success" : "error"}>
                {row.original.isHttps ? "HTTPS" : "HTTP"}
              </Badge>
            ),
          },
        ]}
      />
    </div>
  );
}
