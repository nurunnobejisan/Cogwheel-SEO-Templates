import type { Metadata } from "next";
import { OperatorConsole } from "@/components/OperatorConsole";

export const metadata: Metadata = {
  title: "Operator Console — Cogwheel Platform",
  description:
    "Governance and operations for the Cogwheel SEO autofix platform: approvals, deployment history with one-click undo, a tamper-evident audit log, connected targets and self-healing runs.",
};

export const dynamic = "force-dynamic";

export default function PlatformPage() {
  return <OperatorConsole />;
}