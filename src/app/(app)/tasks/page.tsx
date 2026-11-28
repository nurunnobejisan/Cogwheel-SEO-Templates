import type { Metadata } from "next";
import PropertyDashboard from "@/components/PropertyDashboard";
import { TASK_SECTIONS, type TaskSection } from "@/tasks/tasks.config";

export const metadata: Metadata = {
  title: "Tasks Suite — SEO & GEO Studio",
};

export default function TasksPage({
  searchParams,
}: {
  searchParams?: { section?: string };
}) {
  const candidate = searchParams?.section as TaskSection | undefined;
  const initialSection = candidate && TASK_SECTIONS.includes(candidate) ? candidate : "On Page";
  return <PropertyDashboard embeddedInShell initialTab="tasks" initialSection={initialSection} />;
}
