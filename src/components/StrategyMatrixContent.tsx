import matrixData from "../packs/hotel/keywords.json";

export function StrategyMatrixContent() {
  const { metadata: meta, categories, keywords } = matrixData;

  return (
    <div className="space-y-8">
      {/* Badge + Title */}
      <header className="space-y-2">
        <span className="inline-block rounded-md bg-blue-50 px-2 py-0.5 text-micro font-bold text-blue-700 uppercase tracking-wider dark:bg-blue-950/60 dark:text-blue-300">
          Canonical Hospitality Dataset &bull; {meta.totalKeywords} Targeted Query Formulas
        </span>
        <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
          78-Keyword Search &amp; GEO Strategy Matrix
        </h2>
        <p className="max-w-3xl text-body text-slate-600 dark:text-slate-400">
          Engineered across 6 distinct hospitality purchase funnel stages to dominate high-intent branded
          reservations, local districts, airport layovers, weddings, extended stays, and generative AI
          conversational queries.
        </p>
      </header>

      {/* Category Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {categories.map((cat) => (
          <div
            key={cat}
            className="rounded-xl border border-slate-200/80 bg-white p-3 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="truncate text-micro font-semibold text-slate-500 dark:text-slate-400">{cat}</div>
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
                  <span className="text-caption font-normal text-slate-500">({catKeywords.length} targets)</span>
                </h3>
              </header>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {catKeywords.map((kw) => (
                  <article
                    key={kw.id}
                    className="card-hover flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 text-micro">
                        <span className="font-mono text-slate-400 dark:text-slate-500">{kw.id}</span>
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {kw.searchIntent}
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
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
