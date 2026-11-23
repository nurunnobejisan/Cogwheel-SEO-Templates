import type { Metadata } from "next";
import PropertyDashboard from "@/components/PropertyDashboard";

export const metadata: Metadata = {
  title: "Cogwheel SEO & GEO Studio — Hotel Search Engine Suite",
  description:
    "Automated hospitality search and generative engine optimization suite with physical pixel budgeting, brand guardrails, and client-ready reporting.",
};

export default function Home() {
  return <PropertyDashboard />;
}
