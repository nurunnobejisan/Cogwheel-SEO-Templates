"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { CATEGORIES, TEMPLATES_DATA } from "@/packs/hotel/templates";

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
      <section className="rounded border border-border bg-surface p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search 12 templates by keyword, audit task, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-sm border border-border-strong bg-surface-2 px-3.5 text-body text-text placeholder:text-text-subtle focus:border-brand focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-caption text-text-muted hover:text-text"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <label htmlFor="difficulty-select" className="text-caption font-medium text-text-muted">
              Difficulty:
            </label>
            <select
              id="difficulty-select"
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="h-10 rounded-sm border border-border-strong bg-surface px-3 text-caption font-medium text-text focus:border-brand focus:outline-none"
            >
              <option value="all">All Difficulties</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>

        <nav aria-label="Category Filters" className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`rounded-sm px-3 py-1.5 text-caption font-medium transition-colors ${
              selectedCategory === "all"
                ? "bg-sidebar text-sidebar-text"
                : "border border-border bg-surface-2 text-text-muted hover:text-text"
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
                className={`rounded-sm px-3 py-1.5 text-caption font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar text-sidebar-text"
                    : "border border-border bg-surface-2 text-text-muted hover:text-text"
                }`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </nav>
      </section>

      <div className="flex items-center justify-between text-caption text-text-muted">
        <span>
          Showing <strong className="text-text">{filteredTemplates.length}</strong> of{" "}
          {TEMPLATES_DATA.length} templates
        </span>
        {searchQuery && <span>Query filter: &ldquo;{searchQuery}&rdquo;</span>}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((tmpl) => (
          <article
            key={tmpl.id}
            id={tmpl.slug}
            className="surface-card flex flex-col justify-between p-5 transition-colors hover:border-border-strong"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-sm bg-surface-2 px-2 py-0.5 text-caption font-medium text-text-muted">
                  {tmpl.category}
                </span>
                <span
                  className={`rounded-sm px-2 py-0.5 text-caption font-medium ${
                    tmpl.difficulty === "Beginner"
                      ? "bg-success-soft text-success-fg"
                      : tmpl.difficulty === "Intermediate"
                      ? "bg-notice-soft text-notice-fg"
                      : "bg-warning-soft text-warning-fg"
                  }`}
                >
                  {tmpl.difficulty}
                </span>
              </div>

              <h3 className="mt-3 text-heading text-text line-clamp-2">{tmpl.title}</h3>
              <p className="mt-1 text-caption text-text-muted line-clamp-2">{tmpl.metaDescription}</p>

              <div className="mt-3.5 rounded-sm border border-border bg-surface-2 p-2.5">
                <div className="text-overline uppercase text-text-muted">Key Takeaway</div>
                <p className="mt-1 text-caption text-text line-clamp-3">{tmpl.directAnswer}</p>
              </div>

              <div className="mt-4 flex items-center justify-between text-caption text-text-muted">
                <span>{tmpl.checklist.length} Action Tasks</span>
                <span>Est. {tmpl.estimatedTime}</span>
              </div>
            </div>

            <div className="mt-5 border-t border-border pt-3.5">
              <Link
                href={`/templates/${tmpl.categorySlug}/${tmpl.slug}`}
                className="flex h-9 w-full items-center justify-center gap-1.5 rounded-sm border border-border bg-surface-2 px-4 text-caption font-medium text-text transition-colors hover:border-border-strong"
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
