import type { Metadata } from "next";
import { GeoVisibilityClient } from "@/components/pages/GeoVisibilityClient";

export const metadata: Metadata = {
  title: "AI Visibility Connector — SEO & GEO Studio",
};

export default function GeoVisibilityPage() {
  return <GeoVisibilityClient />;
}
