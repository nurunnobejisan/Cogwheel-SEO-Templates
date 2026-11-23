import { CogwheelTemplate, ClientProfile, PageAuditData, ScoreBreakdown, QuickWinItem } from "../types/extension";

export const COGWHEEL_TEMPLATES: CogwheelTemplate[] = [
  // ── 1. Landing Pages ──
  {
    id: "hotel-destination-guide",
    title: "Hotel Destination & Local Area Guide",
    category: "Landing Pages",
    format: "html",
    description: "High-converting destination landing page targeting regional travelers, demand generators, and local attractions.",
    tags: ["On Page", "Geo-Anchoring", "Attractions", "High Intent"],
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{{destinationTitle}} | {{hotelName}}</title>
  <meta name="description" content="Explore {{cityName}} with our insider destination guide. Stay at {{hotelName}} close to top attractions, dining, and landmarks.">
</head>
<body class="destination-guide">
  <header class="hero-section">
    <h1>{{destinationTitle}}</h1>
    <p class="subtitle">{{destinationSubtitle}}</p>
  </header>
  <main class="content-container">
    <section class="overview-block">
      <h2>Welcome to {{cityName}}</h2>
      <p>{{destinationOverview}}</p>
    </section>
    <section class="amenities-highlight">
      <h2>Why Stay at {{hotelName}}</h2>
      <ul>
        {{amenitiesList}}
      </ul>
      <div class="booking-perks">
        <p><strong>Direct Booking Perks:</strong> {{bookingPerks}}</p>
      </div>
    </section>
    <section class="local-attractions">
      <h2>Must-Visit Attractions in {{cityName}}</h2>
      <p>{{attractionsSummary}}</p>
    </section>
  </main>
</body>
</html>`,
    defaultVariables: {
      destinationTitle: "Ultimate Guide to Panama City Beachfront Stays",
      destinationSubtitle: "Minutes from Pier Park, Gulf world, and white sand shores",
      cityName: "Panama City Beach",
      destinationOverview: "Known for emerald coast waters and sunny coastal escapes, our destination provides seamless access to beach activities, live entertainment, and sunset dining.",
      hotelName: "SpringHill Suites Panama City Beachfront",
      amenitiesList: "<li>Oceanfront suites with private Gulf balconies</li><li>Resort-style lazy river and outdoor pool</li><li>Complimentary hot breakfast buffet</li><li>Beachside bar & grill</li>",
      bookingPerks: "Save up to 15% with direct member rates and zero hidden resort fees.",
      attractionsSummary: "Located walking distance to Shipwreck Island Waterpark, 10 minutes to St. Andrews State Park, and directly on Front Beach Road.",
    },
  },
  {
    id: "hotel-room-showcase",
    title: "Luxury Room & Suite Showcase Page",
    category: "Landing Pages",
    format: "html",
    description: "Dedicated room landing page designed to capture high-intent room queries and lift direct booking Average Daily Rate (ADR).",
    tags: ["Rooms", "Suites", "Direct Bookings", "ADR Lift"],
    content: `<article class="room-showcase-card">
  <header class="room-header">
    <span class="room-badge">Featured Accommodation</span>
    <h1 class="room-title">{{roomTitle}}</h1>
    <div class="room-pricing">From <span class="rate">{{roomStartingRate}}</span> / night</div>
  </header>
  <div class="room-body">
    <p class="room-desc">{{roomDescription}}</p>
    <div class="room-amenities-grid">
      <h3>Premium In-Room Features</h3>
      <ul>
        {{roomAmenities}}
      </ul>
    </div>
    <div class="cta-wrapper">
      <a href="/reserve?room={{roomTitle}}" class="btn-book-direct">Reserve at {{hotelName}} in {{cityName}}</a>
    </div>
  </div>
</article>`,
    defaultVariables: {
      roomTitle: "Oceanfront King Suite with Private Balcony",
      roomStartingRate: "$229",
      roomDescription: "Experience unobstructed views of the Gulf of Mexico from your private balcony. Featuring a separate plush seating area, luxury Marriott bedding, high-speed Wi-Fi, and a spa-inspired bath.",
      roomAmenities: "<li>Floor-to-ceiling panoramic glass windows</li><li>Private furnished walk-out balcony</li><li>Wet bar with mini-fridge & microwave</li><li>55-inch smart HD streaming TV</li>",
      hotelName: "SpringHill Suites Panama City Beachfront",
      cityName: "Panama City Beach",
    },
  },
  {
    id: "hotel-faq-amenities",
    title: "Hotel Amenities & Guest FAQ Hub",
    category: "Landing Pages",
    format: "html",
    description: "Comprehensive FAQ and policies page structured to capture long-tail guest queries and trigger Google voice / rich answers.",
    tags: ["FAQ", "Policies", "Voice Search", "Local SEO"],
    content: `<section class="hotel-faq-section">
  <h2>Frequently Asked Questions About {{hotelName}}</h2>
  <div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <h3 itemprop="name">What are the check-in and check-out times at {{hotelName}}?</h3>
    <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">{{checkInOutPolicy}}</p>
    </div>
  </div>
  <div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <h3 itemprop="name">Is on-site parking available at your {{cityName}} property?</h3>
    <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">{{parkingPolicy}}</p>
    </div>
  </div>
  <div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <h3 itemprop="name">Are pets allowed at {{hotelName}}?</h3>
    <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">{{petPolicy}}</p>
    </div>
  </div>
</section>`,
    defaultVariables: {
      hotelName: "The Coachman Hotel",
      cityName: "South Lake Tahoe",
      checkInOutPolicy: "Check-in begins at 4:00 PM, and check-out is until 11:00 AM. Early check-in and contactless mobile arrival can be arranged subject to availability.",
      parkingPolicy: "Complimentary on-site guest parking is available throughout your stay, including EV charging stations.",
      petPolicy: "We are dog-friendly! Well-behaved dogs are welcome with a small per-stay cleaning fee, including complimentary bowls and welcome treats.",
    },
  },

  // ── 2. Meta & Headings ──
  {
    id: "title-meta-suite",
    title: "High-CTR Title Tag & Meta Description Formula",
    category: "Meta & Headings",
    format: "html",
    description: "Strict 45-60 character Title Tag + 120-155 character Meta Description with high-intent keyword positioning and brand suffix.",
    tags: ["Title Tag", "Meta Description", "SERP CTR", "Pixel Budget"],
    content: `<!-- Desktop SERP Width: Max 580px (~55-60 chars) | Mobile Width: Max 960px (~120-155 chars) -->
<title>{{targetKeyword}} | {{hotelName}} - {{cityName}}</title>
<meta name="description" content="{{metaDescription}}">
<link rel="canonical" href="{{canonicalUrl}}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">`,
    defaultVariables: {
      targetKeyword: "Beachfront Hotels Panama City Beach",
      hotelName: "SpringHill Suites",
      cityName: "Panama City Beach FL",
      metaDescription: "Stay beachfront at SpringHill Suites Panama City Beach. Enjoy oceanfront suites, lazy river pool, free breakfast, and direct Gulf access. Book direct & save.",
      canonicalUrl: "https://www.marriott.com/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/",
    },
  },
  {
    id: "usp-headline-hero",
    title: "USP Headline & Above-the-Fold H1 Banner",
    category: "Meta & Headings",
    format: "html",
    description: "Primary H1 headline paired with direct-booking value proposition and local geo-anchors to eliminate bounce rates.",
    tags: ["H1", "Headlines", "Conversion", "Above The Fold"],
    content: `<div class="hero-usp-banner">
  <span class="geo-kicker">Welcome to {{cityName}}</span>
  <h1 class="main-h1">{{primaryH1}}</h1>
  <p class="usp-subhead">{{uspSubhead}}</p>
  <div class="usp-trust-badges">
    <span>Direct Booking Best Rate Guarantee</span>
    <span>Zero Hidden Resort Fees</span>
    <span>Instant Mobile Key Access</span>
  </div>
</div>`,
    defaultVariables: {
      cityName: "Boston Downtown",
      primaryH1: "Boutique Luxury Near Faneuil Hall & North End",
      uspSubhead: "Steps from Boston Harbor, historic cobblestone streets, and Little Italy dining. Enjoy artisan guest rooms with complimentary canopy bikes.",
    },
  },

  // ── 3. Schemas (JSON-LD) ──
  {
    id: "schema-hotel-graph",
    title: "Unified Hotel & LocalBusiness @graph Schema",
    category: "Schemas",
    format: "json",
    description: "Comprehensive JSON-LD @graph combining Hotel, PostalAddress, GeoCoordinates, Amenities, and FAQ for maximum Google Rich Results.",
    tags: ["JSON-LD", "Google Rich Results", "Hotel Schema", "GeoCoordinates"],
    content: `{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Hotel",
      "@id": "{{canonicalUrl}}#hotel",
      "name": "{{hotelName}}",
      "url": "{{canonicalUrl}}",
      "image": "{{heroImageUrl}}",
      "telephone": "{{phoneNumber}}",
      "priceRange": "$$$",
      "starRating": {
        "@type": "Rating",
        "ratingValue": "{{starRating}}"
      },
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "{{streetAddress}}",
        "addressLocality": "{{cityName}}",
        "addressRegion": "{{stateCode}}",
        "postalCode": "{{postalCode}}",
        "addressCountry": "US"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": {{latitude}},
        "longitude": {{longitude}}
      },
      "checkinTime": "16:00",
      "checkoutTime": "11:00",
      "petsAllowed": true,
      "amenityFeature": [
        {
          "@type": "LocationFeatureSpecification",
          "name": "Complimentary High-Speed Wi-Fi",
          "value": true
        },
        {
          "@type": "LocationFeatureSpecification",
          "name": "Beachfront Pool & Lazy River",
          "value": true
        },
        {
          "@type": "LocationFeatureSpecification",
          "name": "EV Vehicle Charging Station",
          "value": true
        }
      ]
    },
    {
      "@type": "BreadcrumbList",
      "@id": "{{canonicalUrl}}#breadcrumb",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "{{originUrl}}"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "{{cityName}} Hotels",
          "item": "{{canonicalUrl}}"
        }
      ]
    }
  ]
}`,
    defaultVariables: {
      canonicalUrl: "https://www.marriott.com/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/",
      originUrl: "https://www.marriott.com",
      hotelName: "SpringHill Suites Panama City Beachfront",
      heroImageUrl: "https://cache.marriott.com/content/dam/marriott-renditions/ECPSB/ecpsb-exterior-001.jpg",
      phoneNumber: "+1-850-230-6004",
      starRating: "4.5",
      streetAddress: "12513 Front Beach Road",
      cityName: "Panama City Beach",
      stateCode: "FL",
      postalCode: "32407",
      latitude: "30.1983",
      longitude: "-85.8335",
    },
  },
  {
    id: "schema-faq-rich",
    title: "Collapsible FAQPage Schema Builder",
    category: "Schemas",
    format: "json",
    description: "Valid Schema.org FAQPage structured markup that triggers accordion dropdowns directly on Google search result pages.",
    tags: ["FAQ", "Rich Snippets", "SERP Real Estate"],
    content: `{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "{{question1}}",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "{{answer1}}"
      }
    },
    {
      "@type": "Question",
      "name": "{{question2}}",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "{{answer2}}"
      }
    }
  ]
}`,
    defaultVariables: {
      question1: "Does the hotel offer direct access to the beach?",
      answer1: "Yes, our guests enjoy private, direct walk-out access to the white sand beaches of Panama City Beach with complimentary towel service.",
      question2: "Is breakfast included in the room rate?",
      answer2: "Yes, a complimentary hot breakfast buffet with Belgian waffles, fresh fruits, and artisan coffee is served daily.",
    },
  },

  // ── 4. AI Prompts ──
  {
    id: "prompt-keyword-allocation",
    title: "78-Keyword Pool Allocation & Rationale Prompt",
    category: "AI Prompts",
    format: "markdown",
    description: "Claude & ChatGPT prompt for allocating Semrush hospitality keyword pools across hotel landing pages using the 3-step Cogwheel rationale.",
    tags: ["Claude", "ChatGPT", "Semrush", "Keyword Research"],
    content: `You are the Lead Hospitality SEO Strategist at Razib Marketing following Cogwheel SEO standards.

