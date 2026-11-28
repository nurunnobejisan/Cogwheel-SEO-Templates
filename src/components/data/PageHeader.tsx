"use client";

import * as React from "react";
import { MoreHorizontal } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/index";
import { cn } from "@/lib/utils";

export interface PageActionItem {
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  primaryAction?: React.ReactNode;
  secondaryActions?: PageActionItem[];
  meta?: React.ReactNode;
  className?: string;
}

/**
 * Standard frame header for every app page: single H1, optional one-line
 * description, and actions collapsing into a More menu below 640px.
 */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  primaryAction,
  secondaryActions = [],
  meta,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumb className="mb-1">
            <BreadcrumbList>
              {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={crumb.label}>
                  {index > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {crumb.href ? (
                      <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        )}
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="truncate text-title text-text">{title}</h1>
          {meta}
        </div>
        {description && <p className="max-w-[72ch] truncate text-body text-text-muted">{description}</p>}
      </div>

      {(primaryAction || secondaryActions.length > 0) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {secondaryActions.length > 0 && (
            <>
              <div className="hidden items-center gap-2 sm:flex">
                {secondaryActions.map((act) =>
                  act.href ? (
                    <Button key={act.label} variant="secondary" size="sm" asChild>
                      <a href={act.href} className="inline-flex items-center gap-1.5">
                        {act.icon}
                        {act.label}
                      </a>
                    </Button>
                  ) : (
                    <Button
                      key={act.label}
                      variant="secondary"
                      size="sm"
                      disabled={act.disabled}
                      onClick={act.onClick}
                      icon={act.icon}
                    >
                      {act.label}
                    </Button>
                  )
                )}
              </div>

              <div className="sm:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="sm" icon={<MoreHorizontal className="h-4 w-4" />}>
                      More
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {secondaryActions.map((act) => (
                      <DropdownMenuItem
                        key={act.label}
                        disabled={act.disabled}
                        onSelect={() => {
                          if (act.href) {
                            window.location.assign(act.href);
                          } else {
                            act.onClick?.();
                          }
                        }}
                      >
                        {act.icon}
                        <span>{act.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          )}
          {primaryAction}
        </div>
      )}
    </header>
  );
}
