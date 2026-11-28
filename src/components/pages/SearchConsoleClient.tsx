"use client";

import * as React from "react";
import { Play, Search } from "lucide-react";
import { DataTable, EmptyState, InlineAlert, KpiTile, PageHeader, TrendChart } from "@/components/data/index";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { Badge, Button, Input } from "@/components/ui/index";

export function SearchConsoleClient() {
  const { activeProperty, auditReport, auditHistory, auditLoading, auditError, runFullWebsiteAudit } = useWorkspace();
  const [search, setSearch] = React.useState("");

  const gsc = auditReport?.searchConsole;
  const isConnected = Boolean(gsc?.isConnected);

  const filteredQueries = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = gsc?.topQueries ?? [];
    if (!q) return rows;
    return rows.filter((r) => r.query.toLowerCase().includes(q));
  }, [gsc, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Search Console"
        description={
          activeProperty.url
            ? `Organic clicks, impressions, and cannibalization checks for ${activeProperty.url}`
            : "Connect Google Search Console credentials and run an audit to inspect query metrics."
        }
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Website Audit", href: "/audit" },
          { label: "Search Console" },
        ]}
        primaryAction={
          <Button
            variant="primary"
            loading={auditLoading}
            onClick={() => void runFullWebsiteAudit()}
            icon={<Play className="h-4 w-4" aria-hidden="true" />}
          >
            Refresh GSC audit
          </Button>
        }
      />

      {auditError && (
        <InlineAlert
          variant="error"
          title="Could not refresh Search Console audit"
          description={auditError}
          onRetry={() => void runFullWebsiteAudit()}
        />
      )}

      {!auditReport ? (
        <EmptyState
          icon={<Search className="h-5 w-5" aria-hidden="true" />}
          title="No Search Console audit run yet"
          description="Run an audit on the active property to evaluate Google Search Console connectivity and query metrics."
          action={
            <Button variant="primary" onClick={() => void runFullWebsiteAudit()} loading={auditLoading}>
              Run GSC audit
            </Button>
          }
        />
      ) : !isConnected ? (
        <InlineAlert
          variant="warning"
          title="Google Search Console is not connected"
          description="Configure GSC service-account credentials on the server to populate clicks, impressions, average position, and query cannibalization conflicts."
          onRetry={() => void runFullWebsiteAudit()}
          retryLabel="Check connection"
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile label="Clicks" value={gsc?.totalClicks ?? null} caption={`Last ${gsc?.periodDays ?? 28} days`} />
            <KpiTile label="Impressions" value={gsc?.totalImpressions ?? null} caption={`Last ${gsc?.periodDays ?? 28} days`} />
            <KpiTile
              label="Average CTR"
              value={gsc ? Number((gsc.averageCtr * 100).toFixed(2)) : null}
              suffix="%"
            />
            <KpiTile
              label="Average Position"
              value={gsc ? Number(gsc.averagePosition.toFixed(1)) : null}
            />
          </div>

          <TrendChart
            data={auditHistory}
            title="Audit & Search Health History"
            description={`Property: ${gsc?.siteUrl}`}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-heading text-text">Top Queries &amp; Cannibalization</h2>
              <Badge variant={(gsc?.cannibalizationDetectedCount ?? 0) > 0 ? "warning" : "success"}>
                {gsc?.cannibalizationDetectedCount ?? 0} conflicts
              </Badge>
            </div>
            <div className="w-full sm:w-64">
              <Input
                type="search"
                placeholder="Filter queries..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Filter Search Console queries"
              />
            </div>
          </div>

          <DataTable
            data={filteredQueries}
            emptyTitle="No Search Console queries returned"
            emptyDescription="Verify property permissions or broaden the query filter."
            columns={[
              { accessorKey: "query", header: "Query" },
              {
                accessorKey: "clicks",
                header: "Clicks",
                cell: ({ row }) => <span className="nums">{row.original.clicks.toLocaleString()}</span>,
              },
              {
                accessorKey: "impressions",
                header: "Impressions",
                cell: ({ row }) => <span className="nums">{row.original.impressions.toLocaleString()}</span>,
              },
              {
                accessorKey: "ctr",
                header: "CTR",
                cell: ({ row }) => <span className="nums">{(row.original.ctr * 100).toFixed(2)}%</span>,
              },
              {
                accessorKey: "position",
                header: "Position",
                cell: ({ row }) => <span className="nums">{row.original.position.toFixed(1)}</span>,
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
