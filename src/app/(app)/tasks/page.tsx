import { Suspense } from "react";
import type { Metadata } from "next";
import { TasksPageClient } from "@/components/pages/TasksPageClient";
import { Skeleton } from "@/components/ui/index";

export const metadata: Metadata = {
  title: "Tasks Suite — SEO & GEO Studio",
};

export default function TasksPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <TasksPageClient />
    </Suspense>
  );
}
