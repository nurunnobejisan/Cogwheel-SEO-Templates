import type { Metadata } from "next";
import PropertyDashboard from "@/components/PropertyDashboard";
import { isMainTab, type MainTab } from "@/config/main-tabs";

export const metadata: Metadata = {
  title: "SEO & GEO Studio — Hotel Search & AI Visibility Suite",
  description:
    "SEO Studio's hospitality SEO and GEO workspace brings precise SERP pixel budgeting, brand guardrails, and client-ready reporting to hotel teams worldwide.",
  alternates: { canonical: "/" },
};

export default function Home({
  searchParams,
}: {
  searchParams?: { tab?: string | string[] };
}) {
  const requested = searchParams?.tab;
  const rawTab = Array.isArray(requested) ? requested[0] : requested;
  const initialTab: MainTab = isMainTab(rawTab) ? rawTab : "home";

  return <PropertyDashboard initialTab={initialTab} />;
}
