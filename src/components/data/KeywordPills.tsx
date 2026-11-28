import * as React from "react";
import { Badge, type BadgeProps } from "@/components/ui/index";
import type { KeywordFlag } from "@/lib/types";
import { cn } from "@/lib/utils";

const FLAG_MAP: Record<
  KeywordFlag,
  { label: string; variant: NonNullable<BadgeProps["variant"]>; title: string }
> = {
  "kd-na": { label: "KD N/A", variant: "neutral", title: "KD was N/A in the source export" },
  "low-sv-exception": {
    label: "Low-SV exception",
    variant: "notice",
    title: "SV < 10 kept: KD < 20 local demand generator",
  },
  "kd-unknown": {
    label: "KD unknown",
    variant: "warning",
    title: "Primary has no KD — verify before approving",
  },
  "kd-exception": {
    label: "KD ≥ 45",
    variant: "error",
    title: "No KD < 45 candidate — high-difficulty exception requires approval",
  },
  "high-sv-exception-available": {
    label: "High-SV exception",
    variant: "notice",
    title: "A KD ≥ 45 keyword with higher volume is available",
  },
  "no-candidates": {
    label: "No candidates",
    variant: "error",
    title: "No keywords in this page's buckets",
  },
  "manual-override": {
    label: "Edited",
    variant: "brand",
    title: "Manually changed at checkpoint",
  },
};

export function FlagBadge({ flag }: { flag: KeywordFlag }) {
  const cfg = FLAG_MAP[flag];
  if (!cfg) return null;
  return (
    <Badge variant={cfg.variant} title={cfg.title}>
      {cfg.label}
    </Badge>
  );
}

export function KdPill({ kd, max = 45 }: { kd: number | null; max?: number }) {
  if (kd === null) return <span className="text-caption text-text-subtle">N/A</span>;
  const cls = kd < 30 ? "text-success-fg" : kd < max ? "text-warning-fg" : "text-error-fg";
  return <span className={cn("nums font-medium", cls)}>{kd}</span>;
}
