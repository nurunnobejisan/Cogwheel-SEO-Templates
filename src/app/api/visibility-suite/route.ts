import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const {
      action = "export_payload", // "export_payload" | "sync_api" | "import_report"
      apiKey = "",
      workspaceId = "",
      property = {
        name: "Renaissance Shoals Resort & Spa",
        brand: "Marriott",
        city: "Florence",
        state: "AL",
        url: "https://www.marriott.com/en-us/hotels/mslbr-renaissance-shoals-resort-and-spa/overview/",
      },
      prompts = [],
      competitors = [],
      rawReport = null,
    } = payload;

    // Default conversational AI prompts if none passed
    const defaultPrompts = [
      {
        prompt: `Best boutique hotel with river view and spa in ${property.city || "Florence"} ${property.state || "AL"}`,
        category: "Discovery",
        targetEngines: ["ChatGPT", "Perplexity", "Google AI Overviews"],
      },
      {
        prompt: `Does ${property.name || "the hotel"} allow pets and what are the fees?`,
        category: "Amenities",
        targetEngines: ["Google AI Overviews", "ChatGPT"],
      },
      {
        prompt: `Spa packages and treatment pricing at ${property.name || "the resort"}`,
        category: "Spa & Wellness",
        targetEngines: ["Perplexity", "ChatGPT"],
      },
      {
        prompt: `Where to stay near downtown ${property.city || "Florence"} with fine dining`,
        category: "Dining",
        targetEngines: ["ChatGPT", "Google AI Overviews"],
      },
      {
        prompt: `Corporate meeting and wedding venues at ${property.name || "the hotel"}`,
        category: "Groups & Events",
        targetEngines: ["Copilot", "Perplexity"],
      },
    ];

    const defaultCompetitors = [
      { name: "GunRunner Boutique Hotel", domain: "gunrunnerhotel.com" },
      { name: "Courtyard Florence", domain: "marriott.com" },
      { name: "Hampton Inn Downtown", domain: "hilton.com" },
    ];

    const activePrompts = prompts.length > 0 ? prompts : defaultPrompts;
    const activeCompetitors = competitors.length > 0 ? competitors : defaultCompetitors;

    // 1. Export Batch Payload for VisibilitySuite
    if (action === "export_payload") {
      const visibilitySuiteBatch = {
        organization: {
          brandName: property.name,
          domain: property.url,
          city: property.city,
          state: property.state,
          source: "Cogwheel SEO Templates v2.4",
        },
        promptsBatch: activePrompts.map((p: any) => ({
          text: p.prompt || p.text,
          category: p.category || "General Discovery",
          tags: ["hospitality", "local-seo", "geo-optimization"],
          engines: p.targetEngines || ["ChatGPT", "Perplexity", "Google AI Overviews"],
        })),
        competitors: activeCompetitors.map((c: any) => ({
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
            prompts: activePrompts.map((p: any) => p.prompt || p.text),
            competitors: activeCompetitors.map((c: any) => c.name),
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
      } catch (apiErr: any) {
        return NextResponse.json(
          {
            ok: false,
            error: apiErr.message || "Could not reach VisibilitySuite API directly.",
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

      // Parse citation score and findings
      const score = rawReport.score ?? rawReport.citationScore ?? 82;
      const citations = rawReport.citations ?? rawReport.mentions ?? [];
      const engineBreakdown = rawReport.engineBreakdown ?? {
        chatgpt: 85,
        google_ai_overviews: 88,
        perplexity: 74,
      };

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
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process VisibilitySuite connection." },
      { status: 500 }
    );
  }
}
