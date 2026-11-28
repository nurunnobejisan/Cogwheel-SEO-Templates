import { PublicHeader } from "@/components/shell/PublicHeader";
import { SiteFooter } from "@/components/SiteFooter";

export default function PublicGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-text">
      <PublicHeader />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 md:px-6 md:py-8">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
