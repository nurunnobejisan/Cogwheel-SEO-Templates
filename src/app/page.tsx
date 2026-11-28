import type { Metadata } from "next";
import PropertyDashboard from "@/components/PropertyDashboard";

export const metadata: Metadata = {
  title: "Razib Marketing — Hotel SEO & GEO Studio",
  description:
    "Razib Marketing's hospitality SEO and Generative Engine Optimization workspace — precise SERP pixel budgeting, brand guardrails, and client-ready reporting for hotels.",
};

export default function Home() {
  return <PropertyDashboard />;
}
