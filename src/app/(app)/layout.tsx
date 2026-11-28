import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
