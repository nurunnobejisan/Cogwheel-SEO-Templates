"use client";

import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Search } from "lucide-react";
import type { KeywordItem, KeywordStrategyMatrix } from "../schemas/validation";
import { validateKeywordMatrix } from "../schemas/validation";
import { DEFAULT_PACK_ID, getPackMeta, type PackMeta } from "../packs/catalog";
import { clusterByTargetPageType } from "../packs/clusters";
import hotelMatrixJson from "../packs/hotel/keywords.json";
import { DataTable, FilterTabs, InlineAlert, KpiTile } from "@/components/data/index";
import { Badge, Card, Input } from "@/components/ui/index";

/**
 * Defaults keep existing callers working with the canonical hotel dataset.
 */
const DEFAULT_MATRIX: KeywordStrategyMatrix = validateKeywordMatrix(hotelMatrixJson);
const DEFAULT_PACK: PackMeta = getPackMeta(DEFAULT_PACK_ID) as PackMeta;

interface StrategyMatrixContentProps {
  /** Pack matrix to render; defaults to the hotel dataset. */
  matrix?: KeywordStrategyMatrix;
  /** Pack identity driving the badge and copy; defaults to the hotel pack. */
  pack?: PackMeta;
  /** "funnel" = category sections, "clusters" = one section per target page. */
  view?: "funnel" | "clusters";
}

interface MatrixTableRow {
  id: string;
  keyword: string;
  subCategory: string;
  category: string;
  searchIntent: KeywordItem["searchIntent"];
  searchVolumeTier: KeywordItem["searchVolumeTier"];
  targetPageType: string;
  recommendedSchema: string;
  cpcValue: string;
  geoEngines: string[];
  role?: "Primary" | "Overlaps primary" | "Variant";
}

function intentBadgeVariant(intent: KeywordItem["searchIntent"]): "notice" | "success" | "warning" | "neutral" {
  if (intent === "Transactional") return "success";
  if (intent === "Commercial") return "warning";
  if (intent === "Informational" || intent === "Navigational") return "notice";
  return "neutral";
}

function roleBadgeVariant(role: MatrixTableRow["role"]): "brand" | "warning" | "neutral" {
  if (role === "Primary") return "brand";
  if (role === "Overlaps primary") return "warning";
  return "neutral";
}

/**
 * Pack-driven strategy matrix body: renders a pack's 78-row dataset with an
 * honest disclaimer inside an expandable DataTable instead of a card stack.
 */
