import type { Metadata } from "next";
import { GeoCompsetClient } from "@/components/pages/GeoCompsetClient";

export const metadata: Metadata = {
  title: "Local Comp-Set Matrix — SEO & GEO Studio",
};

export default function GeoCompsetPage() {
  return <GeoCompsetClient />;
}
