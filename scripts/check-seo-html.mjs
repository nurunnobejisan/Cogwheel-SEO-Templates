/**
 * Parses the built Next.js HTML to verify per-page SEO basics.
 * Run after `next build`: npm run check:seo-html
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = ".next/server/app";
const failures = [];

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith(".html") ? [path] : [];
  });
}

function match(html, regex) {
  return html.match(regex)?.[1] ?? null;
}

const pages = walk(ROOT)
  .filter((path) => !path.endsWith("_not-found.html"))
  .sort();
const ogTitles = new Map();

for (const path of pages) {
  const route = relative(ROOT, path).replace(/\.html$/, "") || "/";
  const html = readFileSync(path, "utf8");
  const h1Count = (html.match(/<h1\b/gi) ?? []).length;
  const ogTitle = match(html, /<meta property="og:title" content="([^"]*)"/);
  const canonical = /<link rel="canonical"/.test(html);
  const ogImage = /<meta property="og:image" content="([^"]*)"/.test(html);
  const ldJson = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);

  if (h1Count !== 1) failures.push(`${route}: expected exactly 1 h1, found ${h1Count}`);
  if (!canonical) failures.push(`${route}: missing canonical link`);
  if (!ogTitle) failures.push(`${route}: missing og:title`);
  if (!ogImage) failures.push(`${route}: missing og:image`);
  if (ldJson.length === 0) failures.push(`${route}: missing JSON-LD`);
  for (const block of ldJson) {
    try {
      JSON.parse(block);
    } catch {
      failures.push(`${route}: invalid JSON-LD`);
    }
  }
  if (ogTitle) {
    if (ogTitles.has(ogTitle)) failures.push(`${route}: duplicate og:title with ${ogTitles.get(ogTitle)}`);
    ogTitles.set(ogTitle, route);
  }
  if (route === "/") {
    const title = match(html, /<title>([^<]*)<\/title>/);
    if (title !== ogTitle) failures.push(`/: <title> (${title}) does not match og:title (${ogTitle})`);
  }
}

console.log(`Checked ${pages.length} rendered pages: ${pages.map((p) => relative(ROOT, p)).join(", ")}`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("SEO HTML checks passed.");
