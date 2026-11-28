"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge, Button } from "@/components/ui/index";
import { cn } from "@/lib/utils";
import { EmptyState } from "./EmptyState";
import { StatusIcon, type StatusKind } from "./StatusIcon";

export interface IssueRowItem {
  id: string;
  title: string;
  severity: StatusKind;
  pagesCount: number;
  fixedCount?: number;
  newCount?: number;
  description: string;
  howToFix: string;
  affectedUrls?: string[];
  viewAllHref?: string;
}

export interface IssueTableProps {
  items: IssueRowItem[];
  emptyTitle?: string;
  emptyDescription?: string;
  onAction?: (item: IssueRowItem) => void;
  actionLabel?: string;
  className?: string;
}

/**
 * Expandable SE-Ranking-style audit issue table with side-by-side
 * "Issue description" (error-soft) and "How to fix" (success-soft) panels.
 */
export function IssueTable({
  items,
  emptyTitle = "No issues in this category",
  emptyDescription = "All checked rules passed without errors or warnings.",
  onAction,
  actionLabel = "Inspect",
  className,
}: IssueTableProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(items[0]?.id ?? null);

  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} className={className} />;
  }

  return (
    <div className={cn("surface-card overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-border bg-surface-2">
            <tr>
              <th scope="col" className="px-4 py-2.5 text-overline uppercase text-text-muted">
                Issue
              </th>
              <th scope="col" className="px-4 py-2.5 text-right text-overline uppercase text-text-muted">
                Pages
              </th>
              <th scope="col" className="hidden px-4 py-2.5 text-right text-overline uppercase text-text-muted sm:table-cell">
                Fixed
              </th>
              <th scope="col" className="hidden px-4 py-2.5 text-right text-overline uppercase text-text-muted sm:table-cell">
                New
              </th>
              <th scope="col" className="px-4 py-2.5 text-right text-overline uppercase text-text-muted">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => {
              const expanded = expandedId === item.id;
              return (
                <React.Fragment key={item.id}>
                  <tr
                    className={cn(
                      "transition-colors duration-fast ease-telemetry hover:bg-surface-2",
                      expanded && "bg-surface-2"
                    )}
                  >
                    <td className="px-4 py-3 text-table text-text">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => setExpandedId(expanded ? null : item.id)}
                        className="tap-compact flex w-full items-center gap-2.5 text-left font-medium text-text"
                      >
                        {expanded ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
                        )}
                        <StatusIcon status={item.severity} />
                        <span className="truncate">{item.title}</span>
                      </button>
                    </td>
                    <td className="nums px-4 py-3 text-right text-table font-medium text-text">
                      {item.pagesCount.toLocaleString()}
                    </td>
                    <td className="nums hidden px-4 py-3 text-right text-table text-success-fg sm:table-cell">
                      {(item.fixedCount ?? 0).toLocaleString()}
                    </td>
                    <td className="nums hidden px-4 py-3 text-right text-table text-error-fg sm:table-cell">
                      {(item.newCount ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {onAction ? (
                        <Button variant="secondary" size="sm" onClick={() => onAction(item)}>
                          {actionLabel}
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedId(expanded ? null : item.id)}
                        >
                          {expanded ? "Hide" : "Details"}
                        </Button>
                      )}
                    </td>
                  </tr>

                  {expanded && (
                    <tr className="bg-surface">
                      <td colSpan={5} className="px-4 py-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded border border-error/20 bg-error-soft p-4">
                            <p className="text-caption font-semibold text-error-fg">Issue description</p>
                            <p className="mt-1.5 max-w-[72ch] text-body text-text">{item.description}</p>
                          </div>
                          <div className="rounded border border-success/20 bg-success-soft p-4">
                            <p className="text-caption font-semibold text-success-fg">How to fix</p>
                            <p className="mt-1.5 max-w-[72ch] text-body text-text">{item.howToFix}</p>
                          </div>
                        </div>

                        {item.affectedUrls && item.affectedUrls.length > 0 && (
                          <div className="mt-4 space-y-2 rounded border border-border bg-surface-2 p-3.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-overline uppercase text-text-muted">
                                Affected URLs ({item.affectedUrls.length > 10 ? "First 10" : item.affectedUrls.length})
                              </span>
                              <Link
                                href={item.viewAllHref || `/audit/pages?issue=${encodeURIComponent(item.id)}`}
                                className="text-caption font-medium text-link hover:underline"
                              >
                                View all &rarr;
                              </Link>
                            </div>
                            <ul className="space-y-1">
                              {item.affectedUrls.slice(0, 10).map((url) => (
                                <li key={url} className="flex items-center justify-between gap-2">
                                  <span className="truncate font-mono text-caption text-text">{url}</span>
                                  <Badge variant="outline">Affected</Badge>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
