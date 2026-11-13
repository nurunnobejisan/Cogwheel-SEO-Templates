import { randomUUID } from "node:crypto";
import { addTrainingRule, toggleTrainingRule, type AiTrainingRule } from "./training";

export type FeedbackCategory = "seo" | "design";
export type AccentTheme = "lime" | "sky" | "emerald" | "indigo" | "amber";
export type LayoutDensity = "comfortable" | "compact";
export type LandingTab = "home" | "tasks" | "crawl" | "studio";

export interface DesignSettings {
  accentTheme: AccentTheme;
  density: LayoutDensity;
  defaultTab: LandingTab;
  showSummaryCards: boolean;
  workspaceSubtitle: string;
}

export interface TrainingChangeEntry {
  id: string;
  authorName: string;
  category: FeedbackCategory | "blocked";
  requestText: string;
  status: "applied" | "blocked" | "reverted";
  summary: string;
  beforeValue?: string;
  afterValue?: string;
  ruleId?: string;
  revertedAt?: string;
  createdAt: string;
}

export const DEFAULT_DESIGN_SETTINGS: DesignSettings = {
  accentTheme: "lime",
  density: "comfortable",
  defaultTab: "home",
  showSummaryCards: true,
  workspaceSubtitle: "Direct-booking growth workflows across On Page, Technical, Off Page, Local & Reporting",
};

let currentDesignSettings: DesignSettings = { ...DEFAULT_DESIGN_SETTINGS };
const changeHistory: TrainingChangeEntry[] = [];

const RESTRICTED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\b(api[_\s-]?key|secret|token|password|credential|\.env|supabase|database|sql|drop\s+table)\b/i,
    reason: "Security & database settings cannot be modified from Train AI.",
  },
  {
    pattern: /\b(delete\s+all|wipe|reset\s+all|remove\s+all\s+rules|clear\s+history|destroy)\b/i,
    reason: "Bulk deletion of rules or history is blocked. You can only toggle or revert individual items.",
  },
  {
    pattern: /\b(bypass|disable\s+validation|ignore\s+guardrail|override\s+system|admin\s+access|auth)\b/i,
    reason: "Core validation and access controls cannot be bypassed.",
  },
];

const TASK_KEYWORDS: Array<{ taskId: string; keywords: RegExp }> = [
  { taskId: "title-meta", keywords: /\b(title\s*tag|meta\s*description|title\s*&?\s*meta)\b/i },
  { taskId: "heading-structure", keywords: /\b(h1|h2|heading\s*structure)\b/i },
  { taskId: "technical-audit", keywords: /\b(technical\s*audit|robots\.txt|canonical|redirect|404|broken\s*link)\b/i },
  { taskId: "image-optimization", keywords: /\b(alt\s*text|image\s*opt|img\s*alt)\b/i },
  { taskId: "duplicate-content-audit", keywords: /\b(duplicate\s*content|thin\s*content)\b/i },
  { taskId: "schema-markup", keywords: /\b(schema|json-ld|structured\s*data)\b/i },
  { taskId: "seo-only-visibility-report", keywords: /\b(visibility\s*report|monthly\s*deck|slide\s*5|pptx)\b/i },
  { taskId: "seo-baseline-ai-visibility", keywords: /\b(baseline|ai\s*visibility|geo\s*visibility)\b/i },
  { taskId: "usp-headline-optimization", keywords: /\b(usp|headline|hilton\s*copy)\b/i },
  { taskId: "keyword-research", keywords: /\b(keyword\s*research|78-?kw|keyword\s*matrix)\b/i },
];

export function getDesignSettings(): DesignSettings {
  return { ...currentDesignSettings };
}

export function listChangeHistory(): TrainingChangeEntry[] {
  return [...changeHistory];
}

export function resetDesignSettingsForTest(): void {
  currentDesignSettings = { ...DEFAULT_DESIGN_SETTINGS };
  changeHistory.length = 0;
}

function inferTaskId(text: string): string | null {
  for (const entry of TASK_KEYWORDS) {
    if (entry.keywords.test(text)) return entry.taskId;
  }
  return null;
}

function deriveRuleTitle(authorName: string, feedbackText: string): string {
  const cleaned = feedbackText.replace(/\s+/g, " ").trim();
  const short = cleaned.length > 48 ? `${cleaned.slice(0, 45).trim()}...` : cleaned;
  return `${authorName}: ${short}`;
}

