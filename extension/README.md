# Cogwheel SEO & GEO Studio Inspector — Chrome Extension

**Built by Razib Marketing** for hospitality SEO directors, hotel owners, and marketing teams.

---

## Capabilities

1. **Live 100-Point Strategy Score**: Instantly audits any hotel page on a 100-point scale across 10 quality gates.
2. **10-Gate Quality Engine**: Checks Title tag length, Meta descriptions, H1 hierarchy, canonical tags, word count, image alt text, mobile viewport, OpenGraph meta, and GEO proximity.
3. **JSON-LD Schema & GEO AI Validator**: Automatically detects `@graph`, `Hotel`, `LodgingBusiness`, `LocalBusiness`, `FAQPage`, and `BreadcrumbList` schemas.
4. **1-Click Google Rich Results Test**: Directly validates the live page in Google's official testing tool.
5. **Direct Cogwheel Studio Bridge**: Transfers any hotel property into [Cogwheel SEO Studio](https://cogwheel-seo-templates.vercel.app) with one click to trigger Auto-Pilot crawls or Comp-Set matrices.
6. **One-Click Export**: Copies structured TSV for instant pasting into Google Sheets or downloads the full audit as JSON.

---

## How to Install in Google Chrome (Takes 30 seconds)

1. Open **Google Chrome**.
2. Navigate to: `chrome://extensions/`
3. In the top-right corner, turn **ON** the **Developer mode** toggle.
4. In the top-left corner, click **Load unpacked**.
5. Select the `extension/` folder inside this repository:
   ```
   /Users/jisanjomadder/Cogwheel-SEO-Templates/extension
   ```
6. The **Cogwheel SEO & GEO Studio Inspector** icon will appear in your Chrome toolbar!
7. Pin the extension to your toolbar for instant 1-click access when browsing any hotel website.

---

## Extension Structure
- `manifest.json`: Manifest V3 configuration.
- `popup.html`: Executive dark-mode inspection interface.
- `popup.css`: High-density SaaS typography and responsive layout.
- `popup.js`: DOM crawler, 100-point scoring engine, schema parser, and studio bridge.
- `background.js`: Background service worker managing live score badges on the extension icon.
- `icons/`: 16px, 32px, 48px, and 128px high-resolution brand icons.
