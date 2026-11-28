import type { Metadata } from "next";
import PropertyDashboard from "@/components/PropertyDashboard";

export const metadata: Metadata = {
  title: "SEO & GEO Audit Studio — Universal SEO & GEO Workspace",
  description:
    "Universal SEO and generative engine optimization suite with six vertical packs, hotel first: pixel budgeting, brand guardrails, and client-ready reporting.",
};

export default function Home() {
  return <PropertyDashboard embeddedInShell initialTab="home" />;
}
