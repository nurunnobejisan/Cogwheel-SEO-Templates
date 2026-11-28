import { cn } from "@/lib/utils";

export const PRODUCT_NAME = "SEO & GEO Studio";
export const OWNER_CREDIT = "Nurunnobe Jisan";

/**
 * Unified telemetry mark and optional wordmark used across the app shell,
 * mobile top bar, and public header/footer.
 */
export function BrandMark({
  showWordmark = true,
  inverted = false,
  compact = false,
  className,
}: {
  showWordmark?: boolean;
  inverted?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-brand text-brand-fg"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.5-4.5 3.5 3.5L19 7" />
          <circle cx="19" cy="7" r="2" fill="currentColor" stroke="none" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 20h16" opacity="0.55" />
        </svg>
      </span>
      {showWordmark && (
        <span
          className={cn(
            "font-semibold tracking-tight",
            compact ? "text-body" : "text-heading",
            inverted ? "text-sidebar-text" : "text-text"
          )}
        >
          {PRODUCT_NAME}
        </span>
      )}
    </span>
  );
}
