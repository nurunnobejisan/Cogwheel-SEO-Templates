import type { Metadata } from "next";
import PropertyDashboard from "@/components/PropertyDashboard";

export const metadata: Metadata = {
  title: "Razib Marketing — Hotel SEO & GEO Workspace for Hospitality",
  description:
    "Razib Marketing's hospitality SEO and GEO workspace brings precise SERP pixel budgeting, brand guardrails, and client-ready reporting to hotel teams.",
};

export default function Home() {
  return <PropertyDashboard />;
}
