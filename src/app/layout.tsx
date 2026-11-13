import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: "Razib Marketing — Cogwheel SEO - Templates",
  description:
    "Digital marketing, SEO, and GEO visibility automation studio for independent and branded hotels by Razib Marketing.",
  icons: {
    icon: "/razib-marketing-logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable}`}>
      <body className="font-sans text-slate-800 antialiased selection:bg-brand selection:text-slate-900">{children}</body>
    </html>
  );
}
