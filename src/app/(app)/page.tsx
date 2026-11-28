import type { Metadata } from "next";
import { DashboardPageClient } from "@/components/pages/DashboardPageClient";

export const metadata: Metadata = {
  title: "SEO & GEO Audit Studio — Universal SEO & GEO Workspace",
  description:
    "Universal SEO and generative engine optimization suite with six vertical packs, hotel first: pixel budgeting, brand guardrails, and client-ready reporting.",
};

export default function Home() {
  return <DashboardPageClient />;
}
