"use client";

import * as React from "react";
import { Download, Image as ImageIcon, Play } from "lucide-react";
import { DataTable, FilterTabs, InlineAlert, KpiTile, PageHeader } from "@/components/data/index";
import { CrawlPulseScene } from "@/components/motion/TelemetryScenes";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/index";
import type { ImageAuditItem, ImageAuditSummary } from "@/core/image-audit/types";

interface ImageAuditResponse {
  success: boolean;
  summary: ImageAuditSummary;
  items: ImageAuditItem[];
  filename: string;
  xlsxBase64: string;
  googleSheetUrl?: string | null;
  error?: string;
}

export function ImagesAuditClient() {
  const { activeProperty } = useWorkspace();
  const [urlInput, setUrlInput] = React.useState(activeProperty.url || "");
  const [maxPages, setMaxPages] = React.useState(50);
  const [sizeThresholdKb, setSizeThresholdKb] = React.useState(100);
  const [enableSitemaps, setEnableSitemaps] = React.useState(true);
  const [enableWpMedia, setEnableWpMedia] = React.useState(true);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ImageAuditResponse | null>(null);
  const [filterType, setFilterType] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [selectedItem, setSelectedItem] = React.useState<ImageAuditItem | null>(null);

  React.useEffect(() => {
    if (activeProperty.url && !urlInput) {
      setUrlInput(activeProperty.url);
    }
  }, [activeProperty.url, urlInput]);

  async function runAudit() {
    let target = urlInput.trim();
    if (!target) {
      setError("Enter a website URL to audit images.");
      return;
    }
    if (!target.startsWith("http://") && !target.startsWith("https://")) {
      target = `https://${target}`;
      setUrlInput(target);
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/image-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: target,
          maxPages,
          sizeThresholdKb,
          delayMs: 100,
          enableSitemaps,
          enableWordPressApi: enableWpMedia,
        }),
      });
      const data = (await res.json()) as ImageAuditResponse;
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Image optimization audit failed.");
      }
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function downloadXlsx() {
    if (!result?.xlsxBase64) return;
    const chars = atob(result.xlsxBase64);
    const bytes = new Uint8Array(chars.length);
    for (let i = 0; i < chars.length; i++) bytes[i] = chars.charCodeAt(i);
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename || "image-optimization-audit.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredItems = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return (result?.items ?? []).filter((item) => {
      if (filterType === "missing-alt" && !item.issues.some((i) => i.code === "missing-alt" || i.code === "empty-alt-suspicious")) {
        return false;
      }
      if (filterType === "oversized" && !item.issues.some((i) => i.code === "oversized-file")) return false;
      if (filterType === "broken" && !item.isBroken) return false;
      if (filterType === "high" && item.priority !== "High") return false;
      if (
        q &&
        !item.imageUrl.toLowerCase().includes(q) &&
        !item.filename.toLowerCase().includes(q) &&
        !(item.currentAlt ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [result, filterType, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Image Optimization Audit"
        description="Inspect image placements, missing alt text, file sizes, dimensions, and WebP conversion candidates."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Website Audit", href: "/audit" },
          { label: "Images" },
        ]}
        secondaryActions={[
          {
            label: "Export XLSX",
            onClick: downloadXlsx,
            disabled: !result?.xlsxBase64,
            icon: <Download className="h-3.5 w-3.5" aria-hidden="true" />,
          },
        ]}
        primaryAction={
          <Button
            variant="primary"
            loading={loading}
            onClick={() => void runAudit()}
            icon={<Play className="h-4 w-4" aria-hidden="true" />}
          >
            Audit images
          </Button>
        }
      />

      <div className="surface-card space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_130px_150px]">
          <Input
            label="Target Website URL"
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://www.example.com"
          />
          <Input
            label="Max pages"
            type="number"
            min={5}
            max={200}
            value={maxPages}
            onChange={(e) => setMaxPages(Number(e.target.value) || 50)}
          />
          <Input
            label="Size threshold (KB)"
            type="number"
            min={25}
            max={1000}
            value={sizeThresholdKb}
            onChange={(e) => setSizeThresholdKb(Number(e.target.value) || 100)}
          />
        </div>
        <div className="flex flex-wrap gap-6">
          <Checkbox
            label="Discover URLs via XML sitemap"
            checked={enableSitemaps}
            onCheckedChange={(v) => setEnableSitemaps(Boolean(v))}
          />
          <Checkbox
            label="Include WordPress media API"
            checked={enableWpMedia}
            onCheckedChange={(v) => setEnableWpMedia(Boolean(v))}
          />
        </div>
      </div>

      {error && (
        <InlineAlert
          variant="error"
          title="Image audit failed"
          description={error}
          onRetry={() => void runAudit()}
        />
      )}

      {loading && (
        <CrawlPulseScene
          active
          label="Discovering image placements & measuring byte sizes..."
          sublabel="Checking alt attributes, natural dimensions, broken assets, and next-gen format opportunities"
        />
      )}

      {result && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiTile label="Images found" value={result.summary.totalImagesFound} />
          <KpiTile label="Missing alt" value={result.summary.missingAltCount} />
          <KpiTile label="Oversized" value={result.summary.oversizedImagesCount} />
          <KpiTile label="Broken assets" value={result.summary.brokenImagesCount} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          value={filterType}
          onChange={setFilterType}
          options={[
            { id: "all", label: "All", count: result?.items.length ?? 0 },
            { id: "missing-alt", label: "Missing alt", count: result?.summary.missingAltCount ?? 0 },
            { id: "oversized", label: "Oversized", count: result?.summary.oversizedImagesCount ?? 0 },
            { id: "broken", label: "Broken", count: result?.summary.brokenImagesCount ?? 0 },
          ]}
        />
        <div className="w-full sm:w-64">
          <Input
            type="search"
            placeholder="Filter filename or alt..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter audited images"
          />
        </div>
      </div>

      <DataTable
        data={filteredItems}
        loading={loading}
        emptyTitle="No image findings yet"
        emptyDescription="Enter a property URL above and click Audit images to scan placements."
        emptyAction={
          <Button variant="primary" size="sm" icon={<ImageIcon className="h-4 w-4" />} onClick={() => void runAudit()}>
            Audit images
          </Button>
        }
        onRowClick={(row) => setSelectedItem(row)}
        columns={[
          {
            accessorKey: "filename",
            header: "Filename",
            cell: ({ row }) => (
              <span className="block max-w-xs truncate font-mono text-caption text-text">{row.original.filename}</span>
            ),
          },
          {
            accessorKey: "priority",
            header: "Priority",
            cell: ({ row }) => {
              const p = row.original.priority;
              const v = p === "High" ? "error" : p === "Medium" ? "warning" : p === "Low" ? "notice" : "success";
              return <Badge variant={v}>{p}</Badge>;
            },
          },
          {
            accessorKey: "fileSizeKb",
            header: "Size",
            cell: ({ row }) => (
              <span className="nums">{row.original.fileSizeKb !== null ? `${row.original.fileSizeKb} KB` : "—"}</span>
            ),
          },
          {
            accessorKey: "format",
            header: "Format",
            cell: ({ row }) => <span className="font-mono text-caption uppercase">{row.original.format}</span>,
          },
          {
            accessorKey: "currentAlt",
            header: "Current Alt",
            cell: ({ row }) => (
              <span className="block max-w-xs truncate text-caption text-text-muted">
                {row.original.currentAlt || "Missing"}
              </span>
            ),
          },
        ]}
      />

      <InlineAlert
        variant="notice"
        title="Image remediation guidance"
        description="Compress images above the KB threshold, supply descriptive non-stuffed alt text for informative visuals, and include explicit width and height attributes to prevent CLS."
      />

      <Sheet open={Boolean(selectedItem)} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>{selectedItem?.filename}</SheetTitle>
            <SheetDescription className="truncate font-mono">{selectedItem?.pageUrl}</SheetDescription>
          </SheetHeader>
          {selectedItem && (
            <div className="space-y-4 overflow-y-auto p-5 text-body">
              <div className="rounded border border-border bg-surface-2 p-3">
                <p className="text-overline uppercase text-text-muted">Proposed Alt Text</p>
                <p className="mt-1 font-medium text-text">{selectedItem.proposedAlt}</p>
              </div>
              {selectedItem.targetFilename && (
                <div className="rounded border border-border bg-surface-2 p-3">
                  <p className="text-overline uppercase text-text-muted">Suggested WebP Filename</p>
                  <p className="mt-1 font-mono text-caption text-text">{selectedItem.targetFilename}</p>
                </div>
              )}
              <div>
                <p className="text-overline uppercase text-text-muted">Recommendation</p>
                <p className="mt-1 max-w-[72ch] text-caption text-text-muted">{selectedItem.recommendation}</p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
