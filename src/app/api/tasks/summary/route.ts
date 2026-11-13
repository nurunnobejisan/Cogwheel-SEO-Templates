import { NextResponse } from "next/server";
import { listLatestTaskRunsSummary } from "@/core/runs";

export const dynamic = "force-dynamic";

export async function GET() {
  const runs = await listLatestTaskRunsSummary();
  return NextResponse.json({ runs });
}