Analyze the following property and allocate target keywords across landing pages:
PROPERTY: {{hotelName}}
CITY / REGION: {{cityName}}, {{stateCode}}
BRAND FLAG: {{brandFlag}}

CRITICAL COGWHEEL GROUND RULES:
1. Cite real Semrush search demand (Search Volume & Keyword Difficulty). Never fabricate traffic numbers.
2. Secondary room & amenity pages MUST target KD < 45 to achieve 60-90 day rank velocity.
3. Every recommendation must provide the 3-Step Cogwheel Rationale:
   - Step 1 & 2: Demand Grounding & Strategic Fit (search intent, booking urgency, comp-set win)
   - Step 3: On-Page Placement Directives (Meta Title, H1, H2s, image alt tags, JSON-LD schema)

OUTPUT FORMAT:
Generate a clean TSV / Markdown table with columns:
Page Name | URL Path | Primary Keyword | Monthly Volume | KD | Bucket | Current Rank | 3-Step Rationale`,
    defaultVariables: {
      hotelName: "Canopy by Hilton Boston Downtown",
      cityName: "Boston",
      stateCode: "MA",
      brandFlag: "Canopy by Hilton / Lifestyle Boutique",
    },
  },
  {
    id: "prompt-geo-ai-citation",
    title: "GEO / Generative Engine Optimization Prompt",
    category: "AI Prompts",
    format: "markdown",
    description: "Evaluates and writes copy engineered to get cited inside ChatGPT Search, Google Gemini, and Perplexity for traveler queries.",
    tags: ["GEO", "Perplexity", "Gemini", "ChatGPT Search"],
    content: `You are an AI Search Visibility Architect. Optimize the web page copy for {{hotelName}} in {{cityName}} to be chosen as the #1 cited hotel recommendation in Perplexity, ChatGPT Search, and Google AI Overviews.

