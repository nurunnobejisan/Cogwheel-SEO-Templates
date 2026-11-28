"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/data/index";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { Skeleton } from "@/components/ui/index";

const LabsView = dynamic(
  () => import("@/components/LabsView").then((m) => m.LabsView),
  { loading: () => <Skeleton className="h-96 w-full" /> }
);

export function LabsPageClient() {
  const router = useRouter();
  const { activeProperty } = useWorkspace();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Diagnostic Sandbox"
        description="Development-only SERP pixel, JSON-LD, and CMS exporter tools."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Settings", href: "/settings/ai-training" },
          { label: "Sandbox" },
        ]}
      />
      <LabsView
        property={activeProperty}
        activeSubTab="sandbox"
        onRunDeckGeneration={() => router.push("/reports/pptx")}
        onExportMemo={() => router.push("/reports/memo")}
        onOpenImageAudit={() => router.push("/audit/images")}
        onOpenHeadingAudit={() => router.push("/audit/headings")}
      />
    </div>
  );
}
