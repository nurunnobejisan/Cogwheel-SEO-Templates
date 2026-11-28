import { cn } from "@/lib/utils";

export interface DeltaBadgeProps {
  value: number | null | undefined;
  goodWhen: "down" | "up";
  suffix?: string;
  className?: string;
}

/**
 * Semantic delta badge where color reflects outcome meaning (`goodWhen`)
 * rather than purely numeric sign.
 */
export function DeltaBadge({ value, goodWhen, suffix = "", className }: DeltaBadgeProps) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }

  if (value === 0) {
    return (
      <span
        className={cn(
          "nums inline-flex h-5 items-center rounded-sm bg-surface-2 px-1.5 text-caption text-text-muted",
          className
        )}
      >
        0{suffix}
      </span>
    );
  }

  const isUp = value > 0;
  const isGood = goodWhen === "up" ? isUp : !isUp;
  const arrow = isUp ? "▲" : "▼";
  const formatted = `${arrow} ${Math.abs(value).toLocaleString()}${suffix}`;

  return (
    <span
      className={cn(
        "nums inline-flex h-5 items-center rounded-sm px-1.5 text-caption font-medium",
        isGood ? "bg-success-soft text-success-fg" : "bg-error-soft text-error-fg",
        className
      )}
    >
      {formatted}
    </span>
  );
}
