import type { Metadata } from "next";
import { OperatorConsole } from "@/components/OperatorConsole";

export const metadata: Metadata = {
  title: "Operator Console — SEO Studio",
  description:
    "Governance and operations for the SEO autofix platform: approvals, deployment history with one-click undo, a tamper-evident audit log, connected targets and self-healing runs.",
  // Internal operator surface — keep it out of search indexes.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function PlatformPage() {
  return <OperatorConsole />;
}