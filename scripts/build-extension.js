#!/usr/bin/env node
/**
 * SEO Studio Chrome Extension Build & Release Packaging Script
 * 
 * 1. Verifies manifest.json update_url and version synchronization
 * 2. Compiles TypeScript and builds production bundle with Vite
 * 3. Packages cogwheel-seo-studio.zip in public/
 * 4. Ensures updates.xml is bundled in public/ and dist/
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const EXT_DIR = path.join(ROOT_DIR, "chrome-extension");
const DIST_DIR = path.join(EXT_DIR, "dist");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const UPDATES_XML = path.join(ROOT_DIR, "updates.xml");
const MANIFEST_JSON = path.join(EXT_DIR, "public", "manifest.json");

console.log("================================================================================");
console.log(" SEO STUDIO CHROME EXTENSION — PRODUCTION BUILD & RELEASE PIPELINE");
console.log("================================================================================");

// 1. Verify Manifest and updates.xml synchronization
console.log("▶ [1/4] Verifying update_url and version synchronization...");
if (!fs.existsSync(MANIFEST_JSON)) {
  console.error("❌ ERROR: manifest.json not found at:", MANIFEST_JSON);
  process.exit(1);
}
if (!fs.existsSync(UPDATES_XML)) {
  console.error("❌ ERROR: updates.xml not found at:", UPDATES_XML);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_JSON, "utf-8"));
const updatesContent = fs.readFileSync(UPDATES_XML, "utf-8");

console.log(`  - Extension Version: v${manifest.version}`);
console.log(`  - Update URL: ${manifest.update_url}`);

if (!manifest.update_url || !manifest.update_url.includes("updates.xml")) {
  console.error("❌ ERROR: manifest.json missing valid update_url pointing to updates.xml!");
  process.exit(1);
}

if (!updatesContent.includes(`version='${manifest.version}'`) && !updatesContent.includes(`version="${manifest.version}"`)) {
  console.error(`❌ ERROR: updates.xml version does not match manifest.json (v${manifest.version})!`);
  process.exit(1);
}
console.log("✔ Version and auto-update URL verified.");

// 2. TypeScript compilation & production Vite bundle
console.log("\n▶ [2/4] Compiling TypeScript & building production bundle with Vite...");

const extBin = path.join(EXT_DIR, "node_modules", ".bin");
const tscBin = path.join(extBin, "tsc");
const viteBin = path.join(extBin, "vite");

if (!fs.existsSync(tscBin) || !fs.existsSync(viteBin)) {
  console.error("❌ ERROR: chrome-extension dependencies are missing. Run `npm install --prefix chrome-extension` first.");
  process.exit(1);
}

try {
  console.log("  - Running tsc --noEmit...");
  execSync(`"${process.execPath}" "${tscBin}" --noEmit`, { cwd: EXT_DIR, stdio: "inherit" });

  console.log("  - Running vite build (pages + module service worker)...");
  execSync(`"${process.execPath}" "${viteBin}" build`, { cwd: EXT_DIR, stdio: "inherit" });

  console.log("  - Running vite build (classic IIFE content script)...");
  execSync(`"${process.execPath}" "${viteBin}" build --config vite.content.config.ts`, {
    cwd: EXT_DIR,
    stdio: "inherit",
  });
} catch (err) {
  // Never package a partial or stale build.
  console.error("❌ ERROR: Extension TypeScript or Vite build failed:", err.message);
  process.exit(1);
}

if (!fs.existsSync(path.join(DIST_DIR, "manifest.json"))) {
  fs.copyFileSync(MANIFEST_JSON, path.join(DIST_DIR, "manifest.json"));
}

// A content script registered without "type": "module" must be a classic
// script. Reject any ES-module output so the shipped zip cannot regress (C5).
const contentPath = path.join(DIST_DIR, "content.js");
if (!fs.existsSync(contentPath)) {
  console.error("❌ ERROR: dist/content.js is missing — the content script did not build.");
  process.exit(1);
}
const contentSource = fs.readFileSync(contentPath, "utf-8");
if (/^\s*(import|export)\s/m.test(contentSource)) {
  console.error("❌ ERROR: dist/content.js contains ES module syntax; Chrome cannot load it as a content script.");
  process.exit(1);
}
console.log("✔ Extension compiled; content.js verified as a classic IIFE bundle.");

// 3. Packaging ZIP artifact for GitHub Releases
console.log("\n▶ [3/4] Packaging extension zip for GitHub Releases...");
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

const zipPath = path.join(PUBLIC_DIR, "cogwheel-seo-studio.zip");
try {
  // Remove first: `zip -r` updates an existing archive and would keep stale files.
  fs.rmSync(zipPath, { force: true });
  execSync(`zip -r "${zipPath}" . -x "*.DS_Store"`, { cwd: DIST_DIR, stdio: "inherit" });
  console.log(`✔ Created release ZIP: ${path.relative(ROOT_DIR, zipPath)}`);
} catch (err) {
  console.error("❌ ERROR: Failed to create zip package:", err.message);
  process.exit(1);
}

// 4. Copy updates.xml to public/ and dist/
console.log("\n▶ [4/4] Distributing updates.xml to release endpoints...");
fs.copyFileSync(UPDATES_XML, path.join(PUBLIC_DIR, "updates.xml"));
fs.copyFileSync(UPDATES_XML, path.join(DIST_DIR, "updates.xml"));
console.log("✔ updates.xml synchronized to public/updates.xml and dist/updates.xml.");

console.log("--------------------------------------------------------------------------------");
console.log("✔ SEO STUDIO EXTENSION BUILD COMPLETED CLEANLY! READY FOR GITHUB RELEASES.");
console.log("================================================================================");
process.exit(0);
