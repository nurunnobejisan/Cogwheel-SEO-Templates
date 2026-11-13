import type { RobotsRuleSet } from "./types";

export const CRAWLER_USER_AGENT = "HiltonSEOStudioCrawler/1.0 (+https://hilton-seo-studio.vercel.app)";
const BOT_TOKEN = "hiltonseostudiocrawler";

/**
 * Parses robots.txt selecting the most specific matching User-Agent group
 * (`HiltonSEOStudioCrawler` if present, otherwise `*`), plus all `Sitemap:` directives.
 */
export function parseRobotsTxt(raw: string): RobotsRuleSet {
  const lines = (raw || "").split(/\r?\n/);
  const sitemaps: string[] = [];

  type Group = { agents: string[]; allow: string[]; disallow: string[] };
  const groups: Group[] = [];
  let current: Group | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) {
      current = null;
      continue;
    }
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const directive = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (directive === "sitemap" && value) {
      if (!sitemaps.includes(value)) sitemaps.push(value);
      continue;
    }

    if (directive === "user-agent") {
      if (!current || current.allow.length > 0 || current.disallow.length > 0) {
        current = { agents: [], allow: [], disallow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (current && directive === "allow" && value) {
      current.allow.push(value);
    } else if (current && directive === "disallow") {
      if (value) current.disallow.push(value);
    }
  }

  const specific = groups.filter((g) => g.agents.some((a) => BOT_TOKEN.includes(a) && a !== "*"));
  const wildcard = groups.filter((g) => g.agents.includes("*"));
  const selected = specific.length > 0 ? specific : wildcard;

  const allow = selected.flatMap((g) => g.allow);
  const disallow = selected.flatMap((g) => g.disallow);

  return { allow, disallow, sitemaps, raw };
}

function matchRobotsRule(pathWithQuery: string, rule: string): boolean {
  if (!rule) return false;
  const escaped = rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  const anchored = escaped.endsWith("$") ? `^${escaped.slice(0, -2)}$` : `^${escaped}`;
  return new RegExp(anchored).test(pathWithQuery);
}

/**
 * Returns true if the URL path is allowed by the parsed robots.txt rules.
 * Longest matching rule wins; Allow wins ties with Disallow.
 */
export function isUrlAllowedByRobots(url: string, rules: RobotsRuleSet): boolean {
  let pathWithQuery = "/";
  try {
    const parsed = new URL(url);
    pathWithQuery = `${parsed.pathname}${parsed.search}`;
  } catch {
    return false;
  }

  let bestLen = -1;
  let allowed = true;

  for (const rule of rules.disallow) {
    if (matchRobotsRule(pathWithQuery, rule) && rule.length > bestLen) {
      bestLen = rule.length;
      allowed = false;
    }
  }
  for (const rule of rules.allow) {
    if (matchRobotsRule(pathWithQuery, rule) && rule.length >= bestLen) {
      bestLen = rule.length;
      allowed = true;
    }
  }

  return allowed;
}

export async function fetchRobotsTxt(origin: string, timeoutMs = 5000): Promise<RobotsRuleSet> {
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": CRAWLER_USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { allow: [], disallow: [], sitemaps: [], raw: "" };
    const text = await res.text();
    return parseRobotsTxt(text);
  } catch {
    return { allow: [], disallow: [], sitemaps: [], raw: "" };
  }
}
