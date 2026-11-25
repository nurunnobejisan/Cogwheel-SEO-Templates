import { NextRequest, NextResponse } from "next/server";
import { principalFromRequest, isAuthenticatedPrincipal } from "@/lib/platform/auth";
import { getAllUsage } from "@/core/brain/metering";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const principal = await principalFromRequest({ header: (n: string) => req.headers.get(n) });
  if (!isAuthenticatedPrincipal(principal)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const all = await getAllUsage();
  return NextResponse.json({ success: true, usage: all });
}
