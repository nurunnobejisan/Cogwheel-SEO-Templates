import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import * as XLSX from "xlsx";
import { safeFetch, readTextCapped, assertEgressAllowed } from "@/lib/security/egress";
import { PythonServiceError, callPythonService, pythonServiceConfig } from "@/lib/python/service";

const execFileAsync = promisify(execFile);

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface CrawlCacheEntry {
  timestamp: number;
  data: {
    target_url: string;
    page_title: string;
    crawled_pages: number;
    sitemap_urls: number;
    page_topics: string[];
    website_services: string[];
    workbook_services: string[];
    matched_services: string[];
    unmatched_services: string[];
    workbook_keyword_count: number;
  };
}

const CRAWL_CACHE = new Map<string, CrawlCacheEntry>();
const CRAWL_CACHE_TTL_MS = 15 * 60 * 1000; // 15-minute in-memory cache

const SERVICE_PATTERNS: Record<string, RegExp> = {
  lodging: /\b(?:hotels?|inns?|motels?|lodging|stays?|places\s+to\s+stay|rooms?)\b/i,
  accommodations: /\b(?:accommodations?)\b/i,
  resort: /\b(?:resorts?|retreats?|getaways?)\b/i,
  spa: /\b(?:spas?|massages?|facials?|saunas?|wellness|day\s+spas?)\b/i,
  pool: /\b(?:pools?|swim(?:ming)?|waterparks?|lazy\s+river)\b/i,
  hot_tub: /\b(?:jacuzzis?|hot\s+tubs?|whirlpools?)\b/i,
  suites: /\b(?:suites?|extended\s+stay|kitchenettes?)\b/i,
  boutique: /\b(?:boutique)\b/i,
  luxury: /\b(?:luxury|luxurious|5\s+star|five\s+star|4\s+star|four\s+star|upscale)\b/i,
  pet_friendly: /\b(?:pets?|pet\s+friendly|dogs?|dog\s+friendly)\b/i,
  wedding: /\b(?:weddings?|bridal|ceremon(?:y|ies)|receptions?)\b/i,
  meetings_events: /\b(?:meetings?|conferences?|conventions?|ballrooms?|banquets?|events?)\b/i,
  venues: /\b(?:venues?)\b/i,
  dining: /\b(?:restaurants?|dining|bistros?|steakhouses?)\b/i,
  breakfast: /\b(?:breakfast|brunch)\b/i,
  things_to_do: /\b(?:things?\s+to\s+do|attractions?|activities|sightseeing)\b/i,
  waterfront: /\b(?:waterfront|riverfront|riverwalk|beachfront|oceanfront|lakefront|lakeside)\b/i,
  golf: /\b(?:golf(?:ing)?)\b/i,
  casino: /\b(?:casinos?|gaming|slots?)\b/i,
  ski: /\b(?:ski(?:ing)?|snowboard(?:ing)?)\b/i,
  all_inclusive: /\b(?:all[\s-]+inclusive)\b/i,
  family: /\b(?:famil(?:y|ies)|kids?)\b/i,
  romantic: /\b(?:romantic|couples?|honeymoon)\b/i,
  packages_deals: /\b(?:packages?|deals?|specials?|offers?|discounts?)\b/i,
};

const SERVICE_LABELS: Record<string, string> = {
  lodging: "Hotel & Lodging",
  accommodations: "Accommodations",
  resort: "Resort & Getaways",
  spa: "Spa & Wellness",
  pool: "Pool & Aquatics",
  hot_tub: "Hot Tub / Jacuzzi",
  suites: "Suites",
  boutique: "Boutique Hotel",
  luxury: "Luxury / Upscale",
  pet_friendly: "Pet-Friendly",
  wedding: "Weddings",
  meetings_events: "Meetings & Events",
  venues: "Event Venues",
  dining: "Restaurants & Dining",
  breakfast: "Breakfast",
  things_to_do: "Local Attractions / Things to Do",
  waterfront: "Waterfront / Riverfront",
  golf: "Golf",
  casino: "Casino",
  ski: "Ski",
  all_inclusive: "All-Inclusive",
  family: "Family-Friendly",
  romantic: "Romantic / Couples",
  packages_deals: "Packages & Deals",
};

