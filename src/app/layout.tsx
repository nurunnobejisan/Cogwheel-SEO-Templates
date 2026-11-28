import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { DownloadFeedbackModal } from "@/components/DownloadFeedbackModal";
import { MotionProvider } from "@/components/motion";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://seo-studio-one.vercel.app"),
  title: {
    default: "SEO & GEO Studio — Universal SEO & GEO Auditing Suite",
    template: "%s",
  },
  description:
    "Universal search and generative engine optimization suite with six vertical packs, hotel first: pixel budgeting, brand guardrails, and client-ready reporting.",
  icons: {
    icon: "/nurunnobe-logo.png",
  },
  openGraph: {
    title: "SEO & GEO Studio — Universal SEO & GEO Auditing Suite",
    description:
      "Universal search and generative engine optimization suite with six vertical packs, hotel first: pixel budgeting, brand guardrails, and client-ready reporting.",
    type: "website",
    siteName: "SEO & GEO Studio",
  },
};

const THEME_INIT_SCRIPT = `(function(){try{var k="seo_studio_theme";var t=window.localStorage.getItem(k);var d=t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d){document.documentElement.classList.add("dark");}else{document.documentElement.classList.remove("dark");}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col bg-canvas font-sans text-body text-text antialiased selection:bg-brand selection:text-brand-fg">
        <MotionProvider>
          <TooltipProvider delayDuration={180}>
            <div className="flex-1">{children}</div>
            <Toaster />
            <DownloadFeedbackModal />
          </TooltipProvider>
        </MotionProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
