import { NextResponse } from "next/server";
import { buildReportFilename } from "@/lib/export";
import { exportGoogleDoc, isGoogleConfigured } from "@/lib/google";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const docId = (searchParams.get("docId") ?? "").trim();
  const format = searchParams.get("format") === "docx" ? "docx" : "pdf";
  const name = (searchParams.get("name") ?? "Hotel").trim();

  if (!docId || !/^[a-zA-Z0-9_-]{20,}$/.test(docId)) {
    return NextResponse.json({ error: "Invalid docId" }, { status: 400 });
  }
  if (!isGoogleConfigured()) {
    return NextResponse.json(
      { error: "Google Workspace credentials are not configured (GOOGLE_SERVICE_ACCOUNT_B64)." },
      { status: 503 },
    );
  }

  try {
    const buffer = await exportGoogleDoc(docId, format);
    const filename = buildReportFilename(name, format);
    const contentType =
      format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Export failed: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}

