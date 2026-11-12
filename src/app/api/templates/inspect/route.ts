import { NextResponse } from "next/server";
import { z } from "zod";
import { inspectGoogleDocTemplate, isGoogleConfigured, type TemplateInspection } from "@/lib/google";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  masterTemplateUrl: z.string().trim().min(1, "Master Template URL is required"),
  example1Url: z.string().trim().optional().default(""),
  example2Url: z.string().trim().optional().default(""),
});

export async function POST(req: Request) {
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid template URLs", issues: parsed.error.issues }, { status: 400 });
  }

  if (!isGoogleConfigured()) {
    return NextResponse.json(
      { error: "Google Workspace credentials are not configured (GOOGLE_SERVICE_ACCOUNT_B64)." },
      { status: 503 },
    );
  }

  try {
    const master = await inspectGoogleDocTemplate(parsed.data.masterTemplateUrl);
    const examples: TemplateInspection[] = [];
    for (const url of [parsed.data.example1Url, parsed.data.example2Url]) {
      if (url) {
        examples.push(await inspectGoogleDocTemplate(url));
      }
    }
    return NextResponse.json({ master, examples });
  } catch (e) {
    return NextResponse.json(
      { error: `Could not inspect Google Doc template: ${(e as Error).message}` },
      { status: 400 },
    );
  }
}

