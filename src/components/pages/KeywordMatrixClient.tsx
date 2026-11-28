"use client";

import dynamic from "next/dynamic";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/data/index";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { Skeleton } from "@/components/ui/index";
import { cn } from "@/lib/utils";

const Studio = dynamic(() => import("@/components/Studio"), {
  loading: () => <Skeleton className="h-96 w-full" />,
});

const MATRIX_STEPS = [
  { step: 1, label: "Property & Files" },
  { step: 2, label: "Template" },
  { step: 3, label: "Pool & Matrix" },
  { step: 4, label: "Content" },
];

export function KeywordMatrixClient() {
  const { activeProperty } = useWorkspace();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Keyword Matrix Studio"
        description="Allocate the 78-keyword pool across target pages with inline edits and approval checks."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Keywords", href: "/keywords" },
          { label: "Keyword Matrix" },
        ]}
      />

      <ol
        aria-label="Workflow steps"
        className="surface-card flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"
      >
        {MATRIX_STEPS.map((item, idx) => (
          <li key={item.step} className="flex items-center gap-2.5">
            <span
              className={cn(
                "nums flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-caption font-semibold",
                idx === 0 ? "bg-brand text-brand-fg" : "border border-border-strong bg-surface-2 text-text-muted"
              )}
            >
              {idx < 0 ? <Check className="h-3.5 w-3.5" /> : item.step}
            </span>
            <span className="text-body font-medium text-text">{item.label}</span>
          </li>
        ))}
      </ol>

      <Studio initialStep={1} initialProperty={activeProperty} />
    </div>
  );
}
