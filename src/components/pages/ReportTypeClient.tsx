"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/data/index";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { Skeleton } from "@/components/ui/index";

const ExecutivePitchDeckModal = dynamic(
  () => import("@/components/ExecutivePitchDeckModal").then((m) => m.ExecutivePitchDeckModal),
  { loading: () => <Skeleton className="h-80 w-full" /> }
);
const SeoVisibilityReportModal = dynamic(
  () => import("@/components/SeoVisibilityReportModal").then((m) => m.SeoVisibilityReportModal),
  { loading: () => <Skeleton className="h-80 w-full" /> }
);
const SeoBaselineModal = dynamic(
  () => import("@/components/SeoBaselineModal").then((m) => m.SeoBaselineModal),
  { loading: () => <Skeleton className="h-80 w-full" /> }
);
const SlideDeckPreview = dynamic(
  () => import("@/components/SlideDeckPreview").then((m) => m.SlideDeckPreview),
  { loading: () => <Skeleton className="h-80 w-full" /> }
);
const ExecutiveMemoModal = dynamic(
  () => import("@/components/ExecutiveMemoModal").then((m) => m.ExecutiveMemoModal),
  { loading: () => <Skeleton className="h-80 w-full" /> }
);
const ClientEmailDispatcher = dynamic(
  () => import("@/components/ClientEmailDispatcher").then((m) => m.ClientEmailDispatcher),
  { loading: () => <Skeleton className="h-80 w-full" /> }
);

const TYPE_META: Record<string, { title: string; description: string }> = {
  deck: {
    title: "Executive Pitch Deck (PDF)",
    description: "White-label 2-page GM pitch deck template ready to print or export.",
  },
  pptx: {
    title: "SEO Visibility Deck (PPTX)",
    description: "Downloadable PowerPoint deliverable for client reviews.",
  },
  slides: {
    title: "Google Slides Baseline",
    description: "Automated Google Slides baseline presentation.",
  },
  preview: {
    title: "Slide Deck Preview",
    description: "Preview generated slides before exporting.",
  },
  memo: {
    title: "Executive Memo",
    description: "Concise executive strategy memo.",
  },
  email: {
    title: "Client Email Dispatcher",
    description: "Client summary email composer with report attachments.",
  },
};

export function ReportTypeClient({ reportType }: { reportType: string }) {
  const router = useRouter();
  const { activeProperty, refreshRuns } = useWorkspace();
  const meta = TYPE_META[reportType] ?? TYPE_META.deck;

  return (
    <div className="space-y-6">
      <PageHeader
        title={meta.title}
        description={meta.description}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Reports", href: "/reports" },
          { label: meta.title },
        ]}
        secondaryActions={[{ label: "All Deliverables", href: "/reports" }]}
      />

      {reportType === "deck" && (
        <ExecutivePitchDeckModal
          property={activeProperty}
          onClose={() => router.push("/reports")}
          onOpenEmail={() => router.push("/reports/email")}
        />
      )}
      {reportType === "pptx" && (
        <SeoVisibilityReportModal
          defaultProperty={activeProperty}
          onCompleted={() => void refreshRuns()}
          onClose={() => router.push("/reports")}
        />
      )}
      {reportType === "slides" && (
        <SeoBaselineModal
          defaultProperty={activeProperty}
          onCompleted={() => void refreshRuns()}
          onClose={() => router.push("/reports")}
        />
      )}
      {reportType === "preview" && (
        <SlideDeckPreview
          propertyName={activeProperty.name}
          propertyCity={activeProperty.city}
          propertyState={activeProperty.state}
          onDownloadPptx={() => router.push("/reports/pptx")}
        />
      )}
      {reportType === "memo" && (
        <ExecutiveMemoModal
          property={activeProperty}
          onOpenEmail={() => router.push("/reports/email")}
        />
      )}
      {reportType === "email" && (
        <ClientEmailDispatcher
          propertyName={activeProperty.name}
          propertyCity={activeProperty.city}
          propertyState={activeProperty.state}
        />
      )}
    </div>
  );
}
