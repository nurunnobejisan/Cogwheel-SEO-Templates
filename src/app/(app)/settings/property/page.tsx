import type { Metadata } from "next";
import { PropertySettingsClient } from "@/components/pages/PropertySettingsClient";

export const metadata: Metadata = {
  title: "Property Profile — SEO & GEO Studio",
};

export default function PropertySettingsPage() {
  return <PropertySettingsClient />;
}
