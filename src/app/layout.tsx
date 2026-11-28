import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { DownloadFeedbackModal } from "@/components/DownloadFeedbackModal";
import { SiteFooter } from "@/components/SiteFooter";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://seo-studio.vercel.app"),
  title: {
    default: "Razib Marketing — Hotel SEO & GEO Workspace for Hospitality",
    template: "%s",
  },
  description:
    "Razib Marketing's hospitality SEO and GEO workspace brings precise SERP pixel budgeting, brand guardrails, and client-ready reporting to hotel teams.",
  icons: {
    icon: "/razib-marketing-logo.png",
  },
  openGraph: {
    title: "Razib Marketing — Hotel SEO & GEO Workspace for Hospitality",
    description:
      "Razib Marketing's hospitality SEO and GEO workspace brings precise SERP pixel budgeting, brand guardrails, and client-ready reporting to hotel teams.",
    type: "website",
    siteName: "Razib Marketing — SEO & GEO Studio",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable}`}>
      <body className="flex min-h-screen flex-col font-sans text-slate-800 antialiased selection:bg-brand selection:text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="sticky top-0 z-50 h-1 w-full bg-gradient-to-r from-brand via-emerald-400 to-hilton shadow-xs" />
        <div className="flex-1">{children}</div>
        <SiteFooter />
        <DownloadFeedbackModal />
        <SpeedInsights />
      </body>
    </html>
  );
}