PROMPT QUERY TO TARGET:
"What are the best boutique hotels to stay in {{cityName}} near {{landmark}} with top dining?"

REQUIREMENTS:
1. State verifiable facts within the first 100 words (Distance to {{landmark}}, exact address, room count, dining names).
2. Use entity-dense language (avoiding marketing fluff like "breathtaking" or "world-class").
3. Include structured lists of amenities that LLMs can extract into summary cards.
4. Output optimized H1, H2 headers and a 150-word citation-primed paragraph.`,
    defaultVariables: {
      hotelName: "AC Hotel St. Petersburg Downtown",
      cityName: "St. Petersburg",
      landmark: "Tropicana Field and Central Avenue",
    },
  },

  // ── 5. Audits & Checklists ──
  {
    id: "checklist-10-gate-quality",
    title: "Cogwheel 10-Gate Production Quality Checklist",
    category: "Audits & Checklists",
    format: "markdown",
    description: "The official 10-gate quality standard required before publishing or approving any hotel page.",
    tags: ["Quality Gate", "Pre-Launch", "Audits"],
    content: `# Cogwheel 10-Gate Production Quality Checklist

- [ ] **Gate 1 · Title Tag**: 45–60 characters, primary keyword in front, CTR benefit hook, branded suffix.
- [ ] **Gate 2 · Meta Description**: 120–155 characters, includes secondary keyword, value hook, and direct call-to-action.
- [ ] **Gate 3 · H1 Hierarchy**: Exactly one H1 tag per page, matching search intent without keyword stuffing.
- [ ] **Gate 4 · Canonical Integrity**: Self-referencing canonical URL, lowercase, HTTPS, zero tracking parameters.
- [ ] **Gate 5 · Schema @graph**: Valid Schema.org/Hotel or LocalBusiness JSON-LD with geo-coordinates and address.
- [ ] **Gate 6 · Content Depth**: Minimum 350+ words of localized, original prose (Jaccard similarity < 75%).
- [ ] **Gate 7 · Image Alt Tags**: 100% of images contain descriptive, localized alt attributes (no empty alts).
- [ ] **Gate 8 · Micro-Neighborhood Anchoring**: Mentions local districts, crossroads, and demand generators within 2 miles.
- [ ] **Gate 9 · Mobile & Social Meta**: Viewport tag present, OpenGraph title, description, and 1200x630px image.
- [ ] **Gate 10 · Direct Booking Value**: Clear direct-booking incentive (best rate guarantee, perks, zero hidden fees).`,
    defaultVariables: {},
  },

  // ── 6. CMS Exporters ──
  {
    id: "shopify-liquid-room",
    title: "Shopify Liquid Room Booking Section",
    category: "CMS Exporters",
    format: "html",
    description: "Ready-to-paste Shopify Liquid section template for hotels running boutique stores or reservation add-ons.",
    tags: ["Shopify", "Liquid", "E-commerce"],
    content: `{% comment %} Cogwheel SEO Studio - Shopify Liquid Exporter {% endcomment %}
