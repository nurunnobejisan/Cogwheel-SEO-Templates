import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusKind = "error" | "warning" | "notice" | "success";

const ICON_MAP = {
  error: CircleX,
  warning: TriangleAlert,
  notice: Info,
  success: CircleCheck,
};

const COLOR_MAP: Record<StatusKind, string> = {
  error: "text-error",
  warning: "text-warning",
  notice: "text-notice",
  success: "text-success",
};

/**
 * Semantic status icon mapped strictly to the four status tokens.
 */
export function StatusIcon({
  status,
  className,
}: {
  status: StatusKind;
  className?: string;
}) {
  const Icon = ICON_MAP[status];
  return <Icon className={cn("h-4 w-4 shrink-0", COLOR_MAP[status], className)} aria-hidden="true" />;
}
