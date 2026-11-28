"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Download,
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
  FilterTabs,
  InlineAlert,
  IssueTable,
  PageHeader,
  SeverityFilter,
  type AuditSeverity,
} from "@/components/data/index";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { Button, Input } from "@/components/ui/index";
import { AUDIT_DIMENSIONS, buildIssuesByDimension } from "@/lib/audit-view-model";
import { cn } from "@/lib/utils";

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

export function AuditIssuesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { auditReport, auditLoading, auditError, runFullWebsiteAudit } = useWorkspace();

  const categoryParam = searchParams?.get("category") ?? "all";
  const viewParam = searchParams?.get("view") ?? "all";

  const [severities, setSeverities] = React.useState<AuditSeverity[]>(["error", "warning", "notice"]);
  const [search, setSearch] = React.useState("");

  const byDimension = React.useMemo(() => buildIssuesByDimension(auditReport), [auditReport]);

  const allIssues = React.useMemo(
    () => Object.values(byDimension).flat(),
    [byDimension]
  );

  const scopedIssues = React.useMemo(() => {
    const base = categoryParam === "all" ? allIssues : byDimension[categoryParam] ?? [];
    const q = search.trim().toLowerCase();
    return base.filter((issue) => {
      if (issue.severity !== "success" && !severities.includes(issue.severity)) return false;
      if (viewParam === "new" && (issue.newCount ?? 0) === 0) return false;
      if (viewParam === "fixed" && (issue.fixedCount ?? 0) === 0) return false;
      if (q && !issue.title.toLowerCase().includes(q) && !issue.description.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [allIssues, byDimension, categoryParam, search, severities, viewParam]);

  function updateQuery(nextCategory: string, nextView: string) {
    const params = new URLSearchParams();
    if (nextCategory && nextCategory !== "all") params.set("category", nextCategory);
    if (nextView && nextView !== "all") params.set("view", nextView);
    const qs = params.toString();
    router.replace(qs ? `/audit/issues?${qs}` : "/audit/issues");
  }

  function exportCsv() {
    const rows = [
      ["Issue", "Severity", "Pages", "Fixed", "New", "Description", "How to fix"],
      ...scopedIssues.map((i) => [
        i.title,
        i.severity,
        String(i.pagesCount),
        String(i.fixedCount ?? 0),
        String(i.newCount ?? 0),
        i.description,
        i.howToFix,
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "seo-issue-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalErr = allIssues.filter((i) => i.severity === "error").length;
  const totalWarn = allIssues.filter((i) => i.severity === "warning").length;
  const totalNotice = allIssues.filter((i) => i.severity === "notice").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Issue Report"
        description="Expand any issue for root-cause diagnostics, remediation guidance, and affected URLs."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Website Audit", href: "/audit" },
          { label: "Issue Report" },
        ]}
        secondaryActions={[
          {
            label: "Export CSV",
            onClick: exportCsv,
            disabled: scopedIssues.length === 0,
            icon: <Download className="h-3.5 w-3.5" aria-hidden="true" />,
          },
        ]}
        primaryAction={
          <Button
            variant="primary"
            loading={auditLoading}
            onClick={() => void runFullWebsiteAudit()}
            icon={<Play className="h-4 w-4" aria-hidden="true" />}
          >
            Run audit
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

      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FilterTabs
            value={viewParam}
            onChange={(next) => updateQuery(categoryParam, next)}
            options={[
              { id: "all", label: "All", count: allIssues.length },
              { id: "new", label: "New", count: allIssues.filter((i) => (i.newCount ?? 0) > 0).length },
              { id: "fixed", label: "Fixed", count: allIssues.filter((i) => (i.fixedCount ?? 0) > 0).length },
            ]}
          />
          <SeverityFilter
            selected={severities}
            onChange={setSeverities}
            counts={{ error: totalErr, warning: totalWarn, notice: totalNotice }}
          />
        </div>
        <div className="w-full sm:w-64">
          <Input
            type="search"
            placeholder="Filter issues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter audit issues"
          />
        </div>
      </div>

      {/* Category chips (<1024px) */}
      <nav
        aria-label="Audit categories mobile"
        className="flex snap-x items-center gap-2 overflow-x-auto pb-1 lg:hidden"
      >
        <Link
          href="/audit/issues"
          className={cn(
            "shrink-0 snap-start rounded-sm border px-3 py-1.5 text-caption font-medium",
            categoryParam === "all"
              ? "border-sidebar-active bg-sidebar-active text-sidebar-text"
              : "border-border bg-surface text-text-muted"
          )}
        >
          All ({allIssues.length})
        </Link>
        {AUDIT_DIMENSIONS.map((dim) => {
          const count = (byDimension[dim.id] ?? []).length;
          const selected = categoryParam === dim.id;
          return (
            <Link
              key={dim.id}
              href={`/audit/issues?category=${dim.id}`}
              className={cn(
                "shrink-0 snap-start rounded-sm border px-3 py-1.5 text-caption font-medium",
                selected
                  ? "border-sidebar-active bg-sidebar-active text-sidebar-text"
                  : "border-border bg-surface text-text-muted"
              )}
            >
              {dim.shortLabel} ({count})
            </Link>
          );
        })}
      </nav>

      {/* Category column + Detail IssueTable */}
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside aria-label="Audit categories" className="hidden space-y-2 lg:block">
          <Link
            href="/audit/issues"
            aria-current={categoryParam === "all" ? "page" : undefined}
            className={cn(
              "relative flex items-center justify-between rounded border p-3.5 text-body font-medium transition-colors",
              categoryParam === "all"
                ? "border-sidebar-active bg-sidebar-active text-sidebar-text"
                : "border-border bg-surface text-text hover:bg-surface-2"
            )}
          >
            <span>All Dimensions</span>
            <span className="nums text-caption">{allIssues.length}</span>
          </Link>

          {AUDIT_DIMENSIONS.map((dim) => {
            const items = byDimension[dim.id] ?? [];
            const errs = items.filter((i) => i.severity === "error").length;
            const warns = items.filter((i) => i.severity === "warning").length;
            return (
              <CategoryCard
                key={dim.id}
                href={`/audit/issues?category=${dim.id}${viewParam !== "all" ? `&view=${viewParam}` : ""}`}
                name={dim.label}
                icon={DIMENSION_ICONS[dim.id]}
                errorCount={errs}
                warningCount={warns}
                selected={categoryParam === dim.id}
              />
            );
          })}
        </aside>

        <div className="min-w-0">
          <IssueTable
            items={scopedIssues}
            emptyTitle={auditReport ? "No matching issues" : "Run a website audit first"}
            emptyDescription={
              auditReport
                ? "All checks in this category and severity filter passed."
                : "Click Run audit above to populate the issue breakdown."
            }
          />
        </div>
      </div>
    </div>
  );
}
