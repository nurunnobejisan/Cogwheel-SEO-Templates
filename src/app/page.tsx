import type { Metadata } from "next";
import PropertyDashboard from "@/components/PropertyDashboard";

export const metadata: Metadata = {
  title: "SEO & GEO Studio — Hotel Search & AI Visibility Suite",
  description:
    "SEO Studio's hospitality SEO and GEO workspace brings precise SERP pixel budgeting, brand guardrails, and client-ready reporting to hotel teams worldwide.",
};

export default function Home() {
  return <PropertyDashboard />;
}
