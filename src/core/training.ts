import { randomUUID } from "node:crypto";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export interface AiTrainingRule {
  id: string;
  taskId: string | null;
  title: string;
  ruleText: string;
  exampleBad?: string | null;
  exampleGood?: string | null;
  active: boolean;
  createdAt: string;
}

const DEFAULT_SEED_RULES: AiTrainingRule[] = [
  {
    id: "seed-vanity-site-rule",
    taskId: "seo-only-visibility-report",
    title: "Soft Brand Vanity Site Rule (Michael)",
    ruleText:
      'When referring to "standalone sites for soft brands or independents", it means a vanity site. Not all soft brands have vanity sites. If a soft brand has a vanity site, Slide 5 (SEO Errors Report) applies; if it is brand-hosted only with no vanity site, omit Slide 5.',
    exampleBad: "Remove Slide 5 for all Curio/Tapestry/Autograph soft-brand properties.",
    exampleGood:
      "Check whether the soft brand has a vanity domain (e.g. thenines.com); keep Slide 5 when a vanity site exists.",
    active: true,
    createdAt: "2026-11-13T00:00:00.000Z",
  },
  {
    id: "seed-grounded-facts",
    taskId: null,
    title: "Strictly Grounded Property Claims",
    ruleText:
      "Never invent hotel amenities, awards, traffic numbers, or offers not present in crawl data, Semrush exports, or the property profile. Put unsupported claims in the Flag Summary.",
    active: true,
    createdAt: "2026-11-13T00:00:00.000Z",
  },
  {
    id: "seed-rm-property-taxonomy",
    taskId: null,
    title: "Razib Marketing Property Taxonomy (2026 Portfolio)",
    ruleText:
      "Classify properties accurately using the agency portfolio taxonomy: Full Flag Brand (e.g. Embassy Suites, Courtyard, Hilton Garden Inn, Fairfield, Residence Inn, Hyatt Place), Soft Brand.com (brand-hosted soft-brand URL), Soft Vanity / Vanity Site (standalone domain such as thenines.com, thecurtis.com, morrisonhouse.com, thealexandrian.com, grand1847.com, hotellajolla.com), Large/SMB Independent (e.g. Arrive Hotels, Senza, La Fonda, Coachman), and Restaurant.",
    exampleGood: "Treat The Nines Portland (Soft Vanity: thenines.com) separately from The Nines Portland (Branded: Soft Brand.com).",
    exampleBad: "Merging Soft Brand.com and Soft Vanity deliverables into one generic template.",
    active: true,
    createdAt: "2026-11-13T00:00:00.000Z",
  },
  {
    id: "seed-rm-deliverable-naming",
    taskId: "seo-baseline-ai-visibility",
    title: "Agency Deliverable Naming & Audit Tiers",
    ruleText:
      "Follow standard agency deliverable naming: '<Property Name> - SEO Baseline Overview' for baselines, '<Property Name> - Backlinking Strategy & Execution' for outreach, and align technical audits with 20/30/40 Points Audit and Technical Optimization checklists.",
    exampleGood: "The Nines Hotel Portland - SEO Baseline Overview",
    exampleBad: "Untitled SEO Report v1",
    active: true,
    createdAt: "2026-11-13T00:00:00.000Z",
  },
  {
    id: "seed-rm-ai-visibility-geo",
    taskId: "seo-baseline-ai-visibility",
    title: "AI Visibility & GEO Prompt Readiness",
    ruleText:
      "For Full Flag Brand, Soft Brand.com, Soft Vanity, and Large Independent properties, always evaluate AI Visibility / GEO prompt coverage, cited domains, brand sentiment, and direct-booking share of voice.",
    active: true,
    createdAt: "2026-11-13T00:00:00.000Z",
  },
  {
    id: "seed-visibility-suite-5-platforms",
    taskId: null,
    title: "5-Platform Generative Search Alignment (VisibilitySuite)",
    ruleText:
      "Align SEO recommendations with the 5 live AI tracking engines monitored across Cogwheel's 200+ property portfolio: Google AI Overviews, ChatGPT Search, Google Gemini, Perplexity, and AI Mode. Prioritize entity schema (Hotel, LodgingBusiness, DaySpa, FoodEstablishment) and direct-booking citation triggers.",
    exampleGood: "Optimize FAQ schema and spa pricing for citations across ChatGPT Search, Google AI Overviews, Gemini, and Perplexity.",
    exampleBad: "Targeting only classic 10 blue links Google desktop search while ignoring AI answer citations.",
    active: true,
    createdAt: "2026-11-14T00:00:00.000Z",
  },
  {
    id: "seed-management-group-benchmarking",
    taskId: null,
    title: "Hospitality Management Group & Comp-Set Segmentation",
    ruleText:
      "Identify property management groups (HHM Groups 1/2/3, Sage Hospitality, Bentley Legacy, HRI Hospitality, PCH Hospitality, Milford Group). Never frame sister hotels from the same management portfolio as hostile comp-set competitors; benchmark exclusively against non-portfolio local market rivals.",
    exampleGood: "Comparing Residence Inn Tampa against neighboring Hyatt Place rather than an HHM sister hotel.",
    exampleBad: "Selecting an HHM Group 1 sister hotel as the primary hostile competitor in a local ranking battle.",
    active: true,
    createdAt: "2026-11-14T00:00:00.000Z",
  },
  {
    id: "seed-brand-standard-direct-booking",
    taskId: null,
    title: "Brand Flag vs Soft Brand Direct Booking Paths",
    ruleText:
      "For Full Flag properties (Residence Inn, Courtyard, Fairfield, Embassy Suites, Homewood Suites, Hyatt Place), enforce official direct booking and loyalty integration (Marriott Bonvoy, Hilton Honors, World of Hyatt). For Soft Brands (Autograph Collection, Curio, Tribute, Thompson) and Independents, highlight distinctive local amenities, signature dining, and vanity site offerings.",
    exampleGood: "Highlighting Marriott Bonvoy member rates on Courtyard Fort Wayne while highlighting River View Day Spa on Renaissance Shoals.",
    active: true,
    createdAt: "2026-11-14T00:00:00.000Z",
  },
];

