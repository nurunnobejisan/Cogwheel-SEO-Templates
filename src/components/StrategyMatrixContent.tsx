import type { KeywordStrategyMatrix, KeywordItem } from "../schemas/validation";
import { validateKeywordMatrix } from "../schemas/validation";
import { DEFAULT_PACK_ID, getPackMeta, type PackMeta } from "../packs/catalog";
import { clusterByTargetPageType } from "../packs/clusters";
import hotelMatrixJson from "../packs/hotel/keywords.json";

/**
 * Defaults keep the original callers (LabsView's dynamic import) working with
 * the canonical hotel dataset — the same JSON this component always shipped.
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

function KeywordCard({
  kw,
  badge,
  highlight = false,
}: {
  kw: KeywordItem;
  badge?: string;
  highlight?: boolean;
}) {
  return (
    <article
      className={`card-hover flex flex-col justify-between rounded-2xl border p-4 shadow-card ${
        highlight
          ? "border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/30"
          : "border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900"
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-1 text-micro">
          <span className="font-mono text-slate-400 dark:text-slate-500">{kw.id}</span>
          <span className="flex items-center gap-1">
            {badge && (
              <span
                className={`rounded px-1.5 py-0.5 font-bold ${
                  highlight
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
                    : "bg-sky-50 font-bold text-sky-700 dark:bg-sky-950/60 dark:text-sky-300"
                }`}
              >
                {badge}
              </span>
            )}
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              {kw.searchIntent}
            </span>
          </span>
        </div>

        <h4 className="mt-2 font-mono text-caption font-bold text-slate-900 dark:text-white">
          {kw.keyword}
        </h4>
        <p className="mt-1 text-tiny text-slate-500 dark:text-slate-400">{kw.subCategory}</p>

        <div className="mt-3 space-y-1.5 rounded-lg bg-slate-50 p-2.5 text-tiny dark:bg-slate-950/40">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
            <span>Target Page:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {kw.targetPageType}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
            <span>Recommended Schema:</span>
            <span className="font-mono text-micro text-brand-dark dark:text-brand">
              {kw.recommendedSchema}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
            <span>Est. CPC:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {kw.cpcEstimate.value}
              <span className="ml-1 text-slate-400 dark:text-slate-500">(illustrative)</span>
            </span>
          </div>
        </div>

        {kw.targetEntityPrompt && (
          <div className="mt-2.5 text-micro italic text-slate-500 dark:text-slate-400">
            &ldquo;{kw.targetEntityPrompt}&rdquo;
          </div>
        )}
      </div>

      <div className="mt-3 border-t border-slate-100 pt-2 text-micro text-slate-400 dark:border-slate-800">
        Engines: {kw.geoEngineRelevance.slice(0, 3).join(", ")}
      </div>
    </article>
  );
}

/**
 * Pack-driven strategy matrix body (docs/TASKS.md Tasks 4.1–4.4): renders a
 * pack's 78-row dataset with an honest disclaimer, either grouped by funnel
 * category or clustered by target page with one primary keyword per cluster.
 */
export function StrategyMatrixContent({
  matrix = DEFAULT_MATRIX,
  pack = DEFAULT_PACK,
  view = "funnel",
}: StrategyMatrixContentProps) {
  const { metadata: meta, categories, keywords } = matrix;
  const targetPageTypes = new Set(keywords.map((k) => k.targetPageType));
  const clusters = view === "clusters" ? clusterByTargetPageType(keywords) : [];

  return (
    <div className="space-y-8">
      {/* Badge + Title — adapts to the selected vertical (Task 4.2) */}
      <header className="space-y-2">
        <span className="inline-block rounded-md bg-blue-50 px-2 py-0.5 text-micro font-bold text-blue-700 uppercase tracking-wider dark:bg-blue-950/60 dark:text-blue-300">
          {pack.name} Dataset &bull; {meta.totalKeywords} Targeted Query Formulas
        </span>
        <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
          {meta.totalKeywords}-Keyword Search &amp; GEO Strategy Matrix
        </h2>
        <p className="max-w-3xl text-body text-slate-600 dark:text-slate-400">
          {pack.description} Six funnel categories and {targetPageTypes.size} target page
          types, ready to map onto your own pages.
        </p>
      </header>

      {/* Explanatory disclaimer (Task 4.4) */}
      <div
        data-testid="dataset-disclaimer"
        className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-tiny text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
      >
        <p className="font-bold">About this dataset</p>
        <p className="mt-1">
          <code className="font-mono">{"{{placeholder}}"}</code> tokens inside keyword
          formulas (for example <code className="font-mono">{"{{topic}}"}</code> or{" "}
          <code className="font-mono">{"{{brandName}}"}</code>) are variables resolved by
          the template engine when you customize a template — they are not live content on
          this page.
        </p>
        <p className="mt-1">
          <code className="font-mono">searchVolumeTier</code> and{" "}
          <code className="font-mono">cpcEstimate</code> values are illustrative planning
          bands authored with this pack, not measured search data. This page makes no
          traffic, ranking or volume claims.
        </p>
        {meta.notes && <p className="mt-1">{meta.notes}</p>}
      </div>

      {view === "clusters" ? (
        <>
          {/* Target-page cluster view (Task 4.3) */}
          <p className="max-w-3xl text-tiny text-slate-500 dark:text-slate-400">
            One section per target page. The primary keyword is the cluster&apos;s highest
            illustrative volume tier (ties broken by row id — deterministic ordering, not a
            measurement); variants sharing the primary&apos;s schema or intent are flagged
            as overlapping so two rows never fight over one page.
          </p>
          <div className="space-y-10">
            {clusters.map((cluster) => (
              <section key={cluster.targetPageType} className="space-y-4">
                <header className="flex items-center justify-between border-b border-slate-200 pb-2 dark:border-slate-800">
                  <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    {cluster.targetPageType}{" "}
                    <span className="text-caption font-normal text-slate-500">
                      ({1 + cluster.variants.length} keywords &rarr; 1 primary)
                    </span>
                  </h3>
                </header>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <KeywordCard kw={cluster.primary} badge="Primary" />
                  {cluster.variants.map((variant) => (
                    <KeywordCard
                      key={variant.keyword.id}
                      kw={variant.keyword}
                      badge={variant.overlapsPrimary ? "Overlaps primary" : "Variant"}
                      highlight={variant.overlapsPrimary}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Category Summary KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((cat) => (
              <div
                key={cat}
                className="rounded-xl border border-slate-200/80 bg-white p-3 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="truncate text-micro font-semibold text-slate-500 dark:text-slate-400">
                  {cat}
                </div>
                <div className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-white">
                  {keywords.filter((k) => k.category === cat).length} Keywords
                </div>
              </div>
            ))}
          </div>

          {/* Categories Section */}
          <div className="space-y-10">
            {categories.map((category) => {
              const catKeywords = keywords.filter((k) => k.category === category);
              return (
                <section key={category} className="space-y-4">
                  <header className="flex items-center justify-between border-b border-slate-200 pb-2 dark:border-slate-800">
                    <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                      {category}{" "}
                      <span className="text-caption font-normal text-slate-500">
                        ({catKeywords.length} targets)
                      </span>
                    </h3>
                  </header>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {catKeywords.map((kw) => (
                      <KeywordCard key={kw.id} kw={kw} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