<div class="hotel-room-section" id="room-{{ section.id }}">
  <div class="page-width">
    <h2 class="room-title">{{ section.settings.room_title | default: "{{roomTitle}}" }}</h2>
    <div class="room-details">
      <span class="room-price">{{ section.settings.room_price | default: "{{roomStartingRate}}" }}</span>
      <div class="room-desc">{{ section.settings.room_desc | default: "{{roomDescription}}" }}</div>
    </div>
  </div>
</div>

{% schema %}
{
  "name": "Hotel Room Card",
  "settings": [
    { "type": "text", "id": "room_title", "label": "Room Title" },
    { "type": "text", "id": "room_price", "label": "Starting Rate" },
    { "type": "richtext", "id": "room_desc", "label": "Description" }
  ]
}
{% endschema %}`,
    defaultVariables: {
      roomTitle: "King Suite Oceanfront",
      roomStartingRate: "$229 / night",
      roomDescription: "Spacious king bed suite with private balcony overlooking the ocean.",
    },
  },
  {
    id: "wordpress-yoast-meta",
    title: "WordPress / Yoast SEO Meta PHP Filter",
    category: "CMS Exporters",
    format: "html",
    description: "PHP snippet for functions.php to programmatically set Yoast SEO Title, Description, and Schema on hotel custom post types.",
    tags: ["WordPress", "PHP", "Yoast SEO", "RankMath"],
    content: `<?php
