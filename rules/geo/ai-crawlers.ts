/**
 * AI-crawler rules in robots.txt.
 *
 * Parses robots.txt into user-agent groups and evaluates the site root (`/`)
 * for the crawlers that power AI search. Follows the usual longest-match rule,
 * with `Allow` winning ties. We never assume access: if the file cannot be
 * fetched, the check is `unavailable` rather than "allowed".
 */

import { AI_CRAWLERS, type AiCrawlerCheck, type CrawlerRuleResult, type CrawlerStatus } from "./types.ts";

interface RobotsRule {
  allow: boolean;
  path: string;
}

interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
}

export function parseRobotsTxt(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let agents: string[] = [];
  let rules: RobotsRule[] = [];
  let lastLineWasAgent = false;

  const flush = (): void => {
    if (agents.length > 0) groups.push({ agents, rules });
    agents = [];
    rules = [];
    lastLineWasAgent = false;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;

    const agentMatch = /^user-agent\s*:\s*(.+)$/i.exec(line);
    if (agentMatch) {
      if (!lastLineWasAgent && (agents.length > 0 || rules.length > 0)) flush();
      agents.push(agentMatch[1].trim());
      lastLineWasAgent = true;
      continue;
    }

    const ruleMatch = /^(allow|disallow)\s*:\s*(.*)$/i.exec(line);
    if (ruleMatch && agents.length > 0) {
      rules.push({ allow: ruleMatch[1].toLowerCase() === "allow", path: ruleMatch[2].trim() });
      lastLineWasAgent = false;
      continue;
    }

    // Sitemap/Crawl-delay/unknown directives do not affect UA grouping.
    lastLineWasAgent = false;
  }
  flush();
  return groups;
}

function normalizeAgent(value: string): string {
  return value.split(/[/\s]/)[0]!.trim().toLowerCase();
}

function ruleMatchesPath(rulePath: string, targetPath: string): boolean {
  if (!rulePath) return false;
  const escaped = rulePath
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\$$/, "$");
  try {
    return new RegExp(`^${escaped}`).test(targetPath);
  } catch {
    return targetPath.startsWith(rulePath.replace(/\*/g, ""));
  }
}

/** Evaluate the site root for a bot against its applicable groups. */
function evaluateBot(bot: string, groups: RobotsGroup[]): CrawlerRuleResult {
  const normalized = normalizeAgent(bot);
  const specific = groups.filter((group) =>
    group.agents.some((agent) => {
      const normalizedAgent = normalizeAgent(agent);
      return normalizedAgent !== "*" && (normalized === normalizedAgent || normalized.startsWith(normalizedAgent));
    })
  );
  const wildcard = groups.filter((group) => group.agents.some((agent) => agent.trim() === "*"));
  const applicable = specific.length > 0 ? specific : wildcard;

  if (applicable.length === 0) {
    return { bot, status: "unmentioned", matchedRule: null, matchedGroup: null };
  }

  const rules = applicable.flatMap((group) => group.rules);
  const matching = rules
    .filter((rule) => ruleMatchesPath(rule.path, "/"))
    .sort((a, b) => {
      // Longest pattern wins; Allow wins ties.
      if (b.path.length !== a.path.length) return b.path.length - a.path.length;
      return Number(b.allow) - Number(a.allow);
    });

  const decisive = matching[0];
  if (!decisive) {
    return {
      bot,
      status: "allowed",
      matchedRule: null,
      matchedGroup: applicable.map((group) => group.agents.join(", ")).join(" | "),
    };
  }

  const status: CrawlerStatus = decisive.allow ? "allowed" : "blocked";
  return {
    bot,
    status,
    matchedRule: `${decisive.allow ? "Allow" : "Disallow"}: ${decisive.path}`,
    matchedGroup: applicable.map((group) => group.agents.join(", ")).join(" | "),
  };
}

export interface RobotsInput {
  robotsUrl: string;
  statusCode: number | null;
  text?: string | null;
  error?: string;
}

export function checkAiCrawlers(input: RobotsInput): AiCrawlerCheck {
  const base: AiCrawlerCheck = {
    id: "ai_crawlers",
    label: "AI crawler access",
    provenance: "measured",
    robotsUrl: input.robotsUrl,
    status: "unavailable",
    bots: [],
    blockedBots: [],
    allowedBots: [],
    unmentionedBots: [],
    reason: input.error,
  };

  if (input.error || input.statusCode === null) {
    return {
      ...base,
      provenance: "unavailable",
      reason: input.error ?? "robots.txt could not be fetched",
      bots: AI_CRAWLERS.map((bot) => ({
        bot,
        status: "unmentioned" as const,
        matchedRule: null,
        matchedGroup: null,
      })),
    };
  }

  // 404/410 means "no robots.txt": robots access is unrestricted by default.
  const text = input.statusCode >= 200 && input.statusCode < 300 ? (input.text ?? "") : "";
  const groups = parseRobotsTxt(text);
  const bots = AI_CRAWLERS.map((bot) => evaluateBot(bot, groups));
  const blockedBots = bots.filter((entry) => entry.status === "blocked").map((entry) => entry.bot);
  const allowedBots = bots.filter((entry) => entry.status === "allowed").map((entry) => entry.bot);
  const unmentionedBots = bots.filter((entry) => entry.status === "unmentioned").map((entry) => entry.bot);

  return {
    ...base,
    status: input.statusCode >= 200 && input.statusCode < 300 ? "present" : "absent",
    bots,
    blockedBots,
    allowedBots,
    unmentionedBots,
    reason:
      input.statusCode >= 200 && input.statusCode < 300
        ? undefined
        : `HTTP ${input.statusCode} — no robots.txt; crawlers are unrestricted by default`,
  };
}