function detectServicesInText(text: string): Set<string> {
  const cleaned = text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
  const found = new Set<string>();
  for (const [svc, pattern] of Object.entries(SERVICE_PATTERNS)) {
    if (pattern.test(cleaned)) {
      found.add(svc);
    }
  }
  return found;
}

function cleanTitleFromUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    const parts = parsed.pathname
      .split("/")
      .filter(Boolean)
      .filter((p) => !["en", "en-us", "hotels", "hotel", "overview"].includes(p.toLowerCase()));
    if (parts.length > 0) {
      const slug = parts[parts.length - 1] || parts[0];
      return slug
        .replace(/^[a-z0-9]{5}-/i, "") // remove Marriott property code like mslbr-
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
  } catch {
    // fallback
  }
  return urlStr;
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    const formData = await req.formData();

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION 1: CRAWL & SERVICE MATCHING
    // ─────────────────────────────────────────────────────────────────────────
    if (action === "crawl") {
      const rawTargetUrl = (formData.get("target_url") as string | null) || "";
      const xlsxFile = formData.get("xlsx") as File | null;

      let targetUrl = rawTargetUrl.trim();
      if (targetUrl && !/^https?:\/\//i.test(targetUrl)) {
        targetUrl = "https://" + targetUrl;
      }

      const workbookKeywords: string[] = [];
      let workbookPrimaryUrl = "";

      if (xlsxFile && typeof xlsxFile.arrayBuffer === "function") {
        try {
          const buf = await xlsxFile.arrayBuffer();
          const wb = XLSX.read(buf, { type: "array" });
          const firstSheet = wb.Sheets[wb.SheetNames[0]];
          if (firstSheet) {
            const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet);
            for (const row of rows) {
              const kw = (row["Keyword"] || row["keyword"] || row["Search Term"] || Object.values(row)[0]) as string;
              if (kw && typeof kw === "string") workbookKeywords.push(kw.trim());

              const u = (row["URL"] || row["Url"] || row["url"]) as string;
              if (u && typeof u === "string" && !workbookPrimaryUrl) {
                workbookPrimaryUrl = u.trim();
              }
            }
          }
        } catch (e) {
          console.warn("Could not read workbook keywords:", e);
        }
      }

      const effectiveUrl = targetUrl || workbookPrimaryUrl;
      if (!effectiveUrl) {
        return NextResponse.json(
          { error: "Please enter a Target Website URL or upload a Keywords Workbook with a URL column." },
          { status: 400 }
        );
      }

      // SSRF guard: reject internal hosts / hostnames resolving to private IPs.
      try {
        await assertEgressAllowed(effectiveUrl);
      } catch (err: unknown) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "Invalid target URL." },
          { status: 400 }
        );
      }

      const cacheKey = `${effectiveUrl.toLowerCase()}_${workbookKeywords.length}`;
      const cached = CRAWL_CACHE.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CRAWL_CACHE_TTL_MS) {
        return NextResponse.json(cached.data);
      }

      // High-speed robust crawler (SSRF-guarded: every hop is validated)
      let pageTitle = cleanTitleFromUrl(effectiveUrl);
      const urlText = effectiveUrl.replace(/[^a-z0-9]+/gi, " ");
      const webServices = detectServicesInText(urlText);
      const pageTopics: string[] = [];

      // Fetch homepage text with timeout
      try {
        const { response: res } = await safeFetch(
          effectiveUrl,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
          },
          { timeoutMs: 4500, maxRedirects: 3 },
        );

        if (res.ok) {
          const html = await readTextCapped(res, 1_500_000);
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch && titleMatch[1]) {
            const cleanT = titleMatch[1].replace(/[\r\n\t]+/g, " ").trim();
            if (cleanT.length > 3) pageTitle = cleanT;
          }

          const h1Matches = html.match(/<h[12][^>]*>([^<]+)<\/h[12]>/gi) || [];
          for (const h of h1Matches.slice(0, 5)) {
            const topic = h.replace(/<[^>]+>/g, "").trim();
            if (topic.length > 5 && topic.length < 50) pageTopics.push(topic);
          }

          // Detect services in body text
          const bodyText = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
                               .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
                               .replace(/<[^>]+>/g, " ");
          const bodyServices = detectServicesInText(bodyText);
          bodyServices.forEach((s) => webServices.add(s));
        }
      } catch (err) {
        // Network or CORS block: urlText detection is already complete
        console.warn("Website fetch timed out or blocked, using URL profile:", err);
      }

      // If URL contains Marriott / resort / spa / lodging keywords
      if (/marriott|hilton|hyatt|ihg|resort|hotel|inn|suites/i.test(effectiveUrl)) {
        webServices.add("lodging");
      }
      if (/resort/i.test(effectiveUrl)) {
        webServices.add("resort");
      }
      if (/spa/i.test(effectiveUrl)) {
        webServices.add("spa");
      }

      const wbServices = workbookKeywords.length > 0
        ? detectServicesInText(workbookKeywords.join(" "))
        : new Set<string>();

      // Matched services: intersect web and workbook, or use web if no workbook
      const matchedSvcs = new Set<string>();
      if (wbServices.size > 0) {
        for (const s of webServices) {
          if (wbServices.has(s)) matchedSvcs.add(s);
        }
        if (wbServices.has("lodging")) matchedSvcs.add("lodging");
      } else {
        webServices.forEach((s) => matchedSvcs.add(s));
      }

      const unmatchedWbSvcs = new Set<string>();
      if (wbServices.size > 0) {
        for (const s of wbServices) {
          if (!webServices.has(s)) unmatchedWbSvcs.add(s);
        }
      }

      const matchedLabels = Array.from(matchedSvcs)
        .map((s) => SERVICE_LABELS[s] || s)
        .sort();

      const websiteLabels = Array.from(webServices)
        .map((s) => SERVICE_LABELS[s] || s)
        .sort();

      const unmatchedLabels = Array.from(unmatchedWbSvcs)
        .map((s) => SERVICE_LABELS[s] || s)
        .sort();

      const responseData = {
        target_url: effectiveUrl,
        page_title: pageTitle,
        crawled_pages: 1,
        sitemap_urls: 0,
        page_topics: pageTopics.slice(0, 4),
        website_services: websiteLabels,
        workbook_services: Array.from(wbServices).map((s) => SERVICE_LABELS[s] || s).sort(),
        matched_services: matchedLabels,
        unmatched_services: unmatchedLabels,
        workbook_keyword_count: workbookKeywords.length,
      };

      CRAWL_CACHE.set(cacheKey, { timestamp: Date.now(), data: responseData });
      return NextResponse.json(responseData);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION 2: GENERATE POWERPOINT REPORT
    // ─────────────────────────────────────────────────────────────────────────
    const templateFile = formData.get("template") as File | null;
    const xlsxFile = formData.get("xlsx") as File | null;
    const pdfFile = formData.get("pdf") as File | null;
    const targetUrl = (formData.get("target_url") as string | null) || "";
    const hasVanitySite = (formData.get("has_vanity_site") as string | null) || "";

    if (!templateFile || !xlsxFile) {
      return NextResponse.json(
        { error: "Please upload both a .pptx template and an .xlsx workbook." },
        { status: 400 }
      );
    }

    const propertyNameMatch = (xlsxFile.name || "Report").replace(/\.[^/.]+$/, "");
    const safeName = propertyNameMatch.replace(/[^a-zA-Z0-9_-]+/g, "_");

    // Generation chain — first configured branch wins, nothing runs by default:
    //  1. PYTHON_SERVICE_URL set → POST the uploads to api/server.py over HTTP.
    //     The URL is server env only (never request-derived) and configuring it
    //     is the operator's explicit opt-in, so no local process is spawned and
    //     SEO_STUDIO_ALLOW_LOCAL_PYTHON does not apply to this branch.
    //  2. SEO_STUDIO_ALLOW_LOCAL_PYTHON=1 → spawn the local python-pptx builder
    //     via execFile (argument array, no shell) on a trusted self-hosted
    //     machine. Never available on serverless deployments.
    //  3. Otherwise → 501 with instructions.
    let bridgeConfigured = false;
    try {
      bridgeConfigured = pythonServiceConfig() !== null;
    } catch (err) {
      return NextResponse.json(
        { error: (err as Error).message, code: "python_service_misconfigured" },
        { status: 500 }
      );
    }

    if (bridgeConfigured) {
      try {
        const bridgeBody = new FormData();
        bridgeBody.append("template", templateFile);
        bridgeBody.append("xlsx", xlsxFile);
        if (pdfFile) bridgeBody.append("pdf", pdfFile);
        const upstream = await callPythonService("/v1/reports/seo-visibility", {
          formData: bridgeBody,
          timeoutMs: 55_000,
        });
        const deck = Buffer.from(await upstream.arrayBuffer());
        return new Response(deck, {
          status: 200,
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "Content-Disposition": `attachment; filename="seo_visibility_report_${safeName}.pptx"`,
          },
        });
      } catch (err) {
        const mapped = err instanceof PythonServiceError ? err : null;
        return NextResponse.json(
          {
            error: mapped ? mapped.message : "Report generation failed",
            code: "python_service_error",
          },
          { status: mapped ? mapped.status : 502 }
        );
      }
    }

    // Local builder (python-pptx): a host-process execution path, so it is
    // disabled unless an operator explicitly opts in on a trusted machine.
    if (process.env.SEO_STUDIO_ALLOW_LOCAL_PYTHON !== "1") {
      return NextResponse.json(
        {
          error:
            "Server-side report generation is disabled. Run `python3 api/seo_visibility_report.py --template <pptx> --xlsx <xlsx> --output <out.pptx>` locally, " +
            "or set SEO_STUDIO_ALLOW_LOCAL_PYTHON=1 on a trusted self-hosted instance.",
          code: "report_generation_disabled",
        },
        { status: 501 }
      );
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pptx-gen-"));
    const templatePath = path.join(tempDir, "template.pptx");
    const xlsxPath = path.join(tempDir, "keywords.xlsx");
    const pdfPath = pdfFile ? path.join(tempDir, "audit.pdf") : null;
    const outputPath = path.join(tempDir, "output.pptx");

    await fs.writeFile(templatePath, Buffer.from(await templateFile.arrayBuffer()));
    await fs.writeFile(xlsxPath, Buffer.from(await xlsxFile.arrayBuffer()));
    if (pdfFile && pdfPath) {
      await fs.writeFile(pdfPath, Buffer.from(await pdfFile.arrayBuffer()));
    }

    const scriptPath = path.resolve(process.cwd(), "api/seo_visibility_report.py");
    const scriptExists = await fs
      .stat(scriptPath)
      .then(() => true)
      .catch(() => false);
    if (!scriptExists) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      return NextResponse.json(
        { error: "Report generator script not found on this host." },
        { status: 501 },
      );
    }

    const args = [
      scriptPath,
      "--template", templatePath,
      "--xlsx", xlsxPath,
      "--output", outputPath,
    ];
    if (pdfPath) {
      args.push("--pdf", pdfPath);
    }

    try {
      // Argument-array exec (no shell). Paths are server-generated inside a
      // fresh temp dir, so no user-controlled value reaches the process args.
      await execFileAsync(process.env.PYTHON_BIN ?? "python3", args, {
        env: { ...process.env, PYTHONPATH: path.resolve(process.cwd(), "api") },
        timeout: 45_000,
        maxBuffer: 8 * 1024 * 1024,
      });
    } catch (err) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      return NextResponse.json(
        { error: `Report generation failed: ${(err as Error).message}` },
        { status: 500 },
      );
    }

    const outputBuffer = await fs.readFile(outputPath);
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});

    return new Response(outputBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="seo_visibility_report_${safeName}.pptx"`,
      },
    });
  } catch (error) {
    console.error("SEO Visibility Report API error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}