/**
 * Cogwheel SEO - WordPress Dynamic Meta Injection
 */
add_filter( 'wpseo_title', function( $title ) {
    if ( is_singular( 'hotel_room' ) ) {
        return '{{targetKeyword}} | {{hotelName}} - {{cityName}}';
    }
    return $title;
});

add_filter( 'wpseo_metadesc', function( $desc ) {
    if ( is_singular( 'hotel_room' ) ) {
        return '{{metaDescription}}';
    }
    return $desc;
});
`,
    defaultVariables: {
      targetKeyword: "Luxury Hotel Suites",
      hotelName: "The Coachman Hotel",
      cityName: "South Lake Tahoe",
      metaDescription: "Book luxury hotel suites at The Coachman Hotel in South Lake Tahoe. Minutes from Heavenly gondola and lake shores.",
    },
  },
];

export const PRESET_CLIENT_PROFILES: ClientProfile[] = [
  {
    id: "universal-website",
    name: "Universal Website (Any Site / E-Commerce / SaaS)",
    brand: "Independent",
    domain: "",
    city: "Global",
    state: "",
    primaryKeywords: ["official website", "brand services", "online solutions"],
    usps: ["Direct official access", "Verified security & performance", "Comprehensive solutions"],
    phone: "",
    address: "",
    postalCode: "",
    startingRate: "",
  },
  {
    id: "springhill-pcb",
    name: "SpringHill Suites Panama City Beachfront",
    brand: "SpringHill Suites by Marriott",
    domain: "marriott.com",
    city: "Panama City Beach",
    state: "FL",
    primaryKeywords: ["hotels beach panama city", "springhill suites panama city beach fl", "hotels on front beach road"],
    usps: ["Direct Gulf beachfront access", "Resort lazy river & outdoor pool", "Free hot breakfast"],
    phone: "+1-850-230-6004",
    address: "12513 Front Beach Road",
    postalCode: "32407",
    startingRate: "$229",
  },
  {
    id: "canopy-boston",
    name: "Canopy by Hilton Boston Downtown",
    brand: "Canopy by Hilton",
    domain: "hilton.com",
    city: "Boston",
    state: "MA",
    primaryKeywords: ["boutique hotels downtown boston", "canopy by hilton boston downtown", "hotels near faneuil hall"],
    usps: ["Historic North End & Freedom Trail proximity", "Complimentary Canopy bicycles", "Artisan rooftop dining"],
    phone: "+1-617-742-0404",
    address: "99 Blackstone Street",
    postalCode: "02109",
    startingRate: "$289",
  },
  {
    id: "ac-hotel-stpete",
    name: "AC Hotel St. Petersburg Downtown",
    brand: "AC Hotels by Marriott",
    domain: "marriott.com",
    city: "St. Petersburg",
    state: "FL",
    primaryKeywords: ["ac hotel st petersburg downtown", "hotels in downtown st petersburg fl", "rooftop bar st petersburg"],
    usps: ["Cane & Barrel rooftop cocktail lounge", "Walking distance to Tropicana Field", "European-inspired breakfast"],
    phone: "+1-727-445-7720",
    address: "110 2nd Street North",
    postalCode: "33701",
    startingRate: "$219",
  },
  {
    id: "coachman-tahoe",
    name: "The Coachman Hotel",
    brand: "Independent Boutique",
    domain: "coachmanhotel.com",
    city: "South Lake Tahoe",
    state: "CA",
    primaryKeywords: ["coachman hotel south lake tahoe", "boutique hotel south lake tahoe", "hotels near heavenly gondola"],
    usps: ["5-minute walk to Heavenly Mountain gondola", "Outdoor firepits & craft beer bar", "Dog-friendly alpine rooms"],
    phone: "+1-530-541-5464",
    address: "4100 Pine Boulevard",
    postalCode: "96150",
    startingRate: "$179",
  },
];

export function extractTemplateVariables(templateContent: string): string[] {
  const matches = templateContent.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || [];
  const vars = new Set<string>();
  matches.forEach((m) => {
    vars.add(m.replace(/\{\{|\}\}/g, "").trim());
  });
  return Array.from(vars);
}

export function resolveTemplateContent(
  templateContent: string,
  variables: Record<string, string>
): string {
  let resolved = templateContent;
  Object.entries(variables).forEach(([key, val]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    resolved = resolved.replace(regex, val || `[${key}]`);
  });
  return resolved;
}

export function calculateSeoScores(data: PageAuditData): ScoreBreakdown {
  const quickWins: QuickWinItem[] = [];

  // 1. On-Page Structure (0 - 100)
  let onPage = 0;

  // Title tag length & pixel width (Optimal: 50-60 chars, max 580px)
  const tLen = (data.title || "").trim().length;
  const isTitleOptimal = tLen >= 45 && tLen <= 65 && (!data.titlePixelWidth || data.titlePixelWidth <= 580);

  if (isTitleOptimal) {
    onPage += 35;
  } else {
    onPage += tLen > 0 ? 10 : 0;
    quickWins.push({
      id: "title-len",
      title: "Title Length Optimization (Title length)",
      severity: "high",
      impact: tLen > 0
        ? `Title is ${tLen} characters / ${data.titlePixelWidth || 680}px (Optimal: 50-60 chars within 580px limit).`
        : "Missing Title Tag: search engines cannot determine page topic.",
      templateIdToFix: "title-meta-suite",
      fixActionLabel: "Fix ->",
    });
  }

  // Meta Description (Optimal: 130-155 chars, max 920px)
  const mLen = (data.metaDesc || "").trim().length;
  const isMetaOptimal = mLen >= 120 && mLen <= 160 && (!data.metaDescPixelWidth || data.metaDescPixelWidth <= 920);

  if (isMetaOptimal) {
    onPage += 35;
  } else {
    onPage += mLen > 0 ? 10 : 0;
    quickWins.push({
      id: "meta-len",
      title: "Meta Description Length & Compliance (Meta description)",
      severity: "high",
      impact: mLen > 0
        ? `Meta description is ${mLen} characters (Optimal: 130-155 chars within 920px limit).`
        : "Missing Meta Description: lowers organic CTR by up to 28%.",
      templateIdToFix: "title-meta-suite",
      fixActionLabel: "Fix ->",
    });
  }

  // Single H1 tag and Canonical (Combined Canonical/H1 Quality Gate)
  const hasValidH1 = data.h1Elements && data.h1Elements.length === 1;
  const hasCanonical = Boolean(data.canonical && data.canonical.trim().length > 0);

  if (hasValidH1) {
    onPage += 30;
  }
  if (hasCanonical) {
    // Canonical score in Schema & Technical
  }

  if (!hasCanonical || !hasValidH1) {
    quickWins.push({
      id: "canonical-h1",
      title: "Canonical URL & H1 Structure (Canonical/H1)",
      severity: "high",
      impact: !hasCanonical
        ? "Missing self-referencing canonical tag and non-standard H1 hierarchy."
        : `Multiple H1 tags found (${data.h1Elements?.length || 0} tags); dilutes keyword focus.`,
      templateIdToFix: "usp-headline-hero",
      fixActionLabel: "Fix ->",
    });
  }

  // 2. Schema & Technical (0 - 100)
  let schemaTechnical = 0;
  if (hasCanonical) schemaTechnical += 25;
  if (data.hasViewport) schemaTechnical += 20;

  // Schema presence (Supports Hotel, Organization, WebSite, LocalBusiness, Product, Article, SoftwareApplication, Service, etc.)
  const hasStructuredSchema = (data.schemas || []).some((s) => {
    const t = String(s["@type"] || "").toLowerCase();
    return (
      t.includes("hotel") ||
      t.includes("lodging") ||
      t.includes("resort") ||
      t.includes("localbusiness") ||
      t.includes("organization") ||
      t.includes("website") ||
      t.includes("product") ||
      t.includes("article") ||
      t.includes("softwareapplication") ||
      t.includes("service") ||
      t.includes("corporation") ||
      t.includes("store")
    );
  });

  if (hasStructuredSchema) {
    schemaTechnical += 35;
  } else {
    quickWins.push({
      id: "schema-hotel-missing",
      title: "Missing Structured Data (JSON-LD Schema)",
      severity: "high",
      impact: "Missing Schema.org structured data (Organization, LocalBusiness, Product, Hotel, or WebSite) blocks Google rich snippets and entity knowledge graphs.",
      templateIdToFix: "schema-hotel-graph",
      fixActionLabel: "Fix ->",
    });
  }

  if (data.imagesWithoutAlt === 0) {
    schemaTechnical += 20;
  } else {
    schemaTechnical += 5;
  }

  // 3. GEO / AI Visibility Readiness (0 - 100)
  let geoAiReadiness = 0;

  // Has FAQ schema & Content Depth (GEO AI Readiness)
  const hasFaq = (data.schemas || []).some((s) => String(s["@type"] || "").toLowerCase().includes("faq"));
  const hasAdequateWords = data.words >= 450;

  if (hasAdequateWords && hasFaq) {
    geoAiReadiness += 70; // 35 for words + 35 for FAQ
  } else {
    quickWins.push({
      id: "geo-ai-readiness",
      title: "GEO AI Readiness & FAQ Entity Signals (GEO AI Readiness)",
      severity: "high",
      impact: "Thin content or missing FAQPage schema prevents citation in Gemini Overviews and ChatGPT Search.",
      templateIdToFix: "schema-faq-rich",
      fixActionLabel: "Fix ->",
    });
  }

  // Social OpenGraph
  const hasOg = Boolean(data.hasOgTitle && data.hasOgImage);
  if (hasOg) {
    geoAiReadiness += 30;
  } else {
    quickWins.push({
      id: "og-missing",
      title: "Social Open Graph Tags Missing (Open Graph tags)",
      severity: "medium",
      impact: "Missing og:title, og:image, and Twitter cards degrades social click share and brand entity recognition.",
      templateIdToFix: "title-meta-suite",
      fixActionLabel: "Fix ->",
    });
  }

  // Overall Score (Weighted: 35% On-Page, 35% Schema/Tech, 30% GEO AI)
  const overall = Math.round(onPage * 0.35 + schemaTechnical * 0.35 + geoAiReadiness * 0.3);

  let grade: ScoreBreakdown["grade"] = "NEEDS AUDIT";
  let gradeColor = "#ef4444";
  if (overall >= 90) {
    grade = "A+";
    gradeColor = "#10b981";
  } else if (overall >= 80) {
    grade = "A";
    gradeColor = "#10b981";
  } else if (overall >= 70) {
    grade = "B";
    gradeColor = "#0284c7";
  } else if (overall >= 55) {
    grade = "C";
    gradeColor = "#f59e0b";
  }

  return {
    overall: Math.min(100, Math.max(0, overall)),
    onPage: Math.min(100, Math.max(0, onPage)),
    schemaTechnical: Math.min(100, Math.max(0, schemaTechnical)),
    geoAiReadiness: Math.min(100, Math.max(0, geoAiReadiness)),
    grade,
    gradeColor,
    passedGates: Math.max(0, 10 - quickWins.length),
    totalGates: 10,
    quickWins,
  };
}

export const COGWHEEL_OPTIMAL_AUDIT_DATA: PageAuditData = {
  url: "https://github.com/jisan-razibmarketing/Cogwheel-SEO-Templates",
  origin: "https://github.com",
  pathname: "/jisan-razibmarketing/Cogwheel-SEO-Templates",
  protocol: "https:",
  hostname: "github.com",
  title: "Cogwheel SEO & Hospitality Templates Studio | Official Site",
  titlePixelWidth: 465,
  metaDesc: "Production-grade, spec-driven SEO and Generative Engine Optimization (GEO) platform for independent and enterprise hotel properties by Razib Marketing.",
  metaDescPixelWidth: 880,
  canonical: "https://github.com/jisan-razibmarketing/Cogwheel-SEO-Templates",
  metaRobots: "index, follow",
  language: "en",
  h1Elements: ["Cogwheel SEO & Hospitality Templates Studio"],
  h2Elements: [
    "Brand Guardrails & Pixel Enforcement",
    "Lodging Schema & JSON-LD Automation",
    "Generative Engine Optimization (GEO) Answer Blocks",
    "Automated Multi-Property Batch Auditing",
  ],
  h3Elements: [
    "Enterprise Hospitality Brand Presets",
    "FAQPage & Entity Graph Validation",
    "OTA Direct-Booking Displacement Engine",
  ],
  allHeadings: [
    { tag: "H1", text: "Cogwheel SEO & Hospitality Templates Studio" },
    { tag: "H2", text: "Brand Guardrails & Pixel Enforcement" },
    { tag: "H2", text: "Lodging Schema & JSON-LD Automation" },
    { tag: "H2", text: "Generative Engine Optimization (GEO) Answer Blocks" },
    { tag: "H2", text: "Automated Multi-Property Batch Auditing" },
    { tag: "H3", text: "Enterprise Hospitality Brand Presets" },
    { tag: "H3", text: "FAQPage & Entity Graph Validation" },
    { tag: "H3", text: "OTA Direct-Booking Displacement Engine" },
  ],
  totalImages: 12,
  imagesWithoutAlt: 0,
  oversizedImages: 0,
  imagesList: [
    { src: "/assets/banner.png", alt: "Cogwheel SEO Studio Banner", loading: "lazy" },
    { src: "/assets/preview.png", alt: "SERP and Social Preview", loading: "lazy" },
  ],
  words: 1450,
  extractedAmenities: [
    "Brand Guardrails",
    "Pixel Width Enforcement",
    "Lodging JSON-LD Schema",
    "FAQPage Schema",
    "GEO AI Readiness",
    "Batch Auditing",
    "Non-Destructive Overlays",
  ],
  topKeywords: [
    { term: "hospitality seo", count: 28, density: "1.9%" },
    { term: "geo ai", count: 22, density: "1.5%" },
    { term: "direct booking", count: 19, density: "1.3%" },
    { term: "hotel schema", count: 16, density: "1.1%" },
    { term: "ota displacement", count: 14, density: "1.0%" },
  ],
  schemas: [
    {
      "@context": "https://schema.org",
      "@type": "Hotel",
      name: "Cogwheel Luxury Resort & Studio",
      description: "Premier hospitality SEO and Generative Engine Optimization platform.",
      url: "https://github.com/jisan-razibmarketing/Cogwheel-SEO-Templates",
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is Cogwheel SEO Studio?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Cogwheel SEO Studio is a specialized hospitality optimization platform designed for hotel SEO managers.",
          },
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home" },
        { "@type": "ListItem", position: 2, name: "Hospitality SEO Templates" },
      ],
    },
  ],
  links: {
    internal: 58,
    external: 14,
    nofollow: 0,
  },
  internalUrls: [
    "https://github.com/jisan-razibmarketing/Cogwheel-SEO-Templates/blob/main/templates/brand-compliant-hotel-onpage.md",
    "https://github.com/jisan-razibmarketing/Cogwheel-SEO-Templates/blob/main/templates/hotel-geo-ai-visibility.md",
    "https://github.com/jisan-razibmarketing/Cogwheel-SEO-Templates/blob/main/templates/hotel-lodging-schema.md",
  ],
  hasViewport: true,
  hasOgTitle: true,
  hasOgImage: true,
  ogTitle: "Cogwheel SEO & Hospitality Templates Studio | Official Site",
  ogDescription: "Production-grade, spec-driven SEO and Generative Engine Optimization (GEO) platform for independent and enterprise hotel properties by Razib Marketing.",
  ogImage: "https://raw.githubusercontent.com/jisan-razibmarketing/Cogwheel-SEO-Templates/main/assets/banner.png",
  twitterTags: {
    card: "summary_large_image",
    title: "Cogwheel SEO & Hospitality Templates Studio",
    description: "Production-grade hospitality SEO & GEO platform.",
    image: "https://raw.githubusercontent.com/jisan-razibmarketing/Cogwheel-SEO-Templates/main/assets/banner.png",
  },
  detectedNap: {
    phone: "+1-800-555-0199",
    address: "Panama City Beachfront, FL 32413",
    email: "contact@razibmarketing.com",
  },
  socialLinks: [
    { platform: "GitHub", url: "https://github.com/jisan-razibmarketing/Cogwheel-SEO-Templates" },
  ],
  loadTimeMs: 240,
};
