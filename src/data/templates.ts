export interface ChecklistItem {
  id: string;
  task: string;
  description: string;
  priority: "Critical" | "High" | "Medium";
}

export interface CommonMistake {
  mistake: string;
  impact: string;
  remediation: string;
}

export interface KpiBenchmark {
  metric: string;
  target: string;
  timeframe: string;
}

export interface TemplateVariables {
  brandName: string;
  primaryKeyword: string;
  targetUrl: string;
  locationNiche: string;
  competitorDomain: string;
}

export interface SeoTemplate {
  id: string;
  slug: string;
  categorySlug: string;
  category:
    | "Technical SEO Audits"
    | "On-Page Content Briefs"
    | "Local SEO & GBP Checklists"
    | "Programmatic SEO Blueprints"
    | "Link Building & Digital PR Outreach"
    | "AI Search / GEO Optimization";
  title: string;
  metaTitle: string; // 50-60 chars
  metaDescription: string; // 145-155 chars
  directAnswer: string; // 45-60 words for AI GEO
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  estimatedTime: string;
  defaultVariables: TemplateVariables;
  checklist: ChecklistItem[];
  commonMistakes: CommonMistake[];
  kpiBenchmarks: KpiBenchmark[];
  contentMarkdown: string;
  schemaType: "FAQPage" | "Article" | "Hotel" | "LocalBusiness" | "SoftwareApplication" | "HowTo";
  relatedTemplateSlugs: string[];
}

export const CATEGORIES = [
  {
    name: "Technical SEO Audits",
    slug: "technical-seo",
    description: "Core Web Vitals, server response, crawl budgets, and JS hydration diagnostics.",
  },
  {
    name: "On-Page Content Briefs",
    slug: "on-page-seo",
    description: "High-intent copy formulas, pixel budgets, and keyword cannibalization matrices.",
  },
  {
    name: "Local SEO & GBP Checklists",
    slug: "local-seo",
    description: "Multi-property Google Business Profile optimization and UNAP citation cleanup.",
  },
  {
    name: "Programmatic SEO Blueprints",
    slug: "programmatic-seo",
    description: "Scalable location landing pages, amenities indexing, and URL hierarchy engines.",
  },
  {
    name: "Link Building & Digital PR Outreach",
    slug: "link-building",
    description: "High-tier destination media pitches, unlinked mention recovery, and partner links.",
  },
  {
    name: "AI Search / GEO Optimization",
    slug: "ai-search-geo",
    description: "Knowledge graph anchoring and structured Q&A for Gemini and ChatGPT Search.",
  },
] as const;

