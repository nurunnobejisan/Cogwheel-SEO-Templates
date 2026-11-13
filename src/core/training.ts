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
