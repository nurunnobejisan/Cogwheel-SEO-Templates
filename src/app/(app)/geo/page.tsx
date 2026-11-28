import type { Metadata } from "next";
import { GeoOverviewClient } from "@/components/pages/GeoOverviewClient";

export const metadata: Metadata = {
  title: "AI & GEO Radar — SEO & GEO Studio",
};

export default function GeoRadarPage() {
  return <GeoOverviewClient />;
}