const memoryRules: AiTrainingRule[] = [...DEFAULT_SEED_RULES];

function mapRow(row: Record<string, unknown>): AiTrainingRule {
  return {
    id: row.id as string,
    taskId: (row.task_id as string | null) ?? null,
    title: row.title as string,
    ruleText: row.rule_text as string,
    exampleBad: (row.example_bad as string | null) ?? null,
    exampleGood: (row.example_good as string | null) ?? null,
    active: Boolean(row.active),
    createdAt: row.created_at as string,
  };
}

export async function listTrainingRules(taskId?: string | null): Promise<AiTrainingRule[]> {
  if (!isSupabaseConfigured()) {
    return memoryRules.filter((r) => !taskId || r.taskId === null || r.taskId === taskId);
  }

  const db = getSupabase();
  const { data, error } = await db
    .from("ai_training_rules")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !data || data.length === 0) {
    return memoryRules.filter((r) => !taskId || r.taskId === null || r.taskId === taskId);
  }

  const rows = data.map(mapRow);
  return rows.filter((r) => !taskId || r.taskId === null || r.taskId === taskId);
}

export async function addTrainingRule(input: {
  taskId?: string | null;
  title: string;
  ruleText: string;
  exampleBad?: string;
  exampleGood?: string;
}): Promise<AiTrainingRule> {
  const rule: AiTrainingRule = {
    id: randomUUID(),
    taskId: input.taskId || null,
    title: input.title.trim(),
    ruleText: input.ruleText.trim(),
    exampleBad: input.exampleBad?.trim() || null,
    exampleGood: input.exampleGood?.trim() || null,
    active: true,
    createdAt: new Date().toISOString(),
  };

  if (!isSupabaseConfigured()) {
    memoryRules.unshift(rule);
    return rule;
  }

  const db = getSupabase();
  const { data, error } = await db
    .from("ai_training_rules")
    .insert({
      id: rule.id,
      task_id: rule.taskId,
      title: rule.title,
      rule_text: rule.ruleText,
      example_bad: rule.exampleBad,
      example_good: rule.exampleGood,
      active: true,
    })
    .select("*")
    .single();

  if (error || !data) {
    memoryRules.unshift(rule);
    return rule;
  }
  return mapRow(data);
}

export async function toggleTrainingRule(id: string, active: boolean): Promise<AiTrainingRule | null> {
  const mem = memoryRules.find((r) => r.id === id);
  if (mem) mem.active = active;

  if (!isSupabaseConfigured()) {
    return mem ?? null;
  }

  const db = getSupabase();
  const { data, error } = await db
    .from("ai_training_rules")
    .update({ active })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) return mem ?? null;
  return mapRow(data);
}

export async function deleteTrainingRule(id: string): Promise<boolean> {
  const idx = memoryRules.findIndex((r) => r.id === id);
  if (idx >= 0) memoryRules.splice(idx, 1);

  if (!isSupabaseConfigured()) {
    return idx >= 0;
  }

  const db = getSupabase();
  const { error } = await db.from("ai_training_rules").delete().eq("id", id);
  return !error || idx >= 0;
}

/**
 * Formats active global + task-specific training rules into a concise system prompt appendix.
 */
export async function formatTrainingContext(taskId?: string): Promise<string> {
  const rules = (await listTrainingRules(taskId)).filter((r) => r.active);
  if (rules.length === 0) return "";

  const lines = rules.map((r) => {
    const scope = r.taskId ? `[${r.taskId}]` : "[Global]";
    const examples = [
      r.exampleGood ? `  Good: ${r.exampleGood}` : "",
      r.exampleBad ? `  Avoid: ${r.exampleBad}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    return `- ${scope} ${r.title}: ${r.ruleText}${examples ? `\n${examples}` : ""}`;
  });

  return `\n\nTEAM TRAINING RULES & FEEDBACK (MUST FOLLOW):\n${lines.join("\n")}`;
}

