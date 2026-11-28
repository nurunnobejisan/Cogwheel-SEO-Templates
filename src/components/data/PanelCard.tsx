import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/index";

export interface PanelCardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

/**
 * Convenience surface card with optional header title, subtitle, and actions slot.
 */
export function PanelCard({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
}: PanelCardProps) {
  return (
    <Card className={className}>
      {(title || actions) && (
        <CardHeader>
          <div className="min-w-0">
            {title && <CardTitle>{title}</CardTitle>}
            {subtitle && <CardDescription>{subtitle}</CardDescription>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </CardHeader>
      )}
      <CardContent className={bodyClassName}>{children}</CardContent>
    </Card>
  );
}
