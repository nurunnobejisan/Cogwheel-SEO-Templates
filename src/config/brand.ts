/** Single source of truth for public product identity and attribution. */

export const brand = {
  name: "SEO & GEO Studio",
  owner: "Nurunnobe Jisan",
  siteUrl: "https://seo-studio.vercel.app",
  description:
    "Technical, On-Page, Off-Page, Local & AI-search (GEO) workflows in one free-first workspace.",
} as const;

/** One title template is applied in the root layout; page titles omit the suffix. */
export function pageTitle(title: string): string {
  return `${title} — ${brand.name}`;
}
