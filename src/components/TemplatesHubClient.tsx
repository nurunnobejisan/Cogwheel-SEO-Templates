"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { CATEGORIES, TEMPLATES_DATA, type SeoTemplate } from "@/packs/hotel/templates";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/index";
import { cn } from "@/lib/utils";

const DIFFICULTIES = [
  { id: "all", label: "All difficulties" },
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
] as const;

function difficultyVariant(difficulty: SeoTemplate["difficulty"]): "success" | "notice" | "warning" {
  if (difficulty === "Beginner") return "success";
  if (difficulty === "Intermediate") return "notice";
  return "warning";
}

interface FilterRailProps {
  selectedCategory: string;
  selectedDifficulty: string;
  onSelectCategory: (slug: string) => void;
  onSelectDifficulty: (diff: string) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
}

function FilterRail({
  selectedCategory,
  selectedDifficulty,
  onSelectCategory,
  onSelectDifficulty,
  onReset,
  hasActiveFilters,
}: FilterRailProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-overline uppercase text-text-muted">Categories</span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 text-caption font-medium text-link hover:underline"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              Reset
            </button>
          )}
        </div>
        <nav aria-label="Category Filters" className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => onSelectCategory("all")}
            className={cn(
              "flex items-center justify-between rounded-sm px-2.5 py-2 text-left text-caption font-medium transition-colors",
              selectedCategory === "all"
                ? "bg-sidebar text-sidebar-text"
                : "text-text-muted hover:bg-surface-2 hover:text-text"
            )}
          >
            <span>All templates</span>
            <span className="font-mono text-caption tabular-nums">{TEMPLATES_DATA.length}</span>
          </button>
          {CATEGORIES.map((cat) => {
            const count = TEMPLATES_DATA.filter((t) => t.categorySlug === cat.slug).length;
            const active = selectedCategory === cat.slug;
            return (
              <button
                key={cat.slug}
                type="button"
                onClick={() => onSelectCategory(cat.slug)}
                className={cn(
                  "flex items-center justify-between rounded-sm px-2.5 py-2 text-left text-caption font-medium transition-colors",
                  active
                    ? "bg-sidebar text-sidebar-text"
                    : "text-text-muted hover:bg-surface-2 hover:text-text"
                )}
              >
                <span className="truncate pr-2">{cat.name}</span>
                <span className="font-mono text-caption tabular-nums">{count}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <span className="block text-overline uppercase text-text-muted">Difficulty</span>
        <div className="flex flex-col gap-1">
          {DIFFICULTIES.map((diff) => {
            const active = selectedDifficulty === diff.id;
            return (
              <button
                key={diff.id}
                type="button"
                onClick={() => onSelectDifficulty(diff.id)}
                className={cn(
                  "flex items-center justify-between rounded-sm px-2.5 py-1.5 text-left text-caption font-medium transition-colors",
                  active
                    ? "bg-surface-2 font-semibold text-text ring-1 ring-border-strong"
                    : "text-text-muted hover:bg-surface-2 hover:text-text"
                )}
              >
                <span>{diff.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Interactive SEO & GEO template catalog with desktop left filter rail,
 * mobile drawer filters, search, and secondary CTA cards.
 */
export function TemplatesHubClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return TEMPLATES_DATA.filter((tmpl) => {
      const matchesCategory =
        selectedCategory === "all" || tmpl.categorySlug === selectedCategory;
      const matchesDifficulty =
        selectedDifficulty === "all" ||
        tmpl.difficulty.toLowerCase() === selectedDifficulty.toLowerCase();
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

  const hasActiveFilters =
    selectedCategory !== "all" || selectedDifficulty !== "all" || searchQuery.trim() !== "";

  const activeFilterCount =
    (selectedCategory !== "all" ? 1 : 0) + (selectedDifficulty !== "all" ? 1 : 0);

  const resetAll = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedDifficulty("all");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
      {/* Desktop Left Filter Column */}
      <aside
        aria-label="Template catalog filters"
        className="hidden rounded border border-border bg-surface p-4 lg:sticky lg:top-20 lg:block"
      >
        <FilterRail
          selectedCategory={selectedCategory}
          selectedDifficulty={selectedDifficulty}
          onSelectCategory={setSelectedCategory}
          onSelectDifficulty={setSelectedDifficulty}
          onReset={resetAll}
          hasActiveFilters={hasActiveFilters}
        />
      </aside>

      {/* Main Catalog Column */}
      <div className="min-w-0 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle"
              aria-hidden="true"
            />
            <Input
              type="text"
              aria-label="Search templates"
              placeholder="Search 12 templates by keyword, audit task, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-16"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-caption font-medium text-text-muted hover:text-text"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 lg:hidden">
            <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="secondary" size="md" type="button">
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                  <span>Filters</span>
                  {activeFilterCount > 0 && (
                    <Badge variant="brand" className="ml-0.5">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Filter templates</SheetTitle>
                  <SheetDescription>Narrow blueprints by category or difficulty.</SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto p-5">
                  <FilterRail
                    selectedCategory={selectedCategory}
                    selectedDifficulty={selectedDifficulty}
                    onSelectCategory={(slug) => {
                      setSelectedCategory(slug);
                      setMobileFiltersOpen(false);
                    }}
                    onSelectDifficulty={(diff) => {
                      setSelectedDifficulty(diff);
                      setMobileFiltersOpen(false);
                    }}
                    onReset={() => {
                      resetAll();
                      setMobileFiltersOpen(false);
                    }}
                    hasActiveFilters={hasActiveFilters}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-caption text-text-muted">
          <span>
            Showing <strong className="font-semibold text-text tabular-nums">{filteredTemplates.length}</strong> of{" "}
            <span className="tabular-nums">{TEMPLATES_DATA.length}</span> templates
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetAll}
              className="text-caption font-medium text-link hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {filteredTemplates.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-body font-medium text-text">No templates match the current filters</p>
            <p className="mt-1 text-caption text-text-muted">
              Reset the search query or switch category to view all 12 blueprints.
            </p>
            <div className="mt-4">
              <Button variant="secondary" size="sm" onClick={resetAll}>
                Show all templates
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredTemplates.map((tmpl) => (
              <Card
                key={tmpl.id}
                id={tmpl.slug}
                className="flex flex-col justify-between transition-colors hover:border-border-strong"
              >
                <CardHeader className="space-y-2.5 pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="neutral">{tmpl.category}</Badge>
                    <Badge variant={difficultyVariant(tmpl.difficulty)}>{tmpl.difficulty}</Badge>
                  </div>
                  <h3 className="text-heading text-text line-clamp-2">{tmpl.title}</h3>
                </CardHeader>

                <CardContent className="space-y-3 pt-0">
                  <p className="text-caption text-text-muted line-clamp-2">{tmpl.metaDescription}</p>
                  <div className="rounded-sm border border-border bg-surface-2 p-2.5">
                    <div className="text-overline uppercase text-text-muted">Direct answer</div>
                    <p className="mt-1 text-caption text-text line-clamp-3">{tmpl.directAnswer}</p>
                  </div>
                  <div className="flex items-center justify-between text-caption text-text-muted tabular-nums">
                    <span>{tmpl.checklist.length} action tasks</span>
                    <span>Est. {tmpl.estimatedTime}</span>
                  </div>
                </CardContent>

                <CardFooter className="border-t border-border pt-3">
                  <Button variant="secondary" size="sm" className="w-full" asChild>
                    <Link href={`/templates/${tmpl.categorySlug}/${tmpl.slug}`}>
                      <span>Use template</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