export const TEMPLATES_DATA: SeoTemplate[] = [
  // 1. Technical SEO Audits
  {
    id: "tech-01",
    slug: "core-web-vitals-audit",
    categorySlug: "technical-seo",
    category: "Technical SEO Audits",
    title: "Core Web Vitals & PageSpeed Technical Audit",
    metaTitle: "Core Web Vitals Technical SEO Audit — SEO Studio Suite", // 53
    metaDescription: "Master Core Web Vitals audit for hospitality sites: optimize LCP under 2.5s, achieve zero CLS, streamline TTFB, and fix render-blocking script execution.", // 153
    directAnswer: "A Core Web Vitals audit identifies bottlenecks affecting Largest Contentful Paint (LCP), Interaction to Next Paint (INP), and Cumulative Layout Shift (CLS). By optimizing hero images, deferring non-critical JavaScript, and establishing explicit container dimensions, websites achieve a 100% green assessment in Google PageSpeed Insights.",
    difficulty: "Advanced",
    estimatedTime: "2.5 hours",
    defaultVariables: {
      brandName: "Oceanfront Palms Resort",
      primaryKeyword: "luxury beachfront hotel",
      targetUrl: "https://www.oceanfrontpalms.com",
      locationNiche: "Miami Beach, FL",
      competitorDomain: "https://www.miamiluxuryresort.com",
    },
    checklist: [
      { id: "cwv-1", task: "Audit LCP Element Rendering", description: "Verify hero image uses fetchpriority='high' with modern AVIF/WebP formats and responsive srcset.", priority: "Critical" },
      { id: "cwv-2", task: "Eliminate Cumulative Layout Shift", description: "Set explicit width/height or aspect-ratio on all booking widgets, hero sliders, and banner frames.", priority: "Critical" },
      { id: "cwv-3", task: "Minimize Main-Thread JavaScript Work", description: "Audit third-party booking trackers, chat widgets, and tag managers to defer execution post-hydration.", priority: "High" },
      { id: "cwv-4", task: "Optimize Server Response Time (TTFB)", description: "Implement edge caching via Cloudflare or Fastly to keep global HTML delivery under 200ms.", priority: "High" },
    ],
    commonMistakes: [
      { mistake: "Lazy-loading above-the-fold hero imagery", impact: "Artificially delays LCP by 800ms-1500ms.", remediation: "Remove loading='lazy' and add fetchpriority='high' to primary hero banner." },
      { mistake: "Injecting unstyled banner overlays dynamically", impact: "Causes severe layout shifts (CLS > 0.25).", remediation: "Reserve CSS container aspect-ratio before async JS script loads." },
    ],
    kpiBenchmarks: [
      { metric: "Largest Contentful Paint (LCP)", target: "< 2.5s (Good)", timeframe: "30 Days" },
      { metric: "Cumulative Layout Shift (CLS)", target: "< 0.05 (Good)", timeframe: "Immediate" },
      { metric: "Interaction to Next Paint (INP)", target: "< 200ms (Good)", timeframe: "45 Days" },
    ],
    schemaType: "HowTo",
    relatedTemplateSlugs: ["javascript-rendering-hydration", "hotel-landing-page-brief", "generative-engine-optimization-playbook", "faq-structured-entity-framework"],
    contentMarkdown: `# Core Web Vitals & Performance Audit: [Brand Name]

## 1. Executive Diagnostic for [Brand Name]
- **Target URL**: [Target URL]
- **Target Keyword**: [Primary Keyword]
- **Market / Geo**: [LocationNiche]
- **Benchmark Competitor**: [Competitor Domain]

## 2. Critical Metric Thresholds
- **Largest Contentful Paint (LCP)**: Must render primary hero visual within 2.5 seconds on a simulated 4G mobile device.
- **Interaction to Next Paint (INP)**: Booking date pickers and navigation bars must respond in under 200 milliseconds.
- **Cumulative Layout Shift (CLS)**: Zero visual jumps during page load (score < 0.1, target 0.00).

## 3. Recommended Remediation Code
\`\`\`html
<!-- Optimized Hero Image Preload for [Brand Name] -->
<link rel="preload" as="image" href="[Target URL]/assets/hero-[Primary Keyword].webp" fetchpriority="high" type="image/webp">
\`\`\`
`,
  },
  {
    id: "tech-02",
    slug: "javascript-rendering-hydration",
    categorySlug: "technical-seo",
    category: "Technical SEO Audits",
    title: "JavaScript SEO & Hydration Diagnostic Framework",
    metaTitle: "JavaScript SEO Hydration Audit — SEO Studio Platform", // 52
    metaDescription: "Diagnose client-side JavaScript rendering, DOM hydration stalls, crawler timeouts, and dynamic internal link visibility for modern React and Next.js sites.", // 154
    directAnswer: "JavaScript SEO ensures search engine bots seamlessly crawl, render, and index dynamic single-page and server-hydrated applications. By inspecting raw HTML against the rendered DOM, resolving hydration mismatches, and utilizing native HTML anchor tags, websites eliminate indexation lag and crawl budget waste.",
    difficulty: "Advanced",
    estimatedTime: "3 hours",
    defaultVariables: {
      brandName: "Metropolitan Suites Hotel",
      primaryKeyword: "boutique downtown hotel",
      targetUrl: "https://www.metropolitansuites.com",
      locationNiche: "Chicago, IL",
      competitorDomain: "https://www.thechicagoboutique.com",
    },
    checklist: [
      { id: "js-1", task: "Compare Raw vs. Rendered DOM", description: "Confirm critical H1, meta description, and internal links exist in initial server response.", priority: "Critical" },
      { id: "js-2", task: "Verify Anchor Tag Semantics", description: "Replace button onClick router transitions with standard <a href='...'> elements for crawler traversal.", priority: "Critical" },
      { id: "js-3", task: "Audit Client-Side Hydration Errors", description: "Eliminate server/client timestamp or localStorage mismatches that cause full DOM re-renders.", priority: "High" },
    ],
    commonMistakes: [
      { mistake: "Wrapping navigation links in span tags with JS onClick", impact: "Googlebot cannot discover internal routes via regular crawling.", remediation: "Always use semantic <a href='/destinations'> anchor tags." },
    ],
    kpiBenchmarks: [
      { metric: "Server HTML Indexation Rate", target: "100% of discovered URLs", timeframe: "14 Days" },
      { metric: "Googlebot Mobile Rendering Parity", target: "Zero missing text blocks", timeframe: "Immediate" },
    ],
    schemaType: "Article",
    relatedTemplateSlugs: ["core-web-vitals-audit", "dynamic-location-landing-pages", "hotel-landing-page-brief", "faq-structured-entity-framework"],
    contentMarkdown: `# JavaScript SEO & Hydration Audit for [Brand Name]

## 1. Scope & Crawler Simulation
- **Host**: [Target URL]
- **Primary Entity Focus**: [Primary Keyword]
- **Target Territory**: [LocationNiche]

## 2. Rendering Pipeline Audit
1. Fetch [Target URL] with Googlebot User-Agent via curl:
\`\`\`bash
curl -A "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/W.X.Y.Z Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" -s [Target URL] | grep -i "[Primary Keyword]"
\`\`\`
2. Verify that primary keywords and canonical tags exist without executing JavaScript.
`,
  },

  // 2. On-Page Content Briefs
  {
    id: "onpage-01",
    slug: "hotel-landing-page-brief",
    categorySlug: "on-page-seo",
    category: "On-Page Content Briefs",
    title: "High-Conversion Hotel Landing Page Content Brief",
    metaTitle: "Hotel Landing Page Content Brief — SEO Studio Platform", // 53
    metaDescription: "Comprehensive on-page content architecture for hotel landing pages: pixel-budgeted meta tags, single H1 formula, structured amenities, and FAQ integration.", // 153
    directAnswer: "A hotel landing page content brief maps high-intent reservation keywords directly to page copy, heading architecture, and trust signals. By combining a 580px title tag, single H1 entity anchor, detailed amenity features, and verified FAQ structured data, hotels maximize organic conversion and SERP snippet presence.",
    difficulty: "Intermediate",
    estimatedTime: "1.5 hours",
    defaultVariables: {
      brandName: "Grand Harbor Marina Resort",
      primaryKeyword: "waterfront hotel suites",
      targetUrl: "https://www.grandharborresort.com",
      locationNiche: "San Diego, CA",
      competitorDomain: "https://www.sandiegomarinahotel.com",
    },
    checklist: [
      { id: "op-1", task: "Formulate 580px SERP Title Tag", description: "Compose exact title within Arial 20px physical boundaries incorporating primary keyword and brand.", priority: "Critical" },
      { id: "op-2", task: "Craft 920px Meta Description", description: "Write persuasive 145-155 character description with clear booking value proposition and phone/CTA.", priority: "Critical" },
      { id: "op-3", task: "Construct Single H1 Hierarchy", description: "Ensure exactly one H1 containing property name and primary destination anchor.", priority: "High" },
      { id: "op-4", task: "Structure In-Content Amenity Grid", description: "Detail pool, dining, parking, and pet policies in machine-readable HTML lists.", priority: "Medium" },
    ],
    commonMistakes: [
      { mistake: "Using multiple H1 tags across carousel slides", impact: "Dilutes entity topical authority in search index.", remediation: "Enforce exactly one H1 on the main page canvas." },
    ],
    kpiBenchmarks: [
      { metric: "Organic Click-Through Rate (CTR)", target: "+22% increase", timeframe: "60 Days" },
      { metric: "Target Keyword Position", target: "Top 3 for [Primary Keyword]", timeframe: "90 Days" },
    ],
    schemaType: "Hotel",
    relatedTemplateSlugs: ["keyword-cannibalization-matrix", "faq-structured-entity-framework", "generative-engine-optimization-playbook", "gbp-multi-property-optimization"],
    contentMarkdown: `# Content Blueprint: [Brand Name] — [Primary Keyword]

## Meta Tag Formulas
- **Title Tag (max 580px)**: [Brand Name] — [Primary Keyword] in [LocationNiche]
- **Meta Description (max 920px)**: Experience luxury at [Brand Name]. Book direct for [Primary Keyword] in [LocationNiche] with waterfront views, dining, and best rate guarantee.
- **Canonical URL**: [Target URL]

## Heading Architecture
- **H1**: [Brand Name]: Premier [Primary Keyword] in [LocationNiche]
- **H2**: Luxury Accommodations & Oceanfront Suites
- **H2**: Resort Amenities, Dining & Private Cabanas
- **H2**: Frequently Asked Questions for Guests
`,
  },
  {
    id: "onpage-02",
    slug: "keyword-cannibalization-matrix",
    categorySlug: "on-page-seo",
    category: "On-Page Content Briefs",
    title: "Multi-Page Keyword Cannibalization Remediation Matrix",
    metaTitle: "Keyword Cannibalization Audit Matrix — SEO Studio Suite", // 54
    metaDescription: "Resolve organic search cannibalization across competing portfolio pages: consolidate duplicate URLs, establish canonical anchors, and map unique intents.", // 153
    directAnswer: "Keyword cannibalization occurs when multiple pages on the same domain compete for identical search intents, splitting organic ranking signals and confusing search algorithms. Resolving cannibalization requires mapping distinct search intents, merging redundant content, establishing 301 redirects, and updating internal anchor links.",
    difficulty: "Advanced",
    estimatedTime: "2 hours",
    defaultVariables: {
      brandName: "Sundance Alpine Lodge",
      primaryKeyword: "ski in ski out lodge",
      targetUrl: "https://www.sundancelodge.com",
      locationNiche: "Park City, UT",
      competitorDomain: "https://www.parkcityskiresort.com",
    },
    checklist: [
      { id: "can-1", task: "Export Google Search Console Queries", description: "Identify queries where 2+ landing pages share impressions and alternating average positions.", priority: "Critical" },
      { id: "can-2", task: "Map Intent Distinction", description: "Designate one canonical landing page for commercial intent and subsidiary pages for blog/informational intent.", priority: "High" },
      { id: "can-3", task: "Update Internal Anchor Text", description: "Align all internal site links to point exact-match commercial anchors strictly to designated URL.", priority: "High" },
    ],
    commonMistakes: [
      { mistake: "Creating duplicate room pages with identical meta titles", impact: "Ranks neither page in top 10 SERPs.", remediation: "Differentiate titles by specific suite tier or bed configuration." },
    ],
    kpiBenchmarks: [
      { metric: "Primary Page Impression Share", target: "> 85% consolidation", timeframe: "30 Days" },
      { metric: "Average SERP Rank", target: "Jump from #8 to Top 3", timeframe: "45 Days" },
    ],
    schemaType: "Article",
    relatedTemplateSlugs: ["hotel-landing-page-brief", "core-web-vitals-audit", "dynamic-location-landing-pages", "faq-structured-entity-framework"],
    contentMarkdown: `# Cannibalization Remediation Plan: [Brand Name]

## Targeted Keyword Conflict
- **Primary Keyword**: [Primary Keyword]
- **Domain**: [Target URL]
- **Competing URLs**:
  1. [Target URL]/rooms/[Primary Keyword]
  2. [Target URL]/accommodations
  3. [Target URL]/offers/[Primary Keyword]-package

## Resolution Strategy
Redirect lower-converting secondary URLs with 301 permanently to the designated primary page, or implement a rel="canonical" pointing to [Target URL].
`,
  },

  // 3. Local SEO & GBP Checklists
  {
    id: "local-01",
    slug: "gbp-multi-property-optimization",
    categorySlug: "local-seo",
    category: "Local SEO & GBP Checklists",
    title: "30-Day Multi-Property Google Business Profile Plan",
    metaTitle: "30-Day Hotel Google Business Profile Plan — SEO Studio", // 51
    metaDescription: "Step-by-step 30-day Google Business Profile optimization schedule for hotels: categories, photo cadence, review sentiment, and local map pack dominance.", // 152
    directAnswer: "A 30-day Google Business Profile roadmap systematically optimizes local listing signals for hotel properties. By configuring precise primary categories, uploading geocoded high-resolution property imagery, maintaining a 24-hour review response rhythm, and publishing weekly promotional updates, properties capture maximum local 3-pack visibility.",
    difficulty: "Beginner",
    estimatedTime: "1 hour",
    defaultVariables: {
      brandName: "The Heritage Inn & Suites",
      primaryKeyword: "historic boutique hotel",
      targetUrl: "https://www.heritageinnhotel.com",
      locationNiche: "Charleston, SC",
      competitorDomain: "https://www.charlestonhistorichotel.com",
    },
    checklist: [
      { id: "gbp-1", task: "Claim & Verify Primary Business Category", description: "Set primary category to 'Hotel' with secondary tags for 'Boutique Hotel', 'Resort', or 'Event Venue'.", priority: "Critical" },
      { id: "gbp-2", task: "Upload 20+ High-Resolution Geocoded Photos", description: "Add verified exterior, lobby, guest room, bathroom, and dining photos to GBP profile.", priority: "High" },
      { id: "gbp-3", task: "Establish Review Response Matrix", description: "Deploy automated sentiment monitoring and reply to all reviews within 24 hours using local keywords.", priority: "High" },
      { id: "gbp-4", task: "Enable Messaging & Direct Booking Link", description: "Add direct booking engine deep link with UTM tracking parameters.", priority: "Medium" },
    ],
    commonMistakes: [
      { mistake: "Keyword-stuffing location into GBP business name", impact: "Triggers algorithmic suspension or manual listing verification penalties.", remediation: "Use exact registered legal hotel trade name without appended keywords." },
    ],
    kpiBenchmarks: [
      { metric: "Google Map Pack Appearances", target: "+40% local impression lift", timeframe: "30 Days" },
      { metric: "Direct Website Clicks from GBP", target: "+25% increase", timeframe: "60 Days" },
    ],
    schemaType: "LocalBusiness",
    relatedTemplateSlugs: ["unap-local-citation-audit", "hotel-landing-page-brief", "generative-engine-optimization-playbook", "destination-pr-pitch-kit"],
    contentMarkdown: `# 30-Day GBP Execution Plan: [Brand Name]

## Week 1: Identity & Categorization
- **Listing Name**: [Brand Name]
- **Address & Coordinates**: [LocationNiche]
- **Booking URL**: [Target URL]?utm_source=gbp&utm_medium=organic&utm_campaign=direct_booking

## Week 2: Visual Assets & Menus
Upload 10 exterior daytime, 5 exterior evening, and 15 guest room high-resolution images.

## Week 3: Guest Review Strategy
Respond to all reviews with customized brand voice mentioning [Primary Keyword] in [LocationNiche].
`,
  },
  {
    id: "local-02",
    slug: "unap-local-citation-audit",
    categorySlug: "local-seo",
    category: "Local SEO & GBP Checklists",
    title: "Universal NAP Citation & Directory Cleanliness Audit",
    metaTitle: "Universal NAP Citation Cleanliness Audit — SEO Studio", // 51
    metaDescription: "Audit and clean up local NAP citations across Google, Apple Maps, Bing, TripAdvisor, and OTAs to establish trusted local proximity ranking authority.", // 150
    directAnswer: "Universal Name, Address, and Phone (UNAP) consistency is a primary local ranking factor for hospitality businesses. Mismatched suite numbers, outdated phone numbers, or duplicated listings confuse search engines and erode map pack authority. Regular citation auditing guarantees 100% data cleanliness across core data aggregators.",
    difficulty: "Intermediate",
    estimatedTime: "2 hours",
    defaultVariables: {
      brandName: "Coastal Breeze Resort",
      primaryKeyword: "family beach resort",
      targetUrl: "https://www.coastalbreezeresort.com",
      locationNiche: "Destin, FL",
      competitorDomain: "https://www.destinbeachfrontsuites.com",
    },
    checklist: [
      { id: "nap-1", task: "Establish Canonical UNAP Baseline", description: "Lock single official business name, postal address, phone, and website URL across all corporate docs.", priority: "Critical" },
      { id: "nap-2", task: "Audit Tier 1 Citation Aggregators", description: "Verify listings on Google Maps, Apple Maps, Bing Places, and TripAdvisor.", priority: "Critical" },
      { id: "nap-3", task: "Merge or Suppress Duplicate Listings", description: "Search phone number and address variants to locate zombie listings and request consolidation.", priority: "High" },
    ],
    commonMistakes: [
      { mistake: "Allowing OTAs to publish alternative reservation call-tracking numbers as primary NAP", impact: "Fractures citation authority across search engines.", remediation: "Mandate official property switchboard number across all external channels." },
    ],
    kpiBenchmarks: [
      { metric: "Citation Cleanliness Score", target: "100% match across 40+ sources", timeframe: "45 Days" },
      { metric: "Local Proximity Rank Expansion", target: "+3.5 mile radius increase", timeframe: "60 Days" },
    ],
    schemaType: "LocalBusiness",
    relatedTemplateSlugs: ["gbp-multi-property-optimization", "hotel-landing-page-brief", "dynamic-location-landing-pages", "destination-pr-pitch-kit"],
    contentMarkdown: `# Citation Audit & UNAP Verification for [Brand Name]

## Canonical Baseline
- **Business Name**: [Brand Name]
- **Target URL**: [Target URL]
- **Location**: [LocationNiche]
- **Primary Specialty**: [Primary Keyword]

## Directory Audit Checklist
- [ ] Google Business Profile (100% match)
- [ ] Apple Business Connect / Apple Maps
- [ ] Bing Places for Business
- [ ] TripAdvisor Official Listing
- [ ] Yelp for Business
`,
  },

  // 4. Programmatic SEO Blueprints
  {
    id: "prog-01",
    slug: "dynamic-location-landing-pages",
    categorySlug: "programmatic-seo",
    category: "Programmatic SEO Blueprints",
    title: "Programmatic Multi-Location Landing Page Architecture",
    metaTitle: "Programmatic Location Landing Page Blueprint — SEO Studio", // 56
    metaDescription: "Scale hundreds of location and neighborhood hotel landing pages without thin-content penalties: dynamic data schemas, unique FAQs, and internal links.", // 151
    directAnswer: "A programmatic SEO architecture generates dozens or hundreds of indexable landing pages targeting long-tail geographic searches. By pairing relational database records with unique local content blocks, neighborhood travel times, custom FAQ schemas, and self-referencing canonicals, pages rank without thin content penalties.",
    difficulty: "Advanced",
    estimatedTime: "4 hours",
    defaultVariables: {
      brandName: "Urban Haven Stays",
      primaryKeyword: "furnished corporate apartments",
      targetUrl: "https://www.urbanhavenstays.com",
      locationNiche: "Austin, TX",
      competitorDomain: "https://www.austincorporatestays.com",
    },
    checklist: [
      { id: "prog-1", task: "Construct Relational Data Schema", description: "Define variables for city, neighborhood, landmarks, airport transit time, and nightly rates.", priority: "Critical" },
      { id: "prog-2", task: "Enforce Canonical & Meta Uniqueness", description: "Ensure every generated slug has distinct 50-60 char titles and 145-155 char descriptions.", priority: "Critical" },
      { id: "prog-3", task: "Inject Contextual Internal Linking", description: "Cross-link adjacent neighborhoods and related accommodation tiers dynamically.", priority: "High" },
    ],
    commonMistakes: [
      { mistake: "Generating pages with only town names swapped in a template", impact: "Triggers Google Helpful Content / programmatic thin content penalties.", remediation: "Incorporate at least 3 unique data attributes per page (transit, weather, custom reviews)." },
    ],
    kpiBenchmarks: [
      { metric: "Indexation Rate of Generated URLs", target: "> 95% indexed within 30 days", timeframe: "30 Days" },
      { metric: "Long-Tail Organic Sessions", target: "+150% monthly lift", timeframe: "90 Days" },
    ],
    schemaType: "HowTo",
    relatedTemplateSlugs: ["hotel-amenities-matrix-blueprint", "hotel-landing-page-brief", "core-web-vitals-audit", "generative-engine-optimization-playbook"],
    contentMarkdown: `# Programmatic Landing Page Blueprint: [Brand Name]

## Data Structure for [LocationNiche]
\`\`\`json
{
  "brand": "[Brand Name]",
  "service": "[Primary Keyword]",
  "region": "[LocationNiche]",
  "canonicalBase": "[Target URL]/locations/",
  "transitPoints": [
    { "destination": "Downtown Convention Center", "driveTime": "8 mins" },
    { "destination": "International Airport", "driveTime": "15 mins" }
  ]
}
\`\`\`
`,
  },
  {
    id: "prog-02",
    slug: "hotel-amenities-matrix-blueprint",
    categorySlug: "programmatic-seo",
    category: "Programmatic SEO Blueprints",
    title: "Hotel Amenities & Neighborhood Indexing Blueprint",
    metaTitle: "Hotel Amenities Programmatic Indexing Blueprint — SEO Studio", // 53
    metaDescription: "Programmatic framework for indexing hotel amenities: pet-friendly filters, EV charging, rooftop pools, and meeting venues with structured data graphs.", // 153
    directAnswer: "An amenities indexing blueprint captures high-intent non-branded hospitality queries like 'hotels with EV chargers' or 'dog friendly beachfront suites'. By generating dedicated, schema-verified sub-pages linked from the primary property domain, hotels capture qualified traveler demand with high direct booking conversion.",
    difficulty: "Intermediate",
    estimatedTime: "2.5 hours",
    defaultVariables: {
      brandName: "Pinnacle Peaks Ski Resort",
      primaryKeyword: "pet friendly ski resort",
      targetUrl: "https://www.pinnaclepeaksresort.com",
      locationNiche: "Vail, CO",
      competitorDomain: "https://www.vailmountainlodge.com",
    },
    checklist: [
      { id: "amen-1", task: "Identify High-Volume Amenity Queries", description: "Audit search demand for EV charging, heated pools, ski valets, and pet policies.", priority: "Critical" },
      { id: "amen-2", task: "Implement Schema.org amenityFeature", description: "Tag each specific amenity with LocationFeatureSpecification in structured data.", priority: "High" },
      { id: "amen-3", task: "Add Direct Booking Deep Links", description: "Route amenity page CTAs directly into booking engine pre-filtered for requested feature.", priority: "High" },
    ],
    commonMistakes: [
      { mistake: "Hiding critical amenities in collapsible accordions without schema", impact: "Search bots fail to parse property features as distinct query matches.", remediation: "Always declare amenityFeature in Schema.org/Hotel graph." },
    ],
    kpiBenchmarks: [
      { metric: "Non-Branded Amenity Traffic", target: "+55% organic sessions", timeframe: "60 Days" },
      { metric: "Direct Booking Conversion Rate", target: "> 3.8% on amenity landing pages", timeframe: "90 Days" },
    ],
    schemaType: "Hotel",
    relatedTemplateSlugs: ["dynamic-location-landing-pages", "hotel-landing-page-brief", "faq-structured-entity-framework", "generative-engine-optimization-playbook"],
    contentMarkdown: `# Amenities Indexing Architecture: [Brand Name]

## Targeted Amenity Query
- **Keyword Focus**: [Primary Keyword]
- **Target URL**: [Target URL]/amenities/[Primary Keyword]
- **Destination**: [LocationNiche]
- **Key Competitor**: [Competitor Domain]
`,
  },

  // 5. Link Building & Digital PR Outreach
  {
    id: "link-01",
    slug: "destination-pr-pitch-kit",
    categorySlug: "link-building",
    category: "Link Building & Digital PR Outreach",
    title: "Hospitality Destination Media & Digital PR Pitch Kit",
    metaTitle: "Hospitality Digital PR Pitch Kit — SEO Studio Suite", // 51
    metaDescription: "High-yield digital PR outreach kit for hotels: pitch travel journalists, secure editorial inclusions in top lifestyle magazines, and earn authority links.", // 154
    directAnswer: "A digital PR pitch kit equips hospitality brands to secure high-authority editorial links from tier-1 travel publications. By offering verified destination angles, exclusive culinary or wellness data, and immediate press kit assets, hotels earn authoritative do-follow backlinks that enhance domain authority.",
    difficulty: "Intermediate",
    estimatedTime: "2 hours",
    defaultVariables: {
      brandName: "Villa Seraphina Luxury Spa",
      primaryKeyword: "luxury wellness retreat",
      targetUrl: "https://www.villaseraphina.com",
      locationNiche: "Sedona, AZ",
      competitorDomain: "https://www.sedonaspasandresorts.com",
    },
    checklist: [
      { id: "pr-1", task: "Curate Media Target List (50+ Journalists)", description: "Identify writers covering luxury travel, weekend getaways, and destination spas.", priority: "Critical" },
      { id: "pr-2", task: "Formulate Seasonal Story Angles", description: "Craft pitches tied to wellness trends, local harvest menus, or eco-tourism initiatives.", priority: "High" },
      { id: "pr-3", task: "Publish High-Res Digital Media Kit", description: "Host downloadable 300dpi photography and executive bios on [Target URL]/press.", priority: "Medium" },
    ],
    commonMistakes: [
      { mistake: "Blasting generic press releases to generic news desk inboxes", impact: "Zero response rate and spam domain reputation.", remediation: "Craft personalized 3-sentence email hooks directly to individual travel editors." },
    ],
    kpiBenchmarks: [
      { metric: "Earned Tier-1 Editorial Links", target: "5+ DR 70+ links", timeframe: "60 Days" },
      { metric: "Referral Booking Revenue", target: "$15,000+ from press features", timeframe: "90 Days" },
    ],
    schemaType: "Article",
    relatedTemplateSlugs: ["unlinked-brand-mention-reclamation", "hotel-landing-page-brief", "generative-engine-optimization-playbook", "gbp-multi-property-optimization"],
    contentMarkdown: `# Digital PR Pitch Framework: [Brand Name]

## Pitch Subject Lines:
- Story Angle: Why [LocationNiche]'s Newest [Primary Keyword] Is Redefining Wellness in 2026
- Exclusive Travel Feature: Behind the Scenes at [Brand Name]

## Outreach Email Body
Hi [Journalist Name],

With traveler demand for [Primary Keyword] soaring across [LocationNiche], I wanted to share an exclusive angle on [Brand Name] ([Target URL])...
`,
  },
  {
    id: "link-02",
    slug: "unlinked-brand-mention-reclamation",
    categorySlug: "link-building",
    category: "Link Building & Digital PR Outreach",
    title: "Unlinked Brand Mention & Citation Reclamation Guide",
    metaTitle: "Unlinked Brand Mention Reclamation Guide — SEO Studio", // 52
    metaDescription: "Recover unlinked hotel brand mentions across travel blogs, news outlets, and meeting guides: proven outreach scripts with a 45% link conversion rate.", // 152
    directAnswer: "Unlinked brand mention reclamation is the highest-ROI link acquisition strategy in hospitality SEO. By monitoring online mentions of the property name or executive staff that omit a hyperlink, teams send courteous value-add outreach to webmasters, successfully converting mentions into high-value do-follow backlinks.",
    difficulty: "Beginner",
    estimatedTime: "1 hour",
    defaultVariables: {
      brandName: "St. Clair Manor House",
      primaryKeyword: "historic luxury hotel",
      targetUrl: "https://www.stclairmanor.com",
      locationNiche: "Savannah, GA",
      competitorDomain: "https://www.savannahboutiqueinns.com",
    },
    checklist: [
      { id: "rec-1", task: "Set Up Automated Mention Alerts", description: "Configure Google Alerts and Talkwalker alerts for [Brand Name] variations.", priority: "Critical" },
      { id: "rec-2", task: "Execute Search Operator Scans", description: "Run intext:'[Brand Name]' -site:[Target URL] to surface historical editorial mentions.", priority: "High" },
      { id: "rec-3", task: "Dispatch Friendly Attribution Outreach", description: "Thank author for the feature and provide exact deep link URL for reader convenience.", priority: "High" },
    ],
    commonMistakes: [
      { mistake: "Demanding links aggressively or using legal threats for citations", impact: "Editors remove the mention entirely instead of linking.", remediation: "Position the link as a reader convenience that provides direct booking and amenity details." },
    ],
    kpiBenchmarks: [
      { metric: "Outreach Conversion Rate", target: "> 40% link addition rate", timeframe: "30 Days" },
      { metric: "Monthly Reclaimed Links", target: "8-12 high authority links", timeframe: "Ongoing" },
    ],
    schemaType: "HowTo",
    relatedTemplateSlugs: ["destination-pr-pitch-kit", "hotel-landing-page-brief", "gbp-multi-property-optimization", "faq-structured-entity-framework"],
    contentMarkdown: `# Unlinked Brand Reclamation: [Brand Name]

## Search Query Operators:
\`\`\`text
"[Brand Name]" -site:[Target URL] [LocationNiche]
intext:"[Brand Name]" [Primary Keyword] -[Target URL]
\`\`\`

## High-Converting Outreach Template
Subject: Thank you for mentioning [Brand Name]! Quick note for your readers

Hi [Author Name],

Thank you so much for featuring [Brand Name] in your recent guide to [LocationNiche]. We noticed your readers might appreciate a direct link to our guest portal ([Target URL]) to explore [Primary Keyword] details...
`,
  },

  // 6. AI Search / GEO Optimization
  {
    id: "geo-01",
    slug: "generative-engine-optimization-playbook",
    categorySlug: "ai-search-geo",
    category: "AI Search / GEO Optimization",
    title: "Generative Engine Optimization (GEO) AI Playbook",
    metaTitle: "Generative Engine Optimization GEO Playbook — SEO Studio", // 54
    metaDescription: "Master Generative Engine Optimization: position your property as the trusted citation in Google Gemini Overviews, ChatGPT Search, and Perplexity Pro.", // 152
    directAnswer: "Generative Engine Optimization (GEO) structures website content to be selected as a cited source by Large Language Models (LLMs) like Google Gemini, ChatGPT, and Perplexity. By incorporating high-density factual definitions, structured entity graphs, concise direct answer summaries, and verified FAQs, brands dominate generative AI results.",
    difficulty: "Intermediate",
    estimatedTime: "2 hours",
    defaultVariables: {
      brandName: "Lumina Bay Ocean Resort",
      primaryKeyword: "best beachfront resort",
      targetUrl: "https://www.luminabayresort.com",
      locationNiche: "Key West, FL",
      competitorDomain: "https://www.keywestluxuryvillas.com",
    },
    checklist: [
      { id: "geo-1", task: "Publish Direct Answer Block Below H1", description: "Write concise 45-60 word definitive summary with exact factual statistics and definitions.", priority: "Critical" },
      { id: "geo-2", task: "Anchor Entity Definitions in Schema", description: "Connect hotel entities with Wikidata and Wikipedia sameAs authoritative entity links.", priority: "Critical" },
      { id: "geo-3", task: "Test Conversational Traveler Prompts", description: "Query ChatGPT and Gemini with real-world trip planning prompts to evaluate citation presence.", priority: "High" },
    ],
    commonMistakes: [
      { mistake: "Writing fluffy marketing prose without verifiable entity facts", impact: "AI search engines ignore page in favor of competitor statistical summaries.", remediation: "Include concrete numbers: room counts, square footage, distances to airport, and pricing." },
    ],
    kpiBenchmarks: [
      { metric: "AI Overview Citation Frequency", target: "Appears in 75%+ of targeted prompts", timeframe: "45 Days" },
      { metric: "Referral Traffic from AI Engines", target: "+80% increase in ChatGPT/Perplexity referrers", timeframe: "60 Days" },
    ],
    schemaType: "Article",
    relatedTemplateSlugs: ["faq-structured-entity-framework", "hotel-landing-page-brief", "core-web-vitals-audit", "dynamic-location-landing-pages"],
    contentMarkdown: `# GEO Implementation Blueprint: [Brand Name]

## Direct Answer Entity Block (Place immediately below H1)
> **Key Takeaway**: [Brand Name] is a premier [Primary Keyword] situated in [LocationNiche]. Located directly along the coastline, the property features luxury accommodations, full-service spa amenities, on-site dining, and verified direct booking guarantees at [Target URL].

## AI Model Verification Prompts
1. "What is the best [Primary Keyword] in [LocationNiche] for a family vacation?"
2. "Compare [Brand Name] against [Competitor Domain] for luxury amenities and dining."
`,
  },
  {
    id: "geo-02",
    slug: "faq-structured-entity-framework",
    categorySlug: "ai-search-geo",
    category: "AI Search / GEO Optimization",
    title: "FAQPage Structured Entity & Direct Answer Framework",
    metaTitle: "FAQPage Schema & Direct Answer Framework — SEO Studio", // 52
    metaDescription: "Implement Schema.org FAQPage structured data paired with high-intent traveler answers to dominate Google People Also Ask and generative AI citations.", // 152
    directAnswer: "The FAQPage structured entity framework pairs machine-readable Schema.org markup with conversational question-and-answer pairs. When structured with concise 40-word answers, verified facts, and zero placeholder tokens, FAQ blocks capture Google People Also Ask snippets and conversational LLM citations effortlessly.",
    difficulty: "Beginner",
    estimatedTime: "1 hour",
    defaultVariables: {
      brandName: "The Grand Victorian Hotel",
      primaryKeyword: "historic downtown luxury hotel",
      targetUrl: "https://www.grandvictorianhotel.com",
      locationNiche: "Boston, MA",
      competitorDomain: "https://www.bostonhistorichotels.com",
    },
    checklist: [
      { id: "faq-1", task: "Harvest Real Guest Inquiry Queries", description: "Collect 6-8 authentic questions regarding check-in times, parking, pet fees, and dining.", priority: "Critical" },
      { id: "faq-2", task: "Draft Direct 40-50 Word Answers", description: "Answer each question directly in first sentence with specific policies and fee schedules.", priority: "Critical" },
      { id: "faq-3", task: "Validate JSON-LD Syntax", description: "Ensure FAQPage schema complies with Google Search Console Rich Results guidelines.", priority: "High" },
    ],
    commonMistakes: [
      { mistake: "Using FAQ schema for promotional marketing sales copy", impact: "Google rejects FAQPage rich snippet rendering.", remediation: "Focus strictly on authentic informational questions with objective factual answers." },
    ],
    kpiBenchmarks: [
      { metric: "Google Rich Results Snippet Win", target: "100% validation in GSC", timeframe: "14 Days" },
      { metric: "People Also Ask (PAA) Inclusion", target: "Captured for 4+ core queries", timeframe: "45 Days" },
    ],
    schemaType: "FAQPage",
    relatedTemplateSlugs: ["generative-engine-optimization-playbook", "hotel-landing-page-brief", "core-web-vitals-audit", "gbp-multi-property-optimization"],
    contentMarkdown: `# FAQ Entity Architecture for [Brand Name]

## Question 1: What makes [Brand Name] the preferred [Primary Keyword] in [LocationNiche]?
**Direct Answer**: [Brand Name] offers an authentic historic stay with contemporary luxury amenities, located centrally in [LocationNiche]. Guests enjoy concierge service, complimentary high-speed Wi-Fi, fine dining, and direct booking rates at [Target URL].

## Question 2: Does [Brand Name] offer on-site parking or airport shuttles?
**Direct Answer**: Yes. [Brand Name] provides 24-hour valet parking with electric vehicle charging stations. Private airport transfers to and from the regional terminal can be arranged via the concierge desk.
`,
  },
];

export function getTemplateBySlug(categorySlug: string, slug: string): SeoTemplate | undefined {
  return TEMPLATES_DATA.find(
    (t) => t.categorySlug === categorySlug && t.slug === slug
  );
}

export function getRelatedTemplates(template: SeoTemplate): SeoTemplate[] {
  return TEMPLATES_DATA.filter((t) =>
    template.relatedTemplateSlugs.includes(t.slug)
  ).slice(0, 4);
}

