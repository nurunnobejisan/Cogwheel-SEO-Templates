import type { Metadata } from "next";
import { brand, pageTitle } from "@/config/brand";
import { JsonLd } from "@/components/JsonLd";
import PropertyDashboard from "@/components/PropertyDashboard";

const title = "Hotel Search & AI Visibility Suite";
const description =
  `${brand.name}'s hospitality SEO and GEO workspace brings precise SERP pixel budgeting, brand guardrails, and client reports to hotel teams worldwide.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: {
    title: pageTitle(title),
    description,
    url: "/",
    type: "website",
    siteName: brand.name,
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle(title),
    description,
  },
};

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: brand.name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: brand.siteUrl,
    description,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@type": "Organization", name: brand.owner },
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brand.owner,
    url: "https://github.com/nurunnobejisan/SEO-Studio",
  },
];

export default function Home() {
  return (
    <>
      <JsonLd data={structuredData} />
      <PropertyDashboard />
    </>
  );
}
