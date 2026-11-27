/**
 * Bridge: thin-content / duplicate similarity audit via the Python service.
 *
 * The heavy lifting lives in `api/content_engine.py` (TF-IDF / Jaccard
 * similarity, thin-word counts); this route is the HTTP bridge that makes it
 * reachable from the product. The payload is zod-validated with the same caps
 * `api/server.py` enforces, so oversized input is rejected here before any
 * network call. The bridge is off unless `PYTHON_SERVICE_URL` is set (see
 * `@/lib/python/service`), and every failure mode answers with a stable code —
 * no upstream internals are echoed.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  PythonServiceError,
  callPythonServiceJson,
  pythonServiceConfig,
} from "@/lib/python/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Caps mirrored from `api/server.py` (MAX_PAGES / MAX_DOCUMENT_CHARS). */
const requestSchema = z.object({
  pages: z
    .array(
      z.object({
        id: z.string().min(1).max(200),
        url: z.string().max(2048).default(""),
        content: z.string().max(200_000),
      }),
    )
    .min(1)
    .max(50),
  maxSimilarity: z.number().min(0).max(1).optional(),
  minWords: z.number().int().min(0).max(100_000).optional(),
});

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "invalid_json" },
      { status: 400 },
    );
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid content similarity payload",
        code: "invalid_payload",
        issues: parsed.error.issues
          .slice(0, 8)
          .map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      },
      { status: 400 },
    );
  }

  let configured: boolean;
  try {
    configured = pythonServiceConfig() !== null;
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message, code: "python_service_misconfigured" },
      { status: 500 },
    );
  }
  if (!configured) {
    return NextResponse.json(
      {
        error: "Python service is not configured. Set PYTHON_SERVICE_URL to the api/server.py base URL.",
        code: "python_service_unconfigured",
      },
      { status: 501 },
    );
  }

  const body: Record<string, unknown> = { pages: parsed.data.pages };
  if (parsed.data.maxSimilarity !== undefined) body.max_similarity = parsed.data.maxSimilarity;
  if (parsed.data.minWords !== undefined) body.min_words = parsed.data.minWords;

  try {
    const result = await callPythonServiceJson<unknown>("/v1/content/similarity", { json: body });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PythonServiceError) {
      return NextResponse.json(
        { error: err.message, code: "python_service_error" },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { error: "Python service request failed", code: "python_service_error" },
      { status: 502 },
    );
  }
}
