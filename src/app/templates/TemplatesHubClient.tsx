"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { CATEGORIES, TEMPLATES_DATA, type SeoTemplate } from "@/data/templates";

export function TemplatesHubClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");

  const filteredTemplates = useMemo(() => {
    return TEMPLATES_DATA.filter((tmpl) => {
      const matchesCategory =
        selectedCategory === "all" || tmpl.categorySlug === selectedCategory;
      const matchesDifficulty =
        selectedDifficulty === "all" || tmpl.difficulty.toLowerCase() === selectedDifficulty.toLowerCase();
      const query = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !query ||
        tmpl.title.toLowerCase().includes(query) ||
        tmpl.category.toLowerCase().includes(query) ||
        tmpl.metaDescription.toLowerCase().includes(query) ||
        tmpl.directAnswer.toLowerCase().includes(query) ||
        tmpl.checklist.some((c) => c.task.toLowerCase().includes(query));

      return matchesCategory && matchesDifficulty && matchesQuery;
    });
  }, [searchQuery, selectedCategory, selectedDifficulty]);

  return (
    <div className="space-y-8">
      {/* Search & Filter Controls Bar */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Instant Search Bar */}
          <div className="relative flex-1">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search 12 templates by keyword, audit task, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Clear
              </button>
            )}
          </div>

          {/* Difficulty Dropdown */}
          <div className="flex shrink-0 items-center gap-2">
            <label htmlFor="difficulty-select" className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Difficulty:
            </label>
            <select
              id="difficulty-select"
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All Difficulties</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>

        {/* Category Filter Pills */}
        <nav aria-label="Category Filters" className="mt-5 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              selectedCategory === "all"
                ? "bg-slate-900 text-brand-light shadow-sm dark:bg-brand dark:text-slate-950"
                : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-white hover:text-slate-900 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            All Templates ({TEMPLATES_DATA.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = TEMPLATES_DATA.filter((t) => t.categorySlug === cat.slug).length;
            const isActive = selectedCategory === cat.slug;
            return (
              <button
                key={cat.slug}
                type="button"
                onClick={() => setSelectedCategory(cat.slug)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "bg-slate-900 text-brand-light shadow-sm dark:bg-brand dark:text-slate-950"
                    : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-white hover:text-slate-900 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </nav>
      </section>

      {/* Results Readout */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>
          Showing <strong className="text-slate-900 dark:text-white">{filteredTemplates.length}</strong> of{" "}
          {TEMPLATES_DATA.length} templates
        </span>
        {searchQuery && (
          <span>
            Query filter: &ldquo;{searchQuery}&rdquo;
          </span>
        )}
      </div>

      {/* Template Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((tmpl) => (
          <article
            key={tmpl.id}
            id={tmpl.slug}
            className="card-hover flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-card transition hover:border-brand dark:border-slate-800 dark:bg-slate-900"
          >
            <div>
              {/* Header: Category & Difficulty Badge */}
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {tmpl.category}
                </span>

                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    tmpl.difficulty === "Beginner"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : tmpl.difficulty === "Intermediate"
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                      : "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
                  }`}
                >
                  {tmpl.difficulty}
                </span>
              </div>

              {/* Title & Description */}
              <h3 className="mt-3 font-display text-base font-bold text-slate-900 dark:text-white line-clamp-2">
                {tmpl.title}
              </h3>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                {tmpl.metaDescription}
              </p>

              {/* Direct Answer Preview */}
              <div className="mt-3.5 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 dark:border-slate-800/80 dark:bg-slate-950/40">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Key Takeaway
                </div>
                <p className="mt-1 text-[11px] text-slate-700 dark:text-slate-300 line-clamp-3">
                  {tmpl.directAnswer}
                </p>
              </div>

              {/* Checklists & Metrics */}
              <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>{tmpl.checklist.length} Action Tasks</span>
                <span>Est. {tmpl.estimatedTime}</span>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="mt-5 border-t border-slate-100 pt-3.5 dark:border-slate-800">
              <Link
                href={`/templates/${tmpl.categorySlug}/${tmpl.slug}`}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-brand-dark dark:bg-brand dark:text-slate-950 dark:hover:bg-brand-light"
              >
                Use Template &amp; Customize &rarr;
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
