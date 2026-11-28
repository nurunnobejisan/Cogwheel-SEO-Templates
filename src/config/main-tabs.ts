/** Every dashboard tab id, including card-driven tabs without a nav button. */
export const MAIN_TAB_IDS = [
  "home",
  "unified-seo",
  "keywords",
  "tasks",
  "labs",
  "crawl",
  "studio",
  "geo",
  "compset",
] as const;

export type MainTab = (typeof MAIN_TAB_IDS)[number];

export function isMainTab(value: unknown): value is MainTab {
  return typeof value === "string" && (MAIN_TAB_IDS as readonly string[]).includes(value);
}
