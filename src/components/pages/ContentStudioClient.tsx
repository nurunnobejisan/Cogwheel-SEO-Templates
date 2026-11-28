"use client";

import dynamic from "next/dynamic";
import { PageHeader } from "@/components/data/index";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { Skeleton } from "@/components/ui/index";

const Studio = dynamic(() => import("@/components/Studio"), {
  loading: () => <Skeleton className="h-96 w-full" />,
});

export function ContentStudioClient() {
  const { activeProperty } = useWorkspace();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Studio"
        description="Draft and validate on-page copy against pixel limits, brand guardrails, and target keywords."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Keywords", href: "/keywords" },
          { label: "Content Studio" },
        ]}
      />

      <Studio initialStep={4} initialProperty={activeProperty} />
    </div>
  );
}