function parseDesignFeedback(
  feedbackText: string,
  explicitPatch?: Partial<DesignSettings>,
): { next: DesignSettings; diffs: string[]; beforeSummary: string; afterSummary: string } | { error: string } {
  const prev = { ...currentDesignSettings };
  const next = { ...currentDesignSettings };
  const diffs: string[] = [];
  const lower = feedbackText.toLowerCase();

  if (explicitPatch) {
    if (explicitPatch.accentTheme && explicitPatch.accentTheme !== prev.accentTheme) {
      next.accentTheme = explicitPatch.accentTheme;
      diffs.push(`Theme: ${prev.accentTheme} -> ${next.accentTheme}`);
    }
    if (explicitPatch.density && explicitPatch.density !== prev.density) {
      next.density = explicitPatch.density;
      diffs.push(`Density: ${prev.density} -> ${next.density}`);
    }
    if (explicitPatch.defaultTab && explicitPatch.defaultTab !== prev.defaultTab) {
      next.defaultTab = explicitPatch.defaultTab;
      diffs.push(`Default Tab: ${prev.defaultTab} -> ${next.defaultTab}`);
    }
    if (
      typeof explicitPatch.showSummaryCards === "boolean" &&
      explicitPatch.showSummaryCards !== prev.showSummaryCards
    ) {
      next.showSummaryCards = explicitPatch.showSummaryCards;
      diffs.push(`Summary Cards: ${prev.showSummaryCards ? "shown" : "hidden"} -> ${next.showSummaryCards ? "shown" : "hidden"}`);
    }
    if (explicitPatch.workspaceSubtitle && explicitPatch.workspaceSubtitle.trim() !== prev.workspaceSubtitle) {
      next.workspaceSubtitle = explicitPatch.workspaceSubtitle.trim().slice(0, 80);
      diffs.push(`Subtitle updated`);
    }
  } else {
    // Parse natural language design tweaks safely
    if (/\b(blue|sky|ocean)\b/.test(lower)) {
      next.accentTheme = "sky";
    } else if (/\b(emerald|forest|dark\s*green)\b/.test(lower)) {
      next.accentTheme = "emerald";
    } else if (/\b(indigo|purple|violet)\b/.test(lower)) {
      next.accentTheme = "indigo";
    } else if (/\b(amber|gold|orange|yellow)\b/.test(lower)) {
      next.accentTheme = "amber";
    } else if (/\b(lime|brand|default\s*color|green)\b/.test(lower)) {
      next.accentTheme = "lime";
    }
    if (next.accentTheme !== prev.accentTheme) {
      diffs.push(`Theme: ${prev.accentTheme} -> ${next.accentTheme}`);
    }

    if (/\b(compact|tight|dense|smaller\s*spacing)\b/.test(lower)) {
      next.density = "compact";
    } else if (/\b(comfortable|spacious|normal\s*spacing|relaxed)\b/.test(lower)) {
      next.density = "comfortable";
    }
    if (next.density !== prev.density) {
      diffs.push(`Density: ${prev.density} -> ${next.density}`);
    }

    if (/\b(hide|remove)\s+(the\s+)?(summary|metric|stats?)\s*(cards?)?\b/.test(lower)) {
      next.showSummaryCards = false;
    } else if (/\b(show|display)\s+(the\s+)?(summary|metric|stats?)\s*(cards?)?\b/.test(lower)) {
      next.showSummaryCards = true;
    }
    if (next.showSummaryCards !== prev.showSummaryCards) {
      diffs.push(`Summary Cards: ${prev.showSummaryCards ? "shown" : "hidden"} -> ${next.showSummaryCards ? "shown" : "hidden"}`);
    }

    if (/\b(default|start|open)\b.*\b(seo\s*tasks|tasks)\b/.test(lower)) {
      next.defaultTab = "tasks";
    } else if (/\b(default|start|open)\b.*\b(site\s*crawl|crawl)\b/.test(lower)) {
      next.defaultTab = "crawl";
    } else if (/\b(default|start|open)\b.*\b(keyword\s*studio|studio)\b/.test(lower)) {
      next.defaultTab = "studio";
    } else if (/\b(default|start|open)\b.*\b(home)\b/.test(lower)) {
      next.defaultTab = "home";
    }
    if (next.defaultTab !== prev.defaultTab) {
      diffs.push(`Default Tab: ${prev.defaultTab} -> ${next.defaultTab}`);
    }
  }

  if (diffs.length === 0) {
    return {
      error:
        "No supported Design/UI change detected. Supported: theme color (lime, sky, emerald, indigo, amber), layout density (compact/comfortable), show/hide summary cards, or default tab.",
    };
  }

  if (diffs.length > 2) {
    return {
      error: "Too many design changes in one request (max 2 at a time). Please submit one or two focused changes.",
    };
  }

  return {
    next,
    diffs,
    beforeSummary: JSON.stringify(prev),
    afterSummary: JSON.stringify(next),
  };
}

