import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const {
      action = "export_payload", // "export_payload" | "sync_api" | "import_report"
      apiKey = "",
      workspaceId = "",
      property = {},
      prompts = [],
      competitors = [],
      rawReport = null,
    } = payload;

    // No default property, competitor or prompt is injected. The browser sends
    // the operator-supplied batch; an empty batch stays empty.
    const activePrompts = Array.isArray(prompts) ? prompts : [];
    const activeCompetitors = Array.isArray(competitors) ? competitors : [];

    // 1. Export Batch Payload for VisibilitySuite
    if (action === "export_payload") {
      if (!property.name || !property.url) {
        return NextResponse.json(
          { error: "A property name and URL are required before exporting a prompt batch." },
          { status: 400 }
        );
      }

      const visibilitySuiteBatch = {
        organization: {
          brandName: property.name,
          domain: property.url,
          city: property.city || "",
          state: property.state || "",
          source: "Cogwheel SEO Templates",
        },
        promptsBatch: activePrompts.map((p: { prompt?: string; text?: string; category?: string; targetEngines?: string[] }) => ({
          text: p.prompt || p.text || "",
          category: p.category || "General Discovery",
          tags: ["hospitality", "local-seo", "geo-optimization"],
          engines: p.targetEngines || ["ChatGPT", "Perplexity", "Google AI Overviews"],
        })),
        competitors: activeCompetitors.map((c: { name: string; domain?: string }) => ({
          name: c.name,
          domain: c.domain || "",
        })),
        createdAt: new Date().toISOString(),
      };

      return NextResponse.json({
        ok: true,
        action: "export_payload",
        batchPayload: visibilitySuiteBatch,
        summary: {
          property: property.name,
          promptCount: activePrompts.length,
          competitorCount: activeCompetitors.length,
        },
      });
    }

    // 2. Direct API Sync to VisibilitySuite API v1
    if (action === "sync_api") {
      if (!property.name || !property.url) {
        return NextResponse.json(
          { error: "A property name and URL are required before syncing." },
          { status: 400 }
        );
      }
      if (!apiKey) {
        return NextResponse.json(
          { error: "VisibilitySuite API Key is required for direct sync. You can find this in your VisibilitySuite Dashboard Settings." },
          { status: 400 }
        );
      }

      try {
        const vsEndpoint = "https://api.visibilitysuite.ai/api/v1/onboarding/prompts/batch";
        const res = await fetch(vsEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            ...(workspaceId ? { "X-Workspace-Id": workspaceId } : {}),
          },
          body: JSON.stringify({
            brandName: property.name,
            domain: property.url,
            prompts: activePrompts.map((p: { prompt?: string; text?: string }) => p.prompt || p.text || ""),
            competitors: activeCompetitors.map((c: { name: string }) => c.name),
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`VisibilitySuite API responded with ${res.status}: ${errText}`);
        }

        const data = await res.json();
        return NextResponse.json({
          ok: true,
          action: "sync_api",
          message: "Data successfully synced with VisibilitySuite.ai!",
          data,
        });
      } catch (apiErr: unknown) {
        const msg = apiErr instanceof Error ? apiErr.message : "Could not reach VisibilitySuite API directly.";
        return NextResponse.json(
          {
            ok: false,
            error: msg,
            note: "Please verify your API key or use the 1-Click Batch Upload file.",
          },
          { status: 502 }
        );
      }
    }

    // 3. Import Snapshot Report from VisibilitySuite
    if (action === "import_report") {
      if (!rawReport) {
        return NextResponse.json(
          { error: "No report data provided to import." },
          { status: 400 }
        );
      }

      // Parse citation score and findings. Never invent a score: if the report
      // does not carry one, return null so the UI shows "not reported".
      const score = rawReport.score ?? rawReport.citationScore ?? null;
      const citations = rawReport.citations ?? rawReport.mentions ?? [];
      const engineBreakdown = rawReport.engineBreakdown ?? null;

      return NextResponse.json({
        ok: true,
        action: "import_report",
        imported: {
          score,
          citations,
          engineBreakdown,
          timestamp: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to process VisibilitySuite connection.";
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
