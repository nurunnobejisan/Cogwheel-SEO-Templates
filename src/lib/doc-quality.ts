import type { MatrixRow, PoolEntry, Property, SitemapPage } from "@/lib/types";

export type QualityStatus = "passed" | "warning" | "failed";

export interface QualityCheckItem {
  id: string;
  label: string;
  status: QualityStatus;
  detail: string;
}

export interface DocumentQualityReport {
  overall: QualityStatus;
  checks: QualityCheckItem[];
  passedCount: number;
  warningCount: number;
  failedCount: number;
}

/**
 * Phase 8 Automated Document Quality Check:
 * Validates matrix completeness, duplicate primaries, URL inventory alignment,
 * approval status, and optional placeholder/template verification.
 */
export function runDocumentQualityCheck(opts: {
  property: Property;
  pages: SitemapPage[];
  matrix: MatrixRow[];
  pool: PoolEntry[];
  unresolvedPlaceholders?: string[];
}): DocumentQualityReport {
  const checks: QualityCheckItem[] = [];
  const activePages = opts.pages.filter((p) => p.active);
  const activePathSet = new Set(activePages.map((p) => p.path));

  // 1. Property metadata
  const hasPropMeta = Boolean(opts.property.name.trim() && opts.property.city.trim() && opts.property.state.trim().length === 2);
  checks.push({
    id: "property-meta",
    label: "Property Metadata",
    status: hasPropMeta ? "passed" : "failed",
    detail: hasPropMeta
      ? `${opts.property.name} (${opts.property.city}, ${opts.property.state})`
      : "Missing property name, city, or 2-letter state.",
  });

  // 2. Active matrix non-empty & approved
  const unapproved = opts.matrix.filter((r) => r.status !== "approved");
  checks.push({
    id: "approvals",
    label: "Human Review & Approvals",
    status: opts.matrix.length === 0 ? "failed" : unapproved.length === 0 ? "passed" : "failed",
    detail:
      opts.matrix.length === 0
        ? "No active matrix rows."
        : unapproved.length === 0
          ? `All ${opts.matrix.length} active pages approved.`
          : `${unapproved.length} page(s) still pending approval.`,
  });

  // 3. No duplicate primary keywords across pages
  const seenPrimaries = new Map<string, string[]>();
  for (const r of opts.matrix) {
    if (!r.primary) continue;
    const key = r.primary.keyword.toLowerCase().trim();
    const list = seenPrimaries.get(key) ?? [];
    list.push(r.title);
    seenPrimaries.set(key, list);
  }
  const dupes = [...seenPrimaries.entries()].filter(([, titles]) => titles.length > 1);
  checks.push({
    id: "duplicate-primaries",
    label: "No Duplicate Primary Keywords",
    status: dupes.length === 0 ? "passed" : "failed",
    detail:
      dupes.length === 0
        ? "Every mapped primary keyword is unique to one page."
        : `Duplicate primary keyword(s): ${dupes.map(([k, t]) => `"${k}" (${t.join(", ")})`).join("; ")}`,
  });

  // 4. Every assigned URL/path exists in active website inventory
  const orphanRows = opts.matrix.filter((r) => !activePathSet.has(r.path));
  checks.push({
    id: "url-inventory",
    label: "Assigned URLs in Website Inventory",
    status: orphanRows.length === 0 ? "passed" : "warning",
    detail:
      orphanRows.length === 0
        ? "All mapped paths match active sitemap pages."
        : `${orphanRows.length} row(s) reference paths not in active sitemap.`,
  });

  // 5. Pool coverage
  checks.push({
    id: "pool-coverage",
    label: "78-Keyword Pool Coverage",
    status: opts.pool.length >= 20 ? "passed" : opts.pool.length > 0 ? "warning" : "failed",
    detail: `${opts.pool.length} keywords in deliverable pool.`,
  });

  // 6. Unresolved placeholders check (if post-generation check was run)
  if (opts.unresolvedPlaceholders !== undefined) {
    checks.push({
      id: "placeholders",
      label: "Template Placeholders Resolved",
      status: opts.unresolvedPlaceholders.length === 0 ? "passed" : "warning",
      detail:
        opts.unresolvedPlaceholders.length === 0
          ? "No unresolved {{PLACEHOLDER}} tokens remain."
          : `Unresolved tokens: ${opts.unresolvedPlaceholders.join(", ")}`,
    });
  }

  const failedCount = checks.filter((c) => c.status === "failed").length;
  const warningCount = checks.filter((c) => c.status === "warning").length;
  const passedCount = checks.filter((c) => c.status === "passed").length;
  const overall: QualityStatus = failedCount > 0 ? "failed" : warningCount > 0 ? "warning" : "passed";

  return { overall, checks, passedCount, warningCount, failedCount };
}