export async function processTrainingFeedback(input: {
  authorName: string;
  category: FeedbackCategory;
  feedbackText: string;
  taskId?: string | null;
  designPatch?: Partial<DesignSettings>;
}): Promise<{
  status: "applied" | "blocked";
  entry: TrainingChangeEntry;
  rule?: AiTrainingRule;
  designSettings: DesignSettings;
  message: string;
}> {
  const authorName = input.authorName.trim();
  const feedbackText = input.feedbackText.trim();

  for (const rule of RESTRICTED_PATTERNS) {
    if (rule.pattern.test(feedbackText)) {
      const blockedEntry: TrainingChangeEntry = {
        id: randomUUID(),
        authorName,
        category: "blocked",
        requestText: feedbackText,
        status: "blocked",
        summary: `Blocked: ${rule.reason}`,
        createdAt: new Date().toISOString(),
      };
      changeHistory.unshift(blockedEntry);
      return {
        status: "blocked",
        entry: blockedEntry,
        designSettings: getDesignSettings(),
        message: rule.reason,
      };
    }
  }

  if (input.category === "design") {
    const parsed = parseDesignFeedback(feedbackText, input.designPatch);
    if ("error" in parsed) {
      const blockedEntry: TrainingChangeEntry = {
        id: randomUUID(),
        authorName,
        category: "blocked",
        requestText: feedbackText,
        status: "blocked",
        summary: `Not applied: ${parsed.error}`,
        createdAt: new Date().toISOString(),
      };
      changeHistory.unshift(blockedEntry);
      return {
        status: "blocked",
        entry: blockedEntry,
        designSettings: getDesignSettings(),
        message: parsed.error,
      };
    }

    currentDesignSettings = parsed.next;
    const summary = parsed.diffs.join(" · ");
    const entry: TrainingChangeEntry = {
      id: randomUUID(),
      authorName,
      category: "design",
      requestText: feedbackText,
      status: "applied",
      summary,
      beforeValue: parsed.beforeSummary,
      afterValue: parsed.afterSummary,
      createdAt: new Date().toISOString(),
    };
    changeHistory.unshift(entry);
    return {
      status: "applied",
      entry,
      designSettings: getDesignSettings(),
      message: `Design updated automatically (${summary}).`,
    };
  }

  // SEO Feedback -> auto-create active AI Training Rule
  const resolvedTaskId = input.taskId !== undefined ? input.taskId : inferTaskId(feedbackText);
  const title = deriveRuleTitle(authorName, feedbackText);
  const rule = await addTrainingRule({
    taskId: resolvedTaskId,
    title,
    ruleText: feedbackText,
  });

  const scopeLabel = resolvedTaskId ? `Task: ${resolvedTaskId}` : "All Tasks (Global)";
  const entry: TrainingChangeEntry = {
    id: randomUUID(),
    authorName,
    category: "seo",
    requestText: feedbackText,
    status: "applied",
    summary: `Added active SEO rule (${scopeLabel}): "${rule.title}"`,
    beforeValue: "No rule",
    afterValue: rule.ruleText,
    ruleId: rule.id,
    createdAt: rule.createdAt,
  };
  changeHistory.unshift(entry);

  return {
    status: "applied",
    entry,
    rule,
    designSettings: getDesignSettings(),
    message: `SEO rule saved & activated for ${scopeLabel}. All future AI runs will follow it automatically.`,
  };
}

export async function revertTrainingChange(historyId: string): Promise<{
  reverted: TrainingChangeEntry | null;
  designSettings: DesignSettings;
}> {
  const target = changeHistory.find((e) => e.id === historyId);
  if (!target || target.status !== "applied") {
    return { reverted: null, designSettings: getDesignSettings() };
  }

  if (target.category === "design" && target.beforeValue) {
    try {
      const prev = JSON.parse(target.beforeValue) as DesignSettings;
      currentDesignSettings = { ...DEFAULT_DESIGN_SETTINGS, ...prev };
    } catch {
      currentDesignSettings = { ...DEFAULT_DESIGN_SETTINGS };
    }
  } else if (target.category === "seo" && target.ruleId) {
    await toggleTrainingRule(target.ruleId, false);
  }

  target.status = "reverted";
  target.revertedAt = new Date().toISOString();
  return { reverted: { ...target }, designSettings: getDesignSettings() };
}

export function recordLegacyRuleHistory(authorName: string, rule: AiTrainingRule): TrainingChangeEntry {
  const entry: TrainingChangeEntry = {
    id: randomUUID(),
    authorName,
    category: "seo",
    requestText: rule.ruleText,
    status: "applied",
    summary: `Added active SEO rule (${rule.taskId ?? "Global"}): "${rule.title}"`,
    beforeValue: "No rule",
    afterValue: rule.ruleText,
    ruleId: rule.id,
    createdAt: rule.createdAt,
  };
  changeHistory.unshift(entry);
  return entry;
}

