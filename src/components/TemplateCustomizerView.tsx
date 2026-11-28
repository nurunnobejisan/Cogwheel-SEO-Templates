"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bookmark, Check, Copy, Download, Monitor, Printer, RotateCcw, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { type SeoTemplate, type TemplateVariables } from "@/packs/hotel/templates";
import {
  getMetaDescPixelStatus,
  getTitlePixelStatus,
  META_DESC_PIXEL_LIMIT,
  TITLE_PIXEL_LIMIT,
} from "@/engine/pixelCalculator";
import {
  resolveTemplate,
  type ResolutionResult,
  type TemplateSchema,
} from "../../validators/variableResolver";
import { escapeHtml } from "../../validators/xssProtection";
import { renderBracketTokens } from "../../shared/ts/template-render";
import { InlineAlert } from "@/components/data/index";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/index";
import { cn } from "@/lib/utils";

/**
 * Schema every customizer render validates against: all five catalog variables
 * are required for a complete export — clearing any field surfaces it in the audit.
 */
const CUSTOMIZER_SCHEMA: TemplateSchema = {
  id: "template-customizer",
  name: "Template Customizer",
  variables: {
    brandName: { name: "brandName", required: true, description: "Property / brand name" },
    primaryKeyword: { name: "primaryKeyword", required: true, description: "Primary keyword" },
    targetUrl: { name: "targetUrl", required: true, description: "Target URL" },
    locationNiche: { name: "locationNiche", required: true, description: "Location / niche" },
    competitorDomain: { name: "competitorDomain", required: true, description: "Competitor domain" },
  },
};

/** RFC-4180 field: wrap in quotes, double embedded quotes. */
export function csvEscapeField(value: string): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

/**
 * Clipboard-ready HTML for customizer export. Every interpolated field passes
 * through `escapeHtml`.
 */
export function buildCustomizerExportHtml(title: string, description: string, markdown: string): string {
  return `<article>\n  <h1>${escapeHtml(title)}</h1>\n  <p>${escapeHtml(description)}</p>\n  <hr/>\n  <pre>${escapeHtml(markdown)}</pre>\n</article>`;
}

interface Props {
  template: SeoTemplate;
  relatedTemplates: SeoTemplate[];
}

