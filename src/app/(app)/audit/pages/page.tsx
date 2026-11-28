import { Suspense } from "react";
import type { Metadata } from "next";
import { AuditPagesClient } from "@/components/pages/AuditPagesClient";
import { Skeleton } from "@/components/ui/index";

export const metadata: Metadata = {
  title: "Crawled Pages — SEO & GEO Studio",
};

export default function AuditPagesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <AuditPagesClient />
    </Suspense>
  );
}
