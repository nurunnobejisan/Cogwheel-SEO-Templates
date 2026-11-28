import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { brand } from "@/config/brand";
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
  metadataBase: new URL(brand.siteUrl),
  title: { default: brand.name, template: `%s — ${brand.name}` },
  description: brand.description,
  icons: {
    icon: ["/icon.svg", "/icon.png"],
  },
  openGraph: {
    title: brand.name,
    description: brand.description,
    type: "website",
    siteName: brand.name,
  },
  twitter: {
    card: "summary_large_image",
    title: brand.name,
    description: brand.description,
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