export function TemplateCustomizerView({ template, relatedTemplates }: Props) {
  const [vars, setVars] = useState<TemplateVariables>({ ...template.defaultVariables });
  const [activeTab, setActiveTab] = useState<"customizer" | "serp" | "schema" | "mistakes">("customizer");
  const [serpMode, setSerpMode] = useState<"desktop" | "mobile">("desktop");
  const [checkedTasks, setCheckedTasks] = useState<Record<string, boolean>>({});
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    try {
      const storedProgress = localStorage.getItem(`seo-studio_progress_${template.id}`);
      if (storedProgress) {
        setCheckedTasks(JSON.parse(storedProgress));
      }
      const storedBookmarks = localStorage.getItem("seo_studio_bookmarks");
      if (storedBookmarks) {
        const bookmarks: string[] = JSON.parse(storedBookmarks);
        setIsBookmarked(bookmarks.includes(template.id));
      }
    } catch {
      // Ignore storage access errors in restricted modes
    }
  }, [template.id]);

  const toggleTask = (taskId: string) => {
    setCheckedTasks((prev) => {
      const updated = { ...prev, [taskId]: !prev[taskId] };
      try {
        localStorage.setItem(`seo-studio_progress_${template.id}`, JSON.stringify(updated));
      } catch {
        // Ignore storage errors
      }
      return updated;
    });
  };

  const toggleBookmark = () => {
    try {
      const stored = localStorage.getItem("seo_studio_bookmarks");
      let list: string[] = stored ? JSON.parse(stored) : [];
      if (list.includes(template.id)) {
        list = list.filter((id) => id !== template.id);
        setIsBookmarked(false);
        toast.info("Removed from saved templates");
      } else {
        list.push(template.id);
        setIsBookmarked(true);
        toast.success("Template saved to bookmarks");
      }
      localStorage.setItem("seo_studio_bookmarks", JSON.stringify(list));
    } catch {
      toast.error("Unable to access browser storage");
    }
  };

  const renderText = useCallback(
    (text: string): ResolutionResult => {
      if (!text) {
        return { success: true, output: "", missingVariables: [], unresolvedPlaceholders: [], warnings: [] };
      }
      const bracketed = renderBracketTokens(text, {
        "[Brand Name]": vars.brandName || "[Brand Name]",
        "[Primary Keyword]": vars.primaryKeyword || "[Primary Keyword]",
        "[Target URL]": vars.targetUrl || "[Target URL]",
        "[Location/Niche]": vars.locationNiche || "[Location/Niche]",
        "[LocationNiche]": vars.locationNiche || "[Location/Niche]",
        "[Competitor Domain]": vars.competitorDomain || "[Competitor Domain]",
      });
      return resolveTemplate(bracketed, CUSTOMIZER_SCHEMA, { ...vars }, { strict: false });
    },
    [vars]
  );

  const customizedTitle = useMemo(() => {
    return `${vars.brandName} — ${vars.primaryKeyword} in ${vars.locationNiche}`;
  }, [vars.brandName, vars.primaryKeyword, vars.locationNiche]);

  const customizedDesc = useMemo(() => {
    return `Discover luxury at ${vars.brandName}. Book direct for ${vars.primaryKeyword} in ${vars.locationNiche} with waterfront views, verified reviews, and best rates at ${vars.targetUrl}.`;
  }, [vars.brandName, vars.primaryKeyword, vars.locationNiche, vars.targetUrl]);

  const titlePixel = useMemo(() => getTitlePixelStatus(customizedTitle), [customizedTitle]);
  const descPixel = useMemo(() => getMetaDescPixelStatus(customizedDesc), [customizedDesc]);

  const markdownResolution = useMemo(
    () => renderText(template.contentMarkdown),
    [template.contentMarkdown, renderText]
  );
  const customizedMarkdown = markdownResolution.output;

  const dynamicSchema = useMemo(() => {
    const baseUrl = vars.targetUrl || "https://www.example.com";
    if (template.schemaType === "Hotel") {
      return {
        "@context": "https://schema.org",
        "@type": "Hotel",
        name: vars.brandName,
        url: baseUrl,
        description: customizedDesc,
        address: {
          "@type": "PostalAddress",
          addressLocality: vars.locationNiche,
        },
        amenityFeature: [
          { "@type": "LocationFeatureSpecification", name: "High-Speed Wi-Fi", value: true },
          { "@type": "LocationFeatureSpecification", name: "Valet Parking", value: true },
        ],
      };
    }
    if (template.schemaType === "LocalBusiness") {
      return {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: vars.brandName,
        url: baseUrl,
        description: customizedDesc,
        telephone: "+1-800-555-0199",
        areaServed: vars.locationNiche,
      };
    }
    if (template.schemaType === "FAQPage") {
      return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: `What makes ${vars.brandName} the premier ${vars.primaryKeyword} in ${vars.locationNiche}?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `${vars.brandName} delivers authentic hospitality, luxury amenities, and prime central access in ${vars.locationNiche}. Direct bookings receive guaranteed rates at ${vars.targetUrl}.`,
            },
          },
        ],
      };
    }
    return {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: customizedTitle,
      description: customizedDesc,
      author: {
        "@type": "Organization",
        name: vars.brandName,
      },
      publisher: {
        "@type": "Organization",
        name: "SEO Studio",
        url: baseUrl,
      },
    };
  }, [vars, customizedTitle, customizedDesc, template.schemaType]);

  const schemaString = useMemo(() => JSON.stringify(dynamicSchema, null, 2), [dynamicSchema]);

  const handleCopyMarkdown = () => {
    void navigator.clipboard.writeText(customizedMarkdown);
    toast.success("Markdown copied to clipboard");
  };

  const handleCopyHtml = () => {
    const html = buildCustomizerExportHtml(customizedTitle, customizedDesc, customizedMarkdown);
    void navigator.clipboard.writeText(html);
    toast.success("Clean HTML copied to clipboard");
  };

  const handleCopySchema = () => {
    void navigator.clipboard.writeText(schemaString);
    toast.success("JSON-LD schema copied to clipboard");
  };

  const handleDownloadCsv = () => {
    const headers = "ID,Task,Priority,Status,Description\n";
    const rows = template.checklist
      .map((c) =>
        [
          c.id,
          renderText(c.task).output,
          c.priority,
          checkedTasks[c.id] ? "Completed" : "Pending",
          renderText(c.description).output,
        ]
          .map(csvEscapeField)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${template.slug}-checklist.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Checklist CSV downloaded");
  };

  const handleDownloadJson = () => {
    const payload = {
      templateId: template.id,
      title: customizedTitle,
      variables: vars,
      checklist: template.checklist.map((c) => ({
        ...c,
        completed: Boolean(checkedTasks[c.id]),
      })),
      schema: dynamicSchema,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${template.slug}-config.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("JSON configuration downloaded");
  };

  const completedCount = template.checklist.filter((c) => checkedTasks[c.id]).length;
  const progressPercent = Math.round((completedCount / template.checklist.length) * 100);

  return (
    <div className="space-y-6">
      {/* Export Bar & Progress Header */}
      <Card id="export-bar" className="print:hidden p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={cn(isBookmarked && "border-warning/40 bg-warning-soft text-warning-fg hover:bg-warning-soft")}
              onClick={toggleBookmark}
            >
              <Bookmark className={cn("h-3.5 w-3.5", isBookmarked && "fill-current text-warning-fg")} aria-hidden="true" />
              <span>{isBookmarked ? "Bookmarked" : "Save template"}</span>
            </Button>

            <div className="flex items-center gap-2 text-caption text-text-muted">
              <span className="font-medium text-text">Progress</span>
              <div className="h-2 w-24 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full bg-success transition-all duration-fast"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="font-mono tabular-nums text-text">
                {completedCount}/{template.checklist.length}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={handleCopyMarkdown}>
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              Copy Markdown
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={handleCopyHtml}>
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              Copy HTML
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={handleDownloadCsv}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              CSV
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={handleDownloadJson}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              JSON
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              Print / PDF
            </Button>
          </div>
        </div>
      </Card>

      {/* Dynamic Variable Customizer */}
      <Card id="variable-customizer" className="print:hidden">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
          <div>
            <CardTitle className="text-heading">Dynamic variable customizer</CardTitle>
            <CardDescription>
              Type property details below to update blueprint copy, checklist tasks, and SERP pixel widths in real time.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setVars({ ...template.defaultVariables })}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset defaults
          </Button>
        </CardHeader>

        <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <label htmlFor="var-brandName" className="text-caption font-medium text-text">
              [Brand Name]
            </label>
            <Input
              id="var-brandName"
              type="text"
              value={vars.brandName}
              onChange={(e) => setVars((v) => ({ ...v, brandName: e.target.value }))}
              placeholder="e.g. Ocean Palms Resort"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="var-primaryKeyword" className="text-caption font-medium text-text">
              [Primary Keyword]
            </label>
            <Input
              id="var-primaryKeyword"
              type="text"
              value={vars.primaryKeyword}
              onChange={(e) => setVars((v) => ({ ...v, primaryKeyword: e.target.value }))}
              placeholder="e.g. luxury beachfront hotel"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="var-targetUrl" className="text-caption font-medium text-text">
              [Target URL]
            </label>
            <Input
              id="var-targetUrl"
              type="url"
              value={vars.targetUrl}
              onChange={(e) => setVars((v) => ({ ...v, targetUrl: e.target.value }))}
              placeholder="https://www.example.com"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="var-locationNiche" className="text-caption font-medium text-text">
              [Location/Niche]
            </label>
            <Input
              id="var-locationNiche"
              type="text"
              value={vars.locationNiche}
              onChange={(e) => setVars((v) => ({ ...v, locationNiche: e.target.value }))}
              placeholder="e.g. Miami Beach, FL"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="var-competitorDomain" className="text-caption font-medium text-text">
              [Competitor Domain]
            </label>
            <Input
              id="var-competitorDomain"
              type="text"
              value={vars.competitorDomain}
              onChange={(e) => setVars((v) => ({ ...v, competitorDomain: e.target.value }))}
              placeholder="https://competitor.com"
            />
          </div>
        </CardContent>
      </Card>

      {/* Main Workbench Tabs */}
      <Tabs
        id="template-workbench"
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as typeof activeTab)}
      >
        <TabsList className="print:hidden">
          <TabsTrigger value="customizer">
            Template &amp; Checklist ({template.checklist.length})
          </TabsTrigger>
          <TabsTrigger value="serp">Live SERP Simulator ({titlePixel.pixelWidth} px)</TabsTrigger>
          <TabsTrigger value="schema">JSON-LD Schema Generator</TabsTrigger>
          <TabsTrigger value="mistakes">Mistakes &amp; KPI Benchmarks</TabsTrigger>
        </TabsList>

        <TabsContent value="customizer">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
                <CardTitle className="font-mono text-caption text-text-muted">
                  Customized blueprint preview
                </CardTitle>
                <Button type="button" variant="ghost" size="sm" onClick={handleCopyMarkdown}>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  Copy all
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <pre className="max-w-full overflow-x-auto whitespace-pre-wrap rounded-sm border border-border bg-surface-2 p-4 font-mono text-caption text-text">
                  {customizedMarkdown}
                </pre>

                {(markdownResolution.missingVariables.length > 0 ||
                  markdownResolution.unresolvedPlaceholders.length > 0) && (
                  <InlineAlert
                    variant="warning"
                    title="Unresolved:"
                    description={`${Array.from(
                      new Set([
                        ...markdownResolution.missingVariables,
                        ...markdownResolution.unresolvedPlaceholders,
                      ])
                    ).join(", ")} — fill the variable fields above to complete substitution.`}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
                <CardTitle className="text-heading">Task checklist</CardTitle>
                <Badge variant={progressPercent === 100 ? "success" : "neutral"}>
                  {progressPercent}% done
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2.5 pt-4">
                {template.checklist.map((c) => {
                  const isDone = Boolean(checkedTasks[c.id]);
                  return (
                    <div
                      key={c.id}
                      onClick={() => toggleTask(c.id)}
                      className={cn(
                        "cursor-pointer rounded-sm border p-3 transition-colors",
                        isDone
                          ? "border-success/30 bg-success-soft"
                          : "border-border bg-surface-2 hover:border-border-strong"
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <Checkbox
                          checked={isDone}
                          onCheckedChange={() => toggleTask(c.id)}
                          aria-label={renderText(c.task).output}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={cn(
                                "text-caption font-medium",
                                isDone ? "text-text-muted line-through" : "text-text"
                              )}
                            >
                              {renderText(c.task).output}
                            </span>
                            <Badge variant={c.priority === "Critical" ? "error" : "notice"}>
                              {c.priority}
                            </Badge>
                          </div>
                          <p className="text-caption text-text-muted">
                            {renderText(c.description).output}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="serp">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <CardTitle className="text-heading">Live Google SERP pixel simulator</CardTitle>
                <CardDescription>
                  Physical glyph measurement in Arial 20px (title limit {TITLE_PIXEL_LIMIT} px) and Arial 14px (description limit {META_DESC_PIXEL_LIMIT} px).
                </CardDescription>
              </div>
              <div className="inline-flex items-center gap-1 rounded-sm border border-border bg-surface-2 p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={serpMode === "desktop" ? "secondary" : "ghost"}
                  onClick={() => setSerpMode("desktop")}
                >
                  <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
                  Desktop
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={serpMode === "mobile" ? "secondary" : "ghost"}
                  onClick={() => setSerpMode("mobile")}
                >
                  <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                  Mobile
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 rounded-sm border border-border bg-surface-2 p-4">
                  <div className="flex items-center justify-between text-caption">
                    <span className="font-medium text-text">Title tag width</span>
                    <Badge variant={titlePixel.isOver ? "error" : "success"}>
                      {titlePixel.pixelWidth} px / {TITLE_PIXEL_LIMIT} px
                    </Badge>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
                    <div
                      className={cn(
                        "h-full transition-all duration-fast",
                        titlePixel.isOver
                          ? "bg-error"
                          : titlePixel.pixelWidth > TITLE_PIXEL_LIMIT - 40
                          ? "bg-warning"
                          : "bg-success"
                      )}
                      style={{ width: `${Math.min(titlePixel.percentage, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-caption text-text-muted tabular-nums">
                    <span>{customizedTitle.length} characters</span>
                    <span>
                      {titlePixel.isOver
                        ? `Truncated by ${titlePixel.pixelWidth - TITLE_PIXEL_LIMIT} px`
                        : `${titlePixel.remainingPx} px buffer remaining`}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 rounded-sm border border-border bg-surface-2 p-4">
                  <div className="flex items-center justify-between text-caption">
                    <span className="font-medium text-text">Meta description width</span>
                    <Badge variant={descPixel.isOver ? "error" : "success"}>
                      {descPixel.pixelWidth} px / {META_DESC_PIXEL_LIMIT} px
                    </Badge>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
                    <div
                      className={cn(
                        "h-full transition-all duration-fast",
                        descPixel.isOver
                          ? "bg-error"
                          : descPixel.pixelWidth > META_DESC_PIXEL_LIMIT - 60
                          ? "bg-warning"
                          : "bg-success"
                      )}
                      style={{ width: `${Math.min(descPixel.percentage, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-caption text-text-muted tabular-nums">
                    <span>{customizedDesc.length} characters</span>
                    <span>
                      {descPixel.isOver
                        ? `Truncated by ${descPixel.pixelWidth - META_DESC_PIXEL_LIMIT} px`
                        : `${descPixel.remainingPx} px buffer remaining`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-sm border border-border bg-surface p-5">
                <div className="mb-3 font-mono text-overline uppercase text-text-muted">
                  Google SERP preview · {serpMode} viewport
                </div>
                <div
                  className={cn(
                    "space-y-1.5",
                    serpMode === "mobile"
                      ? "max-w-sm rounded-sm border border-border bg-surface-2 p-4"
                      : "max-w-[72ch]"
                  )}
                >
                  <div className="flex items-center gap-2 text-caption">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-caption font-semibold text-text">
                      {vars.brandName ? vars.brandName.charAt(0) : "S"}
                    </span>
                    <div className="min-w-0 leading-tight">
                      <div className="truncate text-caption font-medium text-text">
                        {vars.brandName || "Property Name"}
                      </div>
                      <div className="truncate text-caption text-text-muted">
                        {vars.targetUrl || "https://www.example.com"}
                      </div>
                    </div>
                  </div>
                  <h4 className="pt-1 text-heading font-medium text-link hover:underline">
                    {customizedTitle}
                  </h4>
                  <p className="text-caption leading-relaxed text-text-muted">{customizedDesc}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schema">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-heading">JSON-LD structured data generator</CardTitle>
                  <Badge variant="success">
                    <Check className="h-3 w-3" aria-hidden="true" />
                    Validated ({template.schemaType})
                  </Badge>
                </div>
                <CardDescription>
                  Structured JSON-LD payload generated from your customized template variables.
                </CardDescription>
              </div>
              <Button type="button" variant="primary" size="sm" onClick={handleCopySchema}>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                Copy schema
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              <pre className="overflow-x-auto whitespace-pre rounded-sm border border-border bg-sidebar p-4 font-mono text-caption text-sidebar-text">
                {schemaString}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mistakes">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-heading">Common mistakes &amp; remediation</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-left text-caption">
                  <thead>
                    <tr className="border-b border-border bg-surface-2">
                      <th className="px-3 py-2.5 font-medium text-text">Common mistake</th>
                      <th className="px-3 py-2.5 font-medium text-error-fg">SEO impact</th>
                      <th className="px-3 py-2.5 font-medium text-success-fg">Remediation action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {template.commonMistakes.map((m, i) => (
                      <tr key={i} className="hover:bg-surface-2">
                        <td className="px-3 py-3 font-medium text-text">{m.mistake}</td>
                        <td className="px-3 py-3 text-error-fg">{m.impact}</td>
                        <td className="px-3 py-3 text-text-muted">{m.remediation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-heading">Expected KPI benchmarks</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                {template.kpiBenchmarks.map((kpi, i) => (
                  <div key={i} className="rounded-sm border border-border bg-surface-2 p-4">
                    <div className="text-overline uppercase text-text-muted">{kpi.timeframe}</div>
                    <div className="mt-1 text-heading font-semibold text-text tabular-nums">{kpi.target}</div>
                    <div className="mt-1 text-caption text-text-muted">{kpi.metric}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Related Templates */}
      <Card id="related-templates" className="print:hidden p-5">
        <h3 className="mb-3 text-heading text-text">Related SEO blueprints &amp; checklists</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {relatedTemplates.map((rel) => (
            <Link
              key={rel.id}
              href={`/templates/${rel.categorySlug}/${rel.slug}`}
              className="group rounded-sm border border-border bg-surface-2 p-3.5 transition-colors hover:border-border-strong"
            >
              <div className="text-overline uppercase text-text-muted">{rel.category}</div>
              <h4 className="mt-1 text-caption font-semibold text-text group-hover:text-link line-clamp-1">
                {rel.title}
              </h4>
              <p className="mt-1 text-caption text-text-muted line-clamp-2">{rel.metaDescription}</p>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