export function StrategyMatrixContent({
  matrix = DEFAULT_MATRIX,
  pack = DEFAULT_PACK,
  view = "funnel",
}: StrategyMatrixContentProps) {
  const { metadata: meta, categories, keywords } = matrix;
  const targetPageTypes = useMemo(() => new Set(keywords.map((k) => k.targetPageType)), [keywords]);
  const clusters = useMemo(
    () => (view === "clusters" ? clusterByTargetPageType(keywords) : []),
    [view, keywords]
  );

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedCluster, setSelectedCluster] = useState<string>(
    clusters[0]?.targetPageType ?? ""
  );
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setSelectedCategory("all");
  }, [pack.id, view]);

  useEffect(() => {
    if (view === "clusters") {
      setSelectedCluster(clusters[0]?.targetPageType ?? "");
    }
  }, [view, pack.id, clusters]);

  const activeCluster = useMemo(
    () => clusters.find((c) => c.targetPageType === selectedCluster) ?? clusters[0],
    [clusters, selectedCluster]
  );

  const categoryOptions = useMemo(
    () => [
      { id: "all", label: "All categories", count: keywords.length },
      ...categories.map((cat) => ({
        id: cat,
        label: cat,
        count: keywords.filter((k) => k.category === cat).length,
      })),
    ],
    [categories, keywords]
  );

  const clusterOptions = useMemo(
    () =>
      clusters.map((cluster) => ({
        id: cluster.targetPageType,
        label: cluster.targetPageType,
        count: 1 + cluster.variants.length,
      })),
    [clusters]
  );

  const tableRows: MatrixTableRow[] = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery = (kw: KeywordItem) =>
      !query ||
      kw.keyword.toLowerCase().includes(query) ||
      kw.subCategory.toLowerCase().includes(query) ||
      kw.targetPageType.toLowerCase().includes(query) ||
      kw.recommendedSchema.toLowerCase().includes(query);

    if (view === "clusters" && activeCluster) {
      const items: MatrixTableRow[] = [
        {
          id: activeCluster.primary.id,
          keyword: activeCluster.primary.keyword,
          subCategory: activeCluster.primary.subCategory,
          category: activeCluster.primary.category,
          searchIntent: activeCluster.primary.searchIntent,
          searchVolumeTier: activeCluster.primary.searchVolumeTier,
          targetPageType: activeCluster.primary.targetPageType,
          recommendedSchema: activeCluster.primary.recommendedSchema,
          cpcValue: activeCluster.primary.cpcEstimate.value,
          geoEngines: activeCluster.primary.geoEngineRelevance,
          role: "Primary",
        },
        ...activeCluster.variants.map((v) => ({
          id: v.keyword.id,
          keyword: v.keyword.keyword,
          subCategory: v.keyword.subCategory,
          category: v.keyword.category,
          searchIntent: v.keyword.searchIntent,
          searchVolumeTier: v.keyword.searchVolumeTier,
          targetPageType: v.keyword.targetPageType,
          recommendedSchema: v.keyword.recommendedSchema,
          cpcValue: v.keyword.cpcEstimate.value,
          geoEngines: v.keyword.geoEngineRelevance,
          role: (v.overlapsPrimary ? "Overlaps primary" : "Variant") as MatrixTableRow["role"],
        })),
      ];
      return items.filter((row) =>
        !query
          ? true
          : row.keyword.toLowerCase().includes(query) ||
            row.subCategory.toLowerCase().includes(query) ||
            row.recommendedSchema.toLowerCase().includes(query)
      );
    }

    return keywords
      .filter((k) => selectedCategory === "all" || k.category === selectedCategory)
      .filter(matchesQuery)
      .map((kw) => ({
        id: kw.id,
        keyword: kw.keyword,
        subCategory: kw.subCategory,
        category: kw.category,
        searchIntent: kw.searchIntent,
        searchVolumeTier: kw.searchVolumeTier,
        targetPageType: kw.targetPageType,
        recommendedSchema: kw.recommendedSchema,
        cpcValue: kw.cpcEstimate.value,
        geoEngines: kw.geoEngineRelevance,
      }));
  }, [view, activeCluster, keywords, selectedCategory, searchQuery]);

  const columns: ColumnDef<MatrixTableRow, unknown>[] = useMemo(
    () => [
      {
        accessorKey: "keyword",
        header: "Keyword formula",
        cell: ({ row }) => (
          <div className="min-w-[220px] space-y-0.5 py-0.5">
            <div className="font-mono text-caption font-medium text-text">{row.original.keyword}</div>
            <div className="text-caption text-text-muted">{row.original.subCategory}</div>
          </div>
        ),
      },
      {
        accessorKey: view === "clusters" ? "role" : "category",
        header: view === "clusters" ? "Cluster role" : "Category",
        cell: ({ row }) =>
          view === "clusters" && row.original.role ? (
            <Badge variant={roleBadgeVariant(row.original.role)}>{row.original.role}</Badge>
          ) : (
            <span className="text-caption text-text">{row.original.category}</span>
          ),
      },
      {
        accessorKey: "searchIntent",
        header: "Intent",
        cell: ({ row }) => (
          <Badge variant={intentBadgeVariant(row.original.searchIntent)}>
            {row.original.searchIntent}
          </Badge>
        ),
      },
      {
        accessorKey: "targetPageType",
        header: "Target page",
        cell: ({ row }) => (
          <span className="text-caption font-medium text-text">{row.original.targetPageType}</span>
        ),
      },
      {
        accessorKey: "recommendedSchema",
        header: "Schema",
        cell: ({ row }) => (
          <code className="rounded-sm bg-surface-2 px-1.5 py-0.5 font-mono text-caption text-text">
            {row.original.recommendedSchema}
          </code>
        ),
      },
      {
        accessorKey: "searchVolumeTier",
        header: "Volume band",
        cell: ({ row }) => (
          <span className="text-caption text-text-muted">{row.original.searchVolumeTier}</span>
        ),
      },
      {
        accessorKey: "cpcValue",
        header: "Illustrative CPC",
        cell: ({ row }) => (
          <span className="font-mono text-caption tabular-nums text-text">
            {row.original.cpcValue}
          </span>
        ),
      },
    ],
    [view]
  );

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Badge variant="notice">
          {pack.name} Dataset · {meta.totalKeywords} query formulas
        </Badge>
        <h2 className="text-title text-text">
          {meta.totalKeywords}-Keyword Search &amp; GEO Strategy Matrix
        </h2>
        <p className="max-w-[72ch] text-body text-text-muted">
          {pack.description} Six funnel categories and {targetPageTypes.size} target page types ready to map onto client architecture.
        </p>
      </header>

      <div data-testid="dataset-disclaimer">
        <InlineAlert
          variant="warning"
          title="About this dataset"
          description={
            "{{placeholder}} tokens inside keyword formulas (for example {{topic}} or {{brandName}}) are variables resolved by the template engine when you customize a template — they are not live content on this page. searchVolumeTier and cpcEstimate values are illustrative planning bands authored with this pack, not measured search data. This page makes no traffic, ranking, or volume claims." +
            (meta.notes ? ` ${meta.notes}` : "")
          }
        />
      </div>

      {view === "clusters" ? (
        <div className="space-y-4">
          <p className="max-w-[72ch] text-caption text-text-muted">
            One table per target page. The primary keyword is the cluster&apos;s highest illustrative volume tier (ties broken deterministically by row id); variants sharing the primary&apos;s schema or intent are flagged as overlapping so two rows never compete for one page.
          </p>

          <FilterTabs
            options={clusterOptions}
            value={activeCluster?.targetPageType ?? ""}
            onChange={setSelectedCluster}
            layoutId="strategy-matrix-clusters"
          />

          {activeCluster && (
            <Card className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div>
                  <h3 className="text-heading text-text">{activeCluster.targetPageType}</h3>
                  <p className="text-caption text-text-muted">
                    {1 + activeCluster.variants.length} keywords · 1 primary
                  </p>
                </div>
                <Badge variant="brand">Primary: {activeCluster.primary.keyword}</Badge>
              </div>

              <DataTable
                data={tableRows}
                columns={columns}
                pageSize={20}
                getRowId={(r) => r.id}
                toolbar={
                  <div className="relative w-full max-w-xs">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle"
                      aria-hidden="true"
                    />
                    <Input
                      type="text"
                      aria-label="Filter cluster keywords"
                      placeholder="Filter keywords or schema..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                }
              />
            </Card>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((cat) => (
              <KpiTile
                key={cat}
                label={cat}
                value={keywords.filter((k) => k.category === cat).length}
                suffix=" rows"
              />
            ))}
          </div>

          <FilterTabs
            options={categoryOptions}
            value={selectedCategory}
            onChange={setSelectedCategory}
            layoutId="strategy-matrix-categories"
          />

          <DataTable
            data={tableRows}
            columns={columns}
            pageSize={15}
            getRowId={(r) => r.id}
            toolbar={
              <div className="relative w-full max-w-xs">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle"
                  aria-hidden="true"
                />
                <Input
                  type="text"
                  aria-label="Filter matrix keywords"
                  placeholder="Search formula, page type, or schema..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            }
          />
        </div>
      )}
    </div>
  );
}
