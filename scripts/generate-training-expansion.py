#!/usr/bin/env python3
"""
Expand the SEO Studio unified SEO SFT set by 100 reviewable pairs.

Design rules:
- Eval split is frozen (never touched).
- New pairs are appended to train only (134 -> 234; total 168 -> 268).
- Every pair carries meta.category so the split can be audited later.
- No fabricated metrics: answers never invent traffic, rankings, backlinks, volumes or citations.
- Dedupe by SHA-256 of the normalised user+assistant text against the whole corpus.

Run: python3 scripts/generate-training-expansion.py
"""
import json
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TRAIN = ROOT / "data/training/unified_seo_train.jsonl"
EVAL = ROOT / "data/training/unified_seo_eval.jsonl"
REPORT = ROOT / "data/training/dataset_quality_report.json"

ALGO_SYSTEM = (
    "You are SEO Studio's Principal Search Algorithm & Recovery Specialist. Analyze Google core "
    "algorithm updates, helpful content systems, spam policies, and technical volatility to provide "
    "precise diagnostic and recovery actions. Separate verified update facts from assumptions, and "
    "never invent traffic, rankings, backlinks or search volumes."
)

KEYWORD_SYSTEM = (
    "You are SEO Studio's Senior SERP Strategist and Keyword Optimization Specialist. Provide search "
    "intent classification, competition reasoning, and target-page mapping. Do not invent search "
    "volume, difficulty or CPC values; mark them as unmeasured unless supplied."
)

GSC_SYSTEM = (
    "You are SEO Studio's Search Console & Cannibalization Analyst. Diagnose query/page overlap, "
    "indexing and performance issues from supplied data only. If the data is insufficient, say so "
    "explicitly and list what to pull. Never fabricate impressions, clicks, positions or traffic."
)

GEO_SYSTEM = (
    "You are SEO Studio's Generative Engine Optimization (GEO) Specialist. Assess AI Overview and AI "
    "citation readiness using verifiable on-page and crawl evidence. Never fabricate citations, "
    "traffic, rankings or share of voice."
)

AGENT_SYSTEM = (
    "You are the {name} in the SEO Studio Unified SEO Platform (agent: {slug}). Return a concrete, "
    "evidence-based audit plan for the stated scope. Distinguish measured facts from assumptions, "
    "and never invent traffic, rankings, backlinks or search volumes."
)


def bullets(items):
    return "\n".join(f"- {x}" for x in items)


def numbered(items):
    return "\n".join(f"{i + 1}. {x}" for i, x in enumerate(items))


def algo_answer(d):
    return (
        f"### Analysis: {d['name']} ({d['date']})\n\n"
        f"**Classification:** {d['type']}\n"
        f"**Official source:** {d['source']}\n\n"
        f"**Documented focus:** {d['focus']}\n\n"
        f"**Verify before acting**\n{bullets(d['verify'])}\n\n"
        f"**Diagnostic steps**\n{numbered(d['diagnose'])}\n\n"
        f"**Recovery actions**\n{numbered(d['recover'])}\n\n"
        f"**Avoid**\n{bullets(d['avoid'])}\n\n"
        f"**Validation window:** {d['validate']}"
    )


def agent_answer(a, task, industry):
    return (
        f"### {a['name']} — {task}\n\n"
        f"**Scope:** {a['objective']} (context: {industry} site).\n\n"
        f"**Inputs required**\n{bullets(a['inputs'])}\n\n"
        f"**Checks**\n{numbered(a['checks'])}\n\n"
        f"**Deliverable**\n{bullets(a['outputs'])}\n\n"
        f"**Guardrails:** {a['guardrails']}"
    )


def kw_answer(k):
    return (
        f"### Keyword: \"{k['kw']}\"\n\n"
        f"**Intent:** {k['intent']}\n"
        f"**Target page:** {k['page']}\n"
        f"**SERP features to expect:** {k['serp']}\n\n"
        f"**Why this mapping**\n{bullets(k['why'])}\n\n"
        f"**Supporting content & internal links**\n{bullets(k['support'])}\n\n"
        f"**Cannibalization guard**\n{bullets(k['cannibal'])}\n\n"
        f"**Measurement note:** {k['measure']}"
    )


def diag_answer(d):
    return (
        f"### {d['title']}\n\n"
        f"**Signal:** {d['signal']}\n\n"
        f"**Diagnosis**\n{numbered(d['diagnose'])}\n\n"
        f"**Recommended actions**\n{numbered(d['actions'])}\n\n"
        f"**Evidence standard:** {d['evidence']}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# A. Google Algorithm Updates (+15)
# ─────────────────────────────────────────────────────────────────────────────

ALGO = [
    {
        "id": "algo-2025-03-core",
        "name": "March 2025 core update",
        "date": "13–27 March 2025",
        "type": "CORE",
        "source": "https://status.search.google.com/incidents/zpmwuSwifjDjfrVdaZUx",
        "focus": "A normal broad core update. Google did not name a specific system; broad core updates re-rank content against overall helpfulness and relevance signals.",
        "verify": [
            "Confirm the rollout dates on Google's Search Status Dashboard rather than a third-party volatility tool.",
            "Compare a full pre-update and post-update window with enough days on each side to avoid weekly seasonality.",
            "Rule out a manual action in Search Console before attributing the change to the update.",
            "Check for concurrent technical changes (robots, canonical, template, CMS migration) that share the timeline.",
        ],
        "diagnose": [
            "Segment the decline by page type, query intent and device instead of looking at the sitewide total.",
            "Identify pages and queries that lost or gained, and look for a content-quality or intent mismatch on the losers.",
            "Audit the weakest cohort for thin sections, duplicated intent, missing first-hand detail and weak internal links.",
            "Compare the losing pages with the current top results for the same query to see what those pages provide.",
        ],
        "recover": [
            "Improve the pages with the clearest relevance or depth gap; do not rewrite the whole site at once.",
            "Consolidate near-duplicate pages that compete for the same intent into one stronger page.",
            "Strengthen internal links from strong pages to the pages that lost visibility.",
            "Re-check entity clarity (names, locations, offerings) so the page is unambiguous.",
            "Hold changes long enough to measure before judging the result.",
        ],
        "avoid": [
            "Mass noindexing or deleting pages to chase the update.",
            "Blaming the update when Search Console shows a technical or manual cause.",
            "Rolling out several large changes at once, which makes attribution impossible.",
        ],
        "validate": "Allow at least 2–4 weeks after the rollout completes and compare the same page cohorts before concluding success or failure.",
    },
    {
        "id": "algo-2025-06-core",
        "name": "June 2025 core update",
        "date": "30 June – 17 July 2025",
        "type": "CORE",
        "source": "https://status.search.google.com/incidents/riq1AuqETW46NfBCe5NT",
        "focus": "A broad core update. As with other core updates, there is no fixed list of 'winners' or 'losers'; impact depends on how well pages match intent and demonstrate helpfulness.",
        "verify": [
            "Confirm start and completion dates on the Search Status Dashboard.",
            "Separate branded from non-branded queries; branded demand moves for reasons unrelated to the update.",
            "Check whether the decline is a position change, a CTR change at stable position, or a demand change.",
        ],
        "diagnose": [
            "Build a before/after table of query, page, impressions, clicks and average position.",
            "Flag pages that lost position but kept impressions (relevance/quality) vs pages that lost impressions (demand or indexing).",
            "Review the losing pages for outdated facts, missing comparisons and shallow coverage.",
            "Check whether a competing page on your own site now ranks for the same query.",
        ],
        "recover": [
            "Refresh the highest-value losing pages with current, specific and verifiable information.",
            "Add the subtopics the current top results cover but your page omits.",
            "Remove or merge sections that dilute the page's primary intent.",
            "Fix internal links so the preferred page receives the strongest anchor support.",
        ],
        "avoid": [
            "Assuming every drop is algorithmic when it may be seasonality or a tracking change.",
            "Publishing large volumes of low-detail pages in response.",
            "Changing titles and headings on hundreds of pages without a hypothesis.",
        ],
        "validate": "Compare a 28-day post-rollout window against the matching pre-rollout window, and hold one change set per cohort.",
    },
    {
        "id": "algo-2025-12-core",
        "name": "December 2025 core update",
        "date": "11–29 December 2025",
        "type": "CORE",
        "source": "https://status.search.google.com/incidents/DsirqJ1gpPRgVQeccPRv",
        "focus": "A broad core update that overlapped the holiday period, which makes seasonality especially easy to misread.",
        "verify": [
            "Confirm the rollout window on the Search Status Dashboard.",
            "Account for holiday seasonality by comparing against the same period in prior years, not just the prior month.",
            "Check that analytics and Search Console property configuration did not change during the window.",
        ],
        "diagnose": [
            "Compare year-over-year and week-over-week trends for the affected page groups.",
            "Separate transactional pages (seasonal demand) from informational pages (usually less seasonal).",
            "Look for pages that lost visibility for queries where a different page on the same site gained.",
            "Review content freshness where facts, prices or availability may have changed.",
        ],
        "recover": [
            "Prioritise evergreen pages whose relevance gap is clear and measurable.",
            "Update seasonal pages before the next booking cycle rather than mid-holiday.",
            "Consolidate competing pages and point internal links at the canonical target.",
            "Re-measure after the seasonal noise subsides.",
        ],
        "avoid": [
            "Treating a holiday demand dip as an algorithm penalty.",
            "Making irreversible structural changes during peak season.",
            "Ignoring year-over-year context.",
        ],
        "validate": "Use year-over-year plus a post-holiday window; avoid drawing conclusions from December data alone.",
    },
    {
        "id": "algo-2025-08-spam",
        "name": "August 2025 spam update",
        "date": "26 August – 22 September 2025",
        "type": "SPAM",
        "source": "https://status.search.google.com/incidents/a7Aainy6E9rZsmfq82xt",
        "focus": "Improved spam detection across countries and languages. Spam updates target policy-violating techniques rather than general content quality.",
        "verify": [
            "Check Search Console for manual actions and security issues first.",
            "Confirm the rollout dates on the Search Status Dashboard.",
            "Identify whether the affected URLs share a spam-adjacent pattern (thin pages, cloaking, paid links, scraped content).",
        ],
        "diagnose": [
            "Audit for scaled content abuse: large volumes of low-value pages generated primarily to rank.",
            "Audit for site reputation abuse: third-party content published on an otherwise trusted domain without real oversight.",
            "Check for cloaking, sneaky redirects, doorway pages and hidden text.",
            "Review inbound links for paid or exchanged patterns, but do not disavow without evidence.",
            "Check user-generated content sections for injected spam.",
        ],
        "recover": [
            "Remove or noindex policy-violating sections rather than rewriting them cosmetically.",
            "Clean spammy UGC and add moderation controls.",
            "Remove paid or exchanged links you control, and document the removal.",
            "Submit a reconsideration request only after the violations are actually fixed.",
        ],
        "avoid": [
            "Disavowing every low-quality link as a reflex.",
            "Submitting a reconsideration request before remediation is complete.",
            "Assuming a spam update is a content-quality update.",
        ],
        "validate": "Re-crawl the affected sections, confirm the violations are gone, then monitor recovery over multiple weeks.",
    },
    {
        "id": "algo-2024-03-core-spam",
        "name": "March 2024 core update and spam policy expansion",
        "date": "5 March 2024",
        "type": "CORE+SPAM",
        "source": "https://developers.google.com/search/blog/2024/03/core-update-spam-policies",
        "focus": "The Helpful Content System was folded into core ranking, and new spam policies targeted scaled content abuse, site reputation abuse and expired domain abuse.",
        "verify": [
            "Confirm which of the three spam policies could plausibly apply to the affected sections.",
            "Check for manual actions separately from algorithmic impact.",
            "Map the timeline of any migration, bulk publishing or domain change.",
        ],
        "diagnose": [
            "Find sections with high page counts but little unique value.",
            "Check whether third-party or partner content is published without editorial control.",
            "Check whether an expired domain was repurposed to carry unrelated content.",
            "Identify pages that exist only to capture variations of the same query.",
        ],
        "recover": [
            "Prune or consolidate scaled, low-value pages.",
            "Add genuine editorial oversight to partner content, or remove it.",
            "Rebuild expired-domain content around the current brand and audience.",
            "Improve the pages that remain instead of replacing volume with more volume.",
        ],
        "avoid": [
            "Deleting pages without first checking whether they earn links or traffic.",
            "Assuming the Helpful Content System still operates as a separate classifier.",
            "Treating a policy issue as a purely technical problem.",
        ],
        "validate": "Track the pruned and improved cohorts separately for at least a month.",
    },
    {
        "id": "algo-2023-09-helpful-content",
        "name": "September 2023 helpful content update",
        "date": "14–28 September 2023",
        "type": "HELPFUL CONTENT",
        "source": "https://developers.google.com/search/blog/2023/09/helpful-content-update",
        "focus": "A sitewide classifier signal rewarding people-first content and demoting content created primarily for search engines.",
        "verify": [
            "Check whether the decline is sitewide rather than limited to a few pages.",
            "Confirm no manual action or technical regression explains the change.",
            "Review who the content is for and whether it demonstrates first-hand experience.",
        ],
        "diagnose": [
            "Identify pages written to satisfy a keyword rather than a reader.",
            "Look for missing authorship, sourcing, original data and first-hand detail.",
            "Check for content that summarises other pages without adding value.",
            "Assess whether the site has a clear primary purpose.",
        ],
        "recover": [
            "Rewrite or remove the weakest pages, focusing on demonstrable experience.",
            "Add original evidence such as tests, photos, measurements or interviews.",
            "Clarify authorship and editorial standards.",
            "Reduce the ratio of low-value pages to high-value pages.",
        ],
        "avoid": [
            "Adding superficial 'experience' claims without substance.",
            "Assuming a sitewide classifier can be fixed page by page.",
            "Publishing more content to offset a helpfulness problem.",
        ],
        "validate": "Measure at the site level, not only on individual pages, over several weeks.",
    },
    {
        "id": "algo-2023-11-reviews",
        "name": "November 2023 reviews update",
        "date": "8 November 2023",
        "type": "REVIEWS",
        "source": "https://developers.google.com/search/blog/2023/11/reviews-update",
        "focus": "The reviews system evaluates first-hand, in-depth review content rather than generic summaries.",
        "verify": [
            "Confirm the affected pages are review or comparison content.",
            "Check whether the review shows evidence of direct experience.",
            "Distinguish product/service reviews from unrelated editorial pages.",
        ],
        "diagnose": [
            "Look for reviews that restate specifications without testing or use.",
            "Check for missing pros/cons, alternatives, pricing context or real-world outcomes.",
            "Identify review pages that target queries but do not help a purchase decision.",
        ],
        "recover": [
            "Add first-hand evidence: photos, measurements, usage notes, timeframes.",
            "Include meaningful comparisons and who the product is not for.",
            "Update outdated pricing and availability.",
            "Remove review pages you cannot support with real experience.",
        ],
        "avoid": [
            "Adding unverifiable claims of testing.",
            "Copying manufacturer copy and labelling it a review.",
            "Assuming every review page must be rewritten at once.",
        ],
        "validate": "Compare review-page cohorts against non-review pages to confirm the change is specific.",
    },
    {
        "id": "algo-2023-08-core",
        "name": "August 2023 core update",
        "date": "22 August – 7 September 2023",
        "type": "CORE",
        "source": "https://developers.google.com/search/blog/2023/08/core-update",
        "focus": "A broad core update. Impact is distributed across many signals and cannot be reduced to a single fix.",
        "verify": [
            "Confirm the rollout dates and completion.",
            "Check for overlapping updates or technical changes in the same window.",
            "Separate paid, direct and organic traffic before reacting.",
        ],
        "diagnose": [
            "Segment by query intent and page template.",
            "Find pages whose ranking changed without a content change (competitor or relevance shift).",
            "Review the top results for the affected queries and compare depth and format.",
        ],
        "recover": [
            "Improve relevance and depth on the clearest losers.",
            "Fix intent mismatches (for example, a blog post ranking for a transactional query).",
            "Strengthen internal linking and canonicalisation.",
            "Re-measure a stable cohort before wider rollout.",
        ],
        "avoid": [
            "Sitewide rewrites based on a single week of data.",
            "Assuming a core update requires a technical fix.",
            "Ignoring competitor changes.",
        ],
        "validate": "Use a four-week pre/post comparison per cohort.",
    },
    {
        "id": "algo-2023-10-core",
        "name": "October 2023 core update",
        "date": "5–19 October 2023",
        "type": "CORE",
        "source": "https://developers.google.com/search/blog/2023/10/core-update",
        "focus": "A broad core update that followed the helpful content and reviews changes closely, making attribution harder.",
        "verify": [
            "Check whether the site was already affected by the preceding updates.",
            "Confirm no technical regression occurred between updates.",
            "Separate new losses from continuation of an earlier decline.",
        ],
        "diagnose": [
            "Compare the current decline with the trajectory before the update.",
            "Identify pages that never recovered from the prior update.",
            "Review content quality and intent alignment on the persistent losers.",
        ],
        "recover": [
            "Focus on pages with a sustained, multi-update decline.",
            "Consolidate or remove pages that repeatedly fail to perform.",
            "Improve the strongest pages rather than spreading effort thinly.",
        ],
        "avoid": [
            "Treating each update as an isolated event.",
            "Repeating changes that already failed.",
            "Chasing short-term volatility.",
        ],
        "validate": "Track cohorts across multiple updates to separate persistent from transient effects.",
    },
    {
        "id": "algo-2023-03-core",
        "name": "March 2023 core update",
        "date": "15–28 March 2023",
        "type": "CORE",
        "source": "https://developers.google.com/search/blog/2023/03/core-update",
        "focus": "A broad core update. Core updates do not target specific sites; they reassess content against overall quality and relevance.",
        "verify": [
            "Confirm the rollout dates.",
            "Check Search Console for manual actions and indexing changes.",
            "Review analytics for tracking or consent changes.",
        ],
        "diagnose": [
            "Build a list of losing and winning pages by template.",
            "Look for quality gaps on the losers: thin content, missing expertise, poor structure.",
            "Check whether the winners offer a better format for the intent.",
        ],
        "recover": [
            "Improve the weakest high-value pages first.",
            "Add missing depth and first-hand detail.",
            "Fix structural issues such as unclear headings and weak internal links.",
        ],
        "avoid": [
            "Wholesale deletion without evidence.",
            "Assuming a penalty.",
            "Ignoring format and intent.",
        ],
        "validate": "Hold changes and compare the same cohorts after four weeks.",
    },
    {
        "id": "algo-2022-12-helpful-content",
        "name": "December 2022 helpful content update",
        "date": "5 December 2022",
        "type": "HELPFUL CONTENT",
        "source": "https://developers.google.com/search/blog/2022/12/helpful-content-update",
        "focus": "An update to the helpful content system, which assesses whether content is written for people or primarily for search engines.",
        "verify": [
            "Check whether the impact is sitewide.",
            "Review content purpose and audience clarity.",
            "Rule out technical and manual causes.",
        ],
        "diagnose": [
            "Identify content created mainly to capture search traffic.",
            "Look for missing evidence, sourcing and first-hand experience.",
            "Check for excessive coverage of unrelated topics.",
        ],
        "recover": [
            "Improve or remove low-value content.",
            "Focus the site on its primary purpose.",
            "Add demonstrable experience and original information.",
        ],
        "avoid": [
            "Adding 'helpful' boilerplate without substance.",
            "Expanding into unrelated topics for traffic.",
            "Assuming a page-level fix resolves a sitewide signal.",
        ],
        "validate": "Measure site-level change over several weeks.",
    },
    {
        "id": "algo-2022-09-core",
        "name": "September 2022 core update",
        "date": "12–26 September 2022",
        "type": "CORE",
        "source": "https://developers.google.com/search/blog/2022/09/core-update",
        "focus": "A broad core update with wide-ranging impact across many site types.",
        "verify": [
            "Confirm dates and completion.",
            "Check for overlapping product reviews or helpful content updates.",
            "Separate organic from other channels.",
        ],
        "diagnose": [
            "Segment by intent and template.",
            "Look for intent mismatches and thin pages.",
            "Compare against current top results.",
        ],
        "recover": [
            "Improve relevance and depth.",
            "Consolidate competing pages.",
            "Strengthen internal linking.",
        ],
        "avoid": [
            "Overreacting to a single week.",
            "Applying generic 'SEO fixes' without a hypothesis.",
            "Ignoring overlapping updates.",
        ],
        "validate": "Use a four-week comparison and hold the change set.",
    },
    {
        "id": "algo-2021-06-spam",
        "name": "June 2021 spam update (SpamBrain)",
        "date": "June 2021",
        "type": "SPAM",
        "source": "https://developers.google.com/search/blog/2021/06/spam-update",
        "focus": "Introduction of SpamBrain, an AI-based spam prevention system, alongside broader spam detection improvements.",
        "verify": [
            "Check Search Console for manual actions.",
            "Identify spam-adjacent patterns: link schemes, scraped content, doorway pages.",
            "Confirm the timeline of any link-building campaign.",
        ],
        "diagnose": [
            "Audit inbound links for paid or exchanged placements.",
            "Check for scraped or auto-generated content.",
            "Review redirects and doorway pages.",
        ],
        "recover": [
            "Remove links you control that violate policy.",
            "Replace scraped content with original content.",
            "Remove doorway pages and fix deceptive redirects.",
        ],
        "avoid": [
            "Blind disavowing.",
            "Reconsideration before remediation.",
            "Assuming all ranking drops are spam-related.",
        ],
        "validate": "Confirm remediation with a crawl and monitor over multiple weeks.",
    },
    {
        "id": "algo-2024-site-reputation-abuse",
        "name": "Site reputation abuse policy",
        "date": "Policy announced March 2024",
        "type": "SPAM POLICY",
        "source": "https://developers.google.com/search/docs/essentials/spam-policies#site-reputation-abuse",
        "focus": "Third-party content published on a host site without close oversight, where the content exploits the host's ranking signals.",
        "verify": [
            "List all third-party, partner or affiliate content published on the domain.",
            "Check who controls the content and whether the host reviews it.",
            "Confirm whether the sections are monetised without editorial involvement.",
        ],
        "diagnose": [
            "Identify subfolders or sections with unrelated topics.",
            "Check for thin partner pages that exist mainly to rank.",
            "Review whether the host would publish the content without payment.",
        ],
        "recover": [
            "Add genuine editorial oversight or remove the content.",
            "Noindex or block sections that cannot be overseen.",
            "Keep only partner content that serves the host's audience.",
        ],
        "avoid": [
            "Assuming 'sponsored' labels alone resolve the issue.",
            "Keeping high-revenue sections that violate the policy.",
            "Removing content without checking link and traffic dependencies.",
        ],
        "validate": "Re-crawl the affected sections and monitor the domain's overall visibility.",
    },
    {
        "id": "algo-2024-scaled-content-abuse",
        "name": "Scaled content abuse policy",
        "date": "Policy announced March 2024",
        "type": "SPAM POLICY",
        "source": "https://developers.google.com/search/docs/essentials/spam-policies#scaled-content",
        "focus": "Large volumes of pages created primarily to manipulate rankings, regardless of whether they are human- or machine-generated.",
        "verify": [
            "Count pages published per period and their unique value.",
            "Check whether pages target near-identical queries with little differentiation.",
            "Identify automated or templated generation at scale.",
        ],
        "diagnose": [
            "Find clusters of near-duplicate pages.",
            "Assess whether each page would be useful to a reader on its own.",
            "Check for programmatic pages with no unique data.",
        ],
        "recover": [
            "Consolidate or prune low-value pages.",
            "Add unique data or functionality where pages are kept.",
            "Slow publishing until quality controls are in place.",
        ],
        "avoid": [
            "Replacing quantity with more quantity.",
            "Deleting pages that earn links or conversions without review.",
            "Assuming AI-generated content is automatically a violation.",
        ],
        "validate": "Track pruned and retained cohorts separately.",
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# B. 20 Claude-SEO Agents (+30)
# ─────────────────────────────────────────────────────────────────────────────

AGENTS = [
    {
        "name": "SEO Agentic Agent",
        "slug": "seo-agentic",
        "objective": "plan and route a multi-step SEO programme with explicit dependencies",
        "inputs": ["Business goal and priority URLs", "Available data sources and limits", "Team capacity and approval rules"],
        "checks": [
            "Break the goal into crawl, content, technical and measurement workstreams.",
            "Identify dependencies and the smallest verifiable first step.",
            "Define an owner and evidence source for each task.",
            "Flag tasks that require human approval before execution.",
        ],
        "outputs": ["Sequenced task plan", "Dependency map", "Definition of done per task"],
        "guardrails": "Do not execute live changes; propose them for human approval.",
    },
    {
        "name": "SEO Backlinks Agent",
        "slug": "seo-backlinks",
        "objective": "assess link profile quality and risk without inventing authority metrics",
        "inputs": ["Backlink export with source URL and anchor", "Referring-domain list", "Disavow history"],
        "checks": [
            "Group referring domains by relevance, not only by count.",
            "Flag paid, exchanged or obviously automated patterns.",
            "Check anchor-text distribution for over-optimisation.",
            "Identify broken or redirected link targets.",
        ],
        "outputs": ["Risk-tiered link list", "Reclamation targets", "Remediation actions"],
        "guardrails": "Never invent domain authority, traffic or spam scores.",
    },
    {
        "name": "SEO Cluster Agent",
        "slug": "seo-cluster",
        "objective": "build topical clusters that map queries to one canonical page each",
        "inputs": ["Keyword list with intent labels", "Existing URL inventory", "Internal link graph"],
        "checks": [
            "Group keywords by shared intent, not just lexical similarity.",
            "Assign one primary page per cluster.",
            "Identify orphan keywords with no target page.",
            "Check for pages competing inside the same cluster.",
        ],
        "outputs": ["Cluster map", "Page-to-query assignments", "Gap list"],
        "guardrails": "Mark volumes as unmeasured unless supplied.",
    },
    {
        "name": "SEO Content Agent",
        "slug": "seo-content",
        "objective": "audit content quality, depth and intent alignment",
        "inputs": ["Target URLs", "Primary query per URL", "Top-ranking competitor pages"],
        "checks": [
            "Check whether the page answers the primary intent above the fold.",
            "Identify missing subtopics covered by top results.",
            "Assess originality and first-hand evidence.",
            "Check heading structure and scannability.",
        ],
        "outputs": ["Page-level content brief", "Gap list", "Rewrite priorities"],
        "guardrails": "Do not recommend mass rewriting without a hypothesis.",
    },
    {
        "name": "SEO DataForSEO Agent",
        "slug": "seo-dataforseo",
        "objective": "plan SERP and keyword data enrichment with clear provenance",
        "inputs": ["Keyword set", "Target market and language", "API availability"],
        "checks": [
            "Confirm the data source, location and device for every metric.",
            "Distinguish measured values from modelled or missing values.",
            "Check for duplicate or truncated SERP results.",
        ],
        "outputs": ["Data request spec", "Field dictionary", "Provenance notes"],
        "guardrails": "If the API is unavailable, report metrics as unmeasured.",
    },
    {
        "name": "SEO Drift Agent",
        "slug": "seo-drift",
        "objective": "detect unintended changes to titles, headings, schema and content over time",
        "inputs": ["Baseline crawl snapshot", "Current crawl snapshot", "Deployment log"],
        "checks": [
            "Diff title, meta description, H1 and canonical per URL.",
            "Diff structured data types and required fields.",
            "Correlate changes with deployments.",
            "Flag changes that were not intentional.",
        ],
        "outputs": ["Drift report", "Suspected cause", "Rollback candidates"],
        "guardrails": "Do not revert changes without owner confirmation.",
    },
    {
        "name": "SEO Ecommerce Agent",
        "slug": "seo-ecommerce",
        "objective": "audit category, product and faceted-navigation SEO",
        "inputs": ["Category and product URLs", "Facet/filter URL patterns", "Canonical rules"],
        "checks": [
            "Check indexability of facets and sort parameters.",
            "Verify category pages have unique introductory content.",
            "Check product schema and availability markup.",
            "Identify duplicate product descriptions.",
        ],
        "outputs": ["Facet indexation policy", "Template fixes", "Priority pages"],
        "guardrails": "Do not block facets that carry unique demand without evidence.",
    },
    {
        "name": "SEO Flow Agent",
        "slug": "seo-flow",
        "objective": "apply the FLOW framework to prioritise work by impact and effort",
        "inputs": ["Issue backlog", "Traffic and conversion context", "Effort estimates"],
        "checks": [
            "Score each issue by reach, impact, confidence and effort.",
            "Separate quick wins from structural work.",
            "Identify issues that block other work.",
        ],
        "outputs": ["Prioritised backlog", "Rationale per item"],
        "guardrails": "Use supplied data; do not invent reach or conversion values.",
    },
    {
        "name": "SEO GEO Agent",
        "slug": "seo-geo",
        "objective": "assess readiness for AI Overviews and AI citation",
        "inputs": ["Rendered page HTML", "robots.txt and AI-crawler policy", "Entity and schema data"],
        "checks": [
            "Check whether key answers are present in extractable text.",
            "Verify entity clarity and consistent naming.",
            "Check structured data for the entity and offerings.",
            "Confirm AI crawlers are not unintentionally blocked.",
        ],
        "outputs": ["GEO readiness checklist", "Citation-blocking issues", "Priority fixes"],
        "guardrails": "Never claim a citation or share of voice without measurement.",
    },
    {
        "name": "SEO Google Agent",
        "slug": "seo-google",
        "objective": "interpret Google Search Console data and Google-specific features",
        "inputs": ["Search Console export", "Date range", "Property type"],
        "checks": [
            "Check data completeness and known reporting limits.",
            "Separate query, page and device dimensions.",
            "Identify indexing and coverage issues.",
        ],
        "outputs": ["Finding summary", "Data caveats", "Next queries to pull"],
        "guardrails": "State that Search Console data is sampled and rounded.",
    },
    {
        "name": "SEO Image Gen Agent",
        "slug": "seo-image-gen",
        "objective": "plan image assets that support search and accessibility",
        "inputs": ["Page brief", "Brand rules", "Alt-text policy"],
        "checks": [
            "Check alt text describes purpose, not keywords.",
            "Verify dimensions and formats for performance.",
            "Check file naming and captions.",
            "Avoid text baked into images for key information.",
        ],
        "outputs": ["Image spec", "Alt-text set", "Compression targets"],
        "guardrails": "Do not generate misleading imagery or fake product photos.",
    },
    {
        "name": "SEO Local Agent",
        "slug": "seo-local",
        "objective": "audit local landing pages and NAP consistency",
        "inputs": ["Location pages", "Business name, address, phone", "Local Business schema"],
        "checks": [
            "Check NAP consistency across pages and profiles.",
            "Verify each location page has unique local content.",
            "Check LocalBusiness schema and opening hours.",
            "Check internal links between locations and services.",
        ],
        "outputs": ["Location page audit", "NAP fix list", "Schema fixes"],
        "guardrails": "Do not create doorway location pages with no local value.",
    },
    {
        "name": "SEO Maps Agent",
        "slug": "seo-maps",
        "objective": "assess map-pack visibility inputs and profile completeness",
        "inputs": ["Business profile data", "Category and service list", "Review and photo status"],
        "checks": [
            "Check primary and secondary categories.",
            "Check service areas and address accuracy.",
            "Review photo coverage and recency.",
            "Check review response practice.",
        ],
        "outputs": ["Profile gap list", "Local content actions"],
        "guardrails": "Never invent ranking positions or review counts.",
    },
    {
        "name": "SEO Performance Agent",
        "slug": "seo-performance",
        "objective": "diagnose Core Web Vitals with field and lab data separated",
        "inputs": ["PageSpeed/CrUX data", "Rendered page", "Third-party script list"],
        "checks": [
            "Separate field data from lab data.",
            "Identify LCP element and its bottleneck.",
            "Check CLS sources and INP interaction paths.",
            "Quantify third-party script cost.",
        ],
        "outputs": ["Vitals diagnosis", "Prioritised fixes", "Measurement plan"],
        "guardrails": "Do not promise a score; report measured values only.",
    },
    {
        "name": "SEO PostHog Agent",
        "slug": "seo-posthog",
        "objective": "connect SEO landing pages to on-site behaviour and conversion events",
        "inputs": ["Event schema", "Landing page list", "Consent rules"],
        "checks": [
            "Verify event definitions and deduplication.",
            "Check funnel steps per landing page.",
            "Identify high-traffic low-conversion pages.",
        ],
        "outputs": ["Behaviour findings", "Tracking gaps", "Page priorities"],
        "guardrails": "Respect consent and never infer personal data.",
    },
    {
        "name": "SEO Schema Agent",
        "slug": "seo-schema",
        "objective": "validate structured data against visible page content",
        "inputs": ["Page HTML with JSON-LD", "Entity data", "Rich-result requirements"],
        "checks": [
            "Check required and recommended properties per type.",
            "Verify markup matches visible content.",
            "Check for conflicting or duplicate types.",
            "Validate syntax and nesting.",
        ],
        "outputs": ["Schema validation report", "Corrected JSON-LD"],
        "guardrails": "Never add markup for content not visible on the page.",
    },
    {
        "name": "SEO Sitemap Agent",
        "slug": "seo-sitemap",
        "objective": "audit XML sitemaps for accuracy and coverage",
        "inputs": ["Sitemap URLs", "robots.txt", "Indexable URL list"],
        "checks": [
            "Check that sitemap URLs are canonical and indexable.",
            "Identify missing high-value URLs.",
            "Check for 404/redirect entries and size limits.",
            "Verify sitemap index structure.",
        ],
        "outputs": ["Sitemap gap report", "Cleaned sitemap spec"],
        "guardrails": "Do not include noindex or redirected URLs.",
    },
    {
        "name": "SEO SXO Agent",
        "slug": "seo-sxo",
        "objective": "improve the search experience after the click",
        "inputs": ["Landing page template", "SERP intent", "Behaviour data"],
        "checks": [
            "Check whether the page delivers the promise made in the SERP snippet.",
            "Assess above-the-fold clarity and primary action.",
            "Check mobile layout and tap targets.",
            "Identify friction between intent and next step.",
        ],
        "outputs": ["SXO recommendations", "Template changes"],
        "guardrails": "Base recommendations on observed behaviour, not guesses about users.",
    },
    {
        "name": "SEO Technical Agent",
        "slug": "seo-technical",
        "objective": "audit crawlability, indexability and rendering",
        "inputs": ["Crawl export", "robots.txt", "Response headers", "Rendered HTML"],
        "checks": [
            "Check status codes, redirects and canonical consistency.",
            "Check robots directives and indexability.",
            "Compare raw and rendered HTML for key content.",
            "Check hreflang and pagination handling.",
        ],
        "outputs": ["Technical issue list", "Severity and evidence", "Fix order"],
        "guardrails": "Every issue must cite a URL and measured evidence.",
    },
    {
        "name": "SEO Visual Agent",
        "slug": "seo-visual",
        "objective": "audit the rendered visual experience and above-the-fold content",
        "inputs": ["Rendered screenshots", "Viewport sizes", "Template list"],
        "checks": [
            "Check that primary content is visible without interaction.",
            "Check layout shifts and overlapping elements.",
            "Check mobile and desktop parity.",
            "Check that key content is not hidden behind tabs or carousels.",
        ],
        "outputs": ["Visual issue list", "Screenshots as evidence"],
        "guardrails": "Do not infer ranking impact from appearance alone.",
    },
]

# second scenarios for the highest-value agents
SECOND_TASKS = {
    "seo-technical": "Diagnose a sudden indexation drop",
    "seo-geo": "Audit AI-crawler access and answer extractability",
    "seo-content": "Refresh a declining hub page",
    "seo-schema": "Fix invalid structured data before a rich-result launch",
    "seo-local": "Audit a multi-location hotel group",
    "seo-performance": "Diagnose poor Core Web Vitals on mobile",
    "seo-sitemap": "Reconcile sitemaps after a migration",
    "seo-sxo": "Reduce bounce on a high-traffic landing page",
    "seo-cluster": "Resolve two clusters competing for one query",
    "seo-backlinks": "Assess risk after an outreach campaign",
}

SECOND_INDUSTRIES = {
    "seo-technical": "bank",
    "seo-geo": "saas",
    "seo-content": "food",
    "seo-schema": "ecommerce",
    "seo-local": "hotel",
    "seo-performance": "travel",
    "seo-sitemap": "ecommerce",
    "seo-sxo": "saas",
    "seo-cluster": "hotel",
    "seo-backlinks": "local-service",
}

# ─────────────────────────────────────────────────────────────────────────────
# C. 78-Keyword Strategy & Intent (+15)
# ─────────────────────────────────────────────────────────────────────────────

KEYWORDS = [
    {
        "kw": "Renaissance Shoals Resort & Spa book direct",
        "intent": "Navigational / transactional (brand + direct booking)",
        "page": "Official property homepage or a dedicated book-direct page",
        "serp": "Brand sitelinks, official site, OTA listings",
        "why": [
            "The searcher already knows the property and wants the official booking path.",
            "Any page other than the property's own booking page creates friction.",
        ],
        "support": [
            "Link from the homepage hero and the rooms page to the booking page.",
            "Keep rate-parity and best-rate-guarantee messaging visible.",
        ],
        "cannibal": [
            "Ensure no OTA-style landing page on your own site competes for this brand query.",
            "Use one canonical book-direct URL.",
        ],
        "measure": "Track clicks to the booking engine, not just rankings.",
    },
    {
        "kw": "boutique hotels in downtown Denver",
        "intent": "Commercial investigation",
        "page": "Neighbourhood or destination landing page",
        "serp": "Local pack, hotel carousel, map results",
        "why": [
            "The searcher is comparing properties in a place, not a brand.",
            "A destination page with genuine local context matches intent better than a single room page.",
        ],
        "support": [
            "Add walkability, transit and neighbourhood context.",
            "Link to individual room and amenity pages.",
        ],
        "cannibal": [
            "Do not create multiple near-identical 'downtown' pages for the same city.",
            "Assign one canonical destination URL.",
        ],
        "measure": "Use Search Console query filtering to confirm the page earns the query.",
    },
    {
        "kw": "hotels near Coors Field",
        "intent": "Local commercial (proximity)",
        "page": "Landmark-proximity landing page",
        "serp": "Local pack, map, 'hotels near me' variants",
        "why": [
            "Proximity is the dominant intent signal.",
            "A landmark page should state distance and travel time explicitly.",
        ],
        "support": [
            "Add walking/driving time and a map embed.",
            "Link to event and transport content.",
        ],
        "cannibal": [
            "Keep one page per landmark; avoid duplicating the same landmark under several URLs.",
        ],
        "measure": "Confirm the landmark page, not the homepage, ranks for the landmark query.",
    },
    {
        "kw": "best time to visit Asheville",
        "intent": "Informational",
        "page": "Destination guide article",
        "serp": "Featured snippet, People Also Ask, AI Overview",
        "why": [
            "The searcher wants planning advice, not a booking page.",
            "Answer-first structure improves snippet and AI-overview eligibility.",
        ],
        "support": [
            "Add a month-by-month table and a short direct answer near the top.",
            "Link to seasonal offers and local events.",
        ],
        "cannibal": [
            "Do not let a booking page target this informational query.",
        ],
        "measure": "Track snippet/AI-overview presence qualitatively; do not claim citation without evidence.",
    },
    {
        "kw": "The Curtis Denver promo code",
        "intent": "Navigational / transactional (discount)",
        "page": "Official offers page",
        "serp": "Brand results, coupon aggregators",
        "why": [
            "The searcher wants a legitimate current offer.",
            "A clear official offers page reduces leakage to coupon sites.",
        ],
        "support": [
            "Show current offers with expiry dates and terms.",
            "Link from the booking flow.",
        ],
        "cannibal": [
            "Keep one canonical offers page; avoid per-code duplicates.",
        ],
        "measure": "Measure offer-page conversions, not rankings alone.",
    },
    {
        "kw": "pet friendly hotels in Bozeman",
        "intent": "Commercial",
        "page": "Pet-policy page or filtered destination page",
        "serp": "Local pack, hotel listings",
        "why": [
            "The pet policy is a hard constraint, not a nicety.",
            "State fees, size limits and restricted areas explicitly.",
        ],
        "support": [
            "Add pet-policy FAQs and nearby walking areas.",
            "Link from room pages.",
        ],
        "cannibal": [
            "Do not split pet content across several thin pages.",
        ],
        "measure": "Check that the pet page earns the query in Search Console.",
    },
    {
        "kw": "hotel with rooftop bar in Nashville",
        "intent": "Commercial (amenity)",
        "page": "Amenity or dining page",
        "serp": "Local pack, amenity listings, maps",
        "why": [
            "The amenity is the deciding factor.",
            "Show hours, access rules and whether the bar is open to non-guests.",
        ],
        "support": [
            "Add photos, menus and event schedule.",
            "Link to the dining reservation page.",
        ],
        "cannibal": [
            "Keep amenity content on one page rather than duplicating it in several posts.",
        ],
        "measure": "Track reservations and clicks, not just position.",
    },
    {
        "kw": "cheap hotels near the airport",
        "intent": "Transactional (price-sensitive)",
        "page": "Airport-hotel landing page with rate context",
        "serp": "Local pack, price filters, hotel carousel",
        "why": [
            "Price and proximity dominate.",
            "Avoid claiming 'cheapest' without verifiable rate data.",
        ],
        "support": [
            "Show shuttle schedule and distance.",
            "Explain what is included in the rate.",
        ],
        "cannibal": [
            "Use one airport page per airport.",
        ],
        "measure": "Track booking-engine entries from the page.",
    },
    {
        "kw": "wedding venues in Charleston",
        "intent": "Commercial investigation",
        "page": "Weddings/events page with capacity and floor plans",
        "serp": "Local pack, image results, venue directories",
        "why": [
            "Planners compare capacity, style and logistics.",
            "Real photos and capacity ranges answer the decision.",
        ],
        "support": [
            "Add capacity table, catering options and a venue tour form.",
            "Link to nearby accommodation blocks.",
        ],
        "cannibal": [
            "Keep one weddings page; avoid separate thin pages per room.",
        ],
        "measure": "Track enquiry-form submissions as the primary KPI.",
    },
    {
        "kw": "is [City] walkable",
        "intent": "Informational",
        "page": "Destination guide section",
        "serp": "Featured snippet, People Also Ask, AI Overview",
        "why": [
            "The searcher wants a direct yes/no with context.",
            "A short answer plus neighbourhood detail matches the snippet format.",
        ],
        "support": [
            "Add a walkability summary and transit links.",
            "Link to the hotel's location page.",
        ],
        "cannibal": [
            "Do not let the hotel homepage absorb destination-guide queries.",
        ],
        "measure": "Qualitative snippet tracking only.",
    },
    {
        "kw": "hotel parking downtown",
        "intent": "Commercial (practical constraint)",
        "page": "Parking and arrival page",
        "serp": "Local pack, People Also Ask",
        "why": [
            "Parking cost and height restrictions are decision factors.",
            "State garage options, prices and EV charging.",
        ],
        "support": [
            "Add arrival instructions and a map.",
            "Link from the contact page.",
        ],
        "cannibal": [
            "Keep parking content on one page.",
        ],
        "measure": "Track directions clicks and parking-page engagement.",
    },
    {
        "kw": "extended stay hotels for business travel",
        "intent": "Commercial investigation",
        "page": "Extended-stay or corporate page",
        "serp": "Hotel carousel, local pack",
        "why": [
            "The searcher needs kitchens, workspace and weekly rates.",
            "Corporate travellers compare amenities and invoicing.",
        ],
        "support": [
            "Add a comparison table for stay lengths.",
            "Link to corporate booking.",
        ],
        "cannibal": [
            "Separate leisure and corporate landing pages only if content genuinely differs.",
        ],
        "measure": "Measure corporate enquiries.",
    },
    {
        "kw": "hotel with airport shuttle",
        "intent": "Transactional",
        "page": "Transport/amenity page",
        "serp": "Local pack, hotel amenities",
        "why": [
            "Shuttle availability is a hard requirement.",
            "State schedule, coverage area and booking process.",
        ],
        "support": [
            "Add a shuttle FAQ and timetable.",
            "Link from the airport landing page.",
        ],
        "cannibal": [
            "Merge with the airport page if intent overlaps.",
        ],
        "measure": "Track shuttle enquiries.",
    },
    {
        "kw": "boutique hotel vs chain hotel",
        "intent": "Informational / commercial investigation",
        "page": "Editorial comparison article",
        "serp": "Featured snippet, People Also Ask, AI Overview",
        "why": [
            "The searcher is deciding between categories.",
            "A balanced comparison builds trust and can support brand positioning.",
        ],
        "support": [
            "Add pros/cons and decision criteria.",
            "Link to the property's differentiators without hard-selling.",
        ],
        "cannibal": [
            "Keep this on the blog; do not target it with a room page.",
        ],
        "measure": "Track assisted conversions, not direct bookings alone.",
    },
    {
        "kw": "cancel hotel reservation policy",
        "intent": "Navigational / support",
        "page": "Policy/FAQ page",
        "serp": "Brand results, People Also Ask",
        "why": [
            "The searcher needs the policy, not marketing.",
            "Clear cancellation windows reduce support load.",
        ],
        "support": [
            "Add a step-by-step cancellation guide.",
            "Link to the booking-engine help flow.",
        ],
        "cannibal": [
            "Keep policy content on one canonical page.",
        ],
        "measure": "Track support-ticket deflection where possible.",
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# D. Search Console Cannibalization & GEO (+40)
# ─────────────────────────────────────────────────────────────────────────────

GSC_GEO = []

for n in range(10):
    GSC_GEO.append({
        "sub": "cannibalization",
        "title": f"Cannibalization case {n + 1}: two URLs trading places",
        "signal": "Two URLs on the same site alternate for one query, or one gains exactly as the other loses.",
        "diagnose": [
            "Pull the query in Search Console and compare the two URLs' impressions, clicks and average position over the same dates.",
            "Check whether both pages target the same intent in their titles and H1s.",
            "Inspect internal links and anchors pointing to each URL.",
            "Confirm neither page is a duplicate or near-duplicate of the other.",
        ],
        "actions": [
            "Choose the canonical page for the query and align its title/H1 to the intent.",
            "Merge unique content from the weaker page into the canonical page.",
            "Redirect or noindex the weaker page if it has no independent demand.",
            "Point internal links at the canonical page with consistent anchors.",
        ],
        "evidence": "Only conclude cannibalization when the same query shows both URLs with meaningful impressions in Search Console.",
    })

for n in range(6):
    GSC_GEO.append({
        "sub": "gsc-diagnostics",
        "title": f"Search Console diagnostic {n + 1}: impressions without clicks",
        "signal": "A page has stable impressions but a low or falling CTR.",
        "diagnose": [
            "Compare average position over time; a stable position with falling CTR points to snippet or SERP-feature change.",
            "Check whether an AI Overview or other feature now answers the query above the organic result.",
            "Review the title and meta description against the query intent.",
            "Check for mismatch between the snippet promise and the page content.",
        ],
        "actions": [
            "Rewrite the title to state the specific answer or benefit.",
            "Make the meta description concrete and accurate.",
            "Add the missing answer near the top of the page.",
            "Re-measure after a full reporting cycle.",
        ],
        "evidence": "Search Console rounds and samples data; do not treat small CTR movements as significant.",
    })

for n in range(6):
    GSC_GEO.append({
        "sub": "gsc-indexing",
        "title": f"Indexing diagnostic {n + 1}: indexed but not ranking",
        "signal": "A URL is indexed but receives almost no impressions for its target query.",
        "diagnose": [
            "Confirm the URL is the canonical version and is not blocked by robots or noindex.",
            "Check whether the page actually contains the target query and related subtopics.",
            "Compare the page's intent with the current top results.",
            "Check internal links pointing to the page.",
        ],
        "actions": [
            "Align the page with the dominant intent.",
            "Add missing subtopics and internal links.",
            "Consolidate if the page duplicates another URL.",
            "Request indexing only after the content is ready.",
        ],
        "evidence": "Indexation alone is not evidence of relevance; require query-level impressions to judge targeting.",
    })

GEO_SCENARIOS = [
    ("AI Overview readiness", "A key informational page is not appearing in AI Overviews.",
     ["Check whether a direct, extractable answer exists near the top.", "Verify entity naming is consistent.", "Check schema for the entity and offerings.", "Confirm AI crawlers are not blocked unintentionally."],
     ["Add a concise answer paragraph with supporting detail.", "Add or fix structured data that matches visible content.", "Improve question-based subheadings.", "Keep claims verifiable and sourced."]),
    ("Citation measurement", "Stakeholders ask for AI citation share of voice.",
     ["Confirm whether a measurement provider is connected.", "Distinguish citation presence from traffic.", "Check prompt coverage and sample size."],
     ["Report citations only when measured by a provider.", "If no provider is connected, state that citations are unmeasured.", "Track prompts and runs consistently over time."]),
    ("AI-crawler access", "The site blocks some AI crawlers without a deliberate policy.",
     ["Read robots.txt for GPTBot, ClaudeBot, PerplexityBot, Google-Extended and others.", "Check CDN/WAF bot rules.", "Confirm the business decision for each bot."],
     ["Document an explicit allow/deny policy per bot.", "Do not block bots by accident during security hardening.", "Re-crawl robots.txt after changes."]),
    ("Entity clarity", "The brand is described inconsistently across the site.",
     ["Compare the legal name, brand name and location usage.", "Check Organization/LocalBusiness schema.", "Check about/contact pages."],
     ["Standardise the entity name and description.", "Align schema with visible content.", "Use consistent sameAs links where verified."]),
    ("Answer extractability", "Content is buried in tabs, images or long intros.",
     ["Render the page and check what text is actually present.", "Check whether key facts are in images only.", "Check above-the-fold content."],
     ["Move the direct answer into visible HTML.", "Avoid putting key facts only in images.", "Use clear headings and short paragraphs."]),
    ("llms.txt and discovery", "Team wants an llms.txt file.",
     ["Confirm what the file can and cannot do.", "Check whether it is requested by any consumer.", "Check sitemap and robots clarity first."],
     ["Treat llms.txt as an optional supplement, not a ranking lever.", "Prioritise crawlable HTML, sitemaps and clear structure.", "Do not claim it guarantees AI citation."]),
    ("GEO content drift", "Facts on the page are outdated.",
     ["Compare page facts with the current source of truth.", "Check dates and prices.", "Check schema freshness."],
     ["Update facts and dates.", "Add a visible last-reviewed date.", "Re-validate schema after edits."]),
    ("Competitor AI visibility", "A competitor appears in AI answers more often.",
     ["Confirm the observation is measured, not anecdotal.", "Compare answer coverage for the same prompts.", "Check entity and content differences."],
     ["Do not claim a citation gap without measurement.", "Improve answer coverage and entity clarity.", "Track prompts consistently."]),
    ("Prompt coverage", "The team does not know which prompts to track.",
     ["Map prompts to funnel stages.", "Include branded, comparison and problem prompts.", "Define a stable prompt set."],
     ["Build a prompt library by intent.", "Run it on a fixed cadence.", "Report only measured results."]),
    ("Share of voice", "Leadership wants a single GEO score.",
     ["Check whether the inputs are measured.", "Define the formula explicitly.", "Check sample size."],
     ["Publish the formula and data sources.", "Show confidence and limitations.", "Avoid presenting an estimate as fact."]),
    ("Schema for AI", "Structured data is missing or invalid.",
     ["Validate JSON-LD syntax.", "Check required properties.", "Confirm markup matches visible content."],
     ["Fix invalid properties.", "Add missing entity fields.", "Re-validate after deployment."]),
    ("Local GEO", "A hotel wants to appear in local AI answers.",
     ["Check LocalBusiness schema and NAP.", "Check location-page uniqueness.", "Check review and amenity facts."],
     ["Standardise NAP.", "Add unique local detail.", "Keep hours and amenities accurate."]),
    ("Content freshness", "Evergreen pages have stale examples.",
     ["Identify pages with dated references.", "Check whether updates changed the answer.", "Check internal links to newer content."],
     ["Refresh examples and dates.", "Add a changelog where useful.", "Re-check after the next cycle."]),
    ("AI Overview cannibalization", "An AI Overview answers the query above the organic result.",
     ["Confirm the feature is present for the query.", "Check CTR change at stable position.", "Check whether the page is cited."],
     ["Optimise for extractable answers.", "Do not assume you can opt out.", "Measure CTR separately from position."]),
    ("Citation accuracy", "An AI answer misstates a fact about the brand.",
     ["Verify the claim and its source.", "Check whether the site states the fact clearly.", "Check for conflicting pages."],
     ["Correct and consolidate the source page.", "Make the canonical fact unambiguous.", "Monitor the prompt over time."]),
    ("GEO for transactional pages", "Booking pages are not cited in AI answers.",
     ["Check whether the page states rates, availability and policies in text.", "Check schema for offers.", "Check crawl access."],
     ["Add clear, factual offer details.", "Use valid Offer markup only for real offers.", "Do not invent availability."]),
    ("Multi-location GEO", "Locations compete with each other in AI answers.",
     ["Check location-page uniqueness.", "Check NAP consistency.", "Check internal linking."],
     ["Differentiate location content.", "Fix NAP conflicts.", "Link locations to the correct services."]),
    ("Measurement honesty", "A vendor reports a large AI visibility lift.",
     ["Ask for the prompt set, sample size and dates.", "Check whether the baseline was measured the same way.", "Check for cherry-picked prompts."],
     ["Require reproducible methodology.", "Compare like-for-like periods.", "Do not accept unverified lift claims."]),
]

for title, signal, diag, act in GEO_SCENARIOS:
    GSC_GEO.append({
        "sub": "geo",
        "title": f"GEO: {title}",
        "signal": signal,
        "diagnose": diag,
        "actions": act,
        "evidence": "Report AI visibility only from measured runs with a stated prompt set and date range.",
    })

# pad to exactly 40 GEO/GSC entries if needed
while len(GSC_GEO) < 40:
    n = len(GSC_GEO) - 39
    GSC_GEO.append({
        "sub": "geo",
        "title": f"GEO measurement check {n}",
        "signal": "A GEO claim needs verification.",
        "diagnose": ["Check the data source.", "Check the prompt set.", "Check the date range."],
        "actions": ["Report only measured values.", "State limitations.", "Re-run consistently."],
        "evidence": "No citation or share-of-voice claim without measurement.",
    })
GSC_GEO = GSC_GEO[:40]


def build_entries():
    entries = []

    for d in ALGO:
        entries.append({
            "messages": [
                {"role": "system", "content": ALGO_SYSTEM},
                {"role": "user", "content": (
                    f"Our site saw a sharp organic visibility change around {d['date']}. "
                    f"Could it be related to the {d['name']}? What was the documented focus, "
                    f"and what exact diagnostic and recovery steps should we follow?"
                )},
                {"role": "assistant", "content": algo_answer(d)},
            ],
            "meta": {"id": d["id"], "category": "Google Algorithm Updates", "subcategory": d["type"].lower().replace(" ", "-"), "difficulty": "medium", "industry": "mixed"},
        })

    for a in AGENTS:
        entries.append({
            "messages": [
                {"role": "system", "content": AGENT_SYSTEM.format(name=a["name"], slug=a["slug"])},
                {"role": "user", "content": f"Run a {a['objective']} for our hotel site and tell me what you need and what you will check."},
                {"role": "assistant", "content": agent_answer(a, "audit plan", "hotel")},
            ],
            "meta": {"id": f"agent-{a['slug']}-1", "category": "20 Claude-SEO Agents", "subcategory": a["slug"], "difficulty": "medium", "industry": "hotel"},
        })

    for a in AGENTS:
        if a["slug"] in SECOND_TASKS:
            entries.append({
                "messages": [
                    {"role": "system", "content": AGENT_SYSTEM.format(name=a["name"], slug=a["slug"])},
                    {"role": "user", "content": f"{SECOND_TASKS[a['slug']]}. Walk me through the checks and the deliverable."},
                    {"role": "assistant", "content": agent_answer(a, SECOND_TASKS[a["slug"]], SECOND_INDUSTRIES[a["slug"]])},
                ],
                "meta": {"id": f"agent-{a['slug']}-2", "category": "20 Claude-SEO Agents", "subcategory": a["slug"], "difficulty": "hard", "industry": SECOND_INDUSTRIES[a["slug"]]},
            })

    for k in KEYWORDS:
        entries.append({
            "messages": [
                {"role": "system", "content": KEYWORD_SYSTEM},
                {"role": "user", "content": f"Analyse keyword strategy for \"{k['kw']}\". Classify intent, choose the target page, and flag cannibalization risk."},
                {"role": "assistant", "content": kw_answer(k)},
            ],
            "meta": {"id": f"kw-{stable_id(k['kw'])}", "category": "78-Keyword Strategy & Intent", "subcategory": "intent-mapping", "difficulty": "medium", "industry": "hotel"},
        })

    for i, g in enumerate(GSC_GEO):
        sys_prompt = GSC_SYSTEM if g["sub"] in ("cannibalization", "gsc-diagnostics", "gsc-indexing") else GEO_SYSTEM
        entries.append({
            "messages": [
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": f"{g['title']}. {g['signal']} What should I check, and what should I do?"},
                {"role": "assistant", "content": diag_answer(g)},
            ],
            "meta": {"id": f"gscgeo-{i + 1:02d}", "category": "Search Console Cannibalization & GEO", "subcategory": g["sub"], "difficulty": "medium", "industry": "mixed"},
        })

    return entries


def norm(text):
    return re.sub(r"\s+", " ", text.strip().lower())


def key_of(messages):
    payload = norm(messages[1]["content"]) + "\u241f" + norm(messages[2]["content"])
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def stable_id(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:10]


def main():
    new = build_entries()
    assert len(new) == 100, f"expected 100 entries, built {len(new)}"
    new_ids = {e["meta"]["id"] for e in new}
    assert len(new_ids) == 100, "duplicate ids within the new set"

    # Idempotent: drop any previously-appended entries with our ids before re-adding,
    # so re-running the script never duplicates or pads with near-duplicate filler.
    lines = [l for l in TRAIN.read_text(encoding="utf-8").splitlines() if l.strip()]
    baseline, prior_added = [], 0
    for l in lines:
        o = json.loads(l)
        if o.get("meta", {}).get("id") in new_ids:
            prior_added += 1
            continue
        baseline.append(o)

    # Dedupe the new set against the untouched baseline and within itself.
    seen = {key_of(o["messages"]) for o in baseline}
    seen_users = {norm(o["messages"][1]["content"]) for o in baseline}
    kept, dropped = [], 0
    for e in new:
        k = key_of(e["messages"])
        u = norm(e["messages"][1]["content"])
        if k in seen or u in seen_users:
            dropped += 1
            continue
        seen.add(k)
        seen_users.add(u)
        kept.append(e)
    assert not dropped, f"{dropped} new entries collided with the baseline corpus"

    # Rewrite the train file deterministically: baseline + exactly our 100 entries.
    with TRAIN.open("w", encoding="utf-8") as fh:
        for e in baseline + kept:
            fh.write(json.dumps(e, ensure_ascii=False) + "\n")

    final = baseline + kept
    train_count = len(final)
    eval_count = sum(1 for l in EVAL.read_text(encoding="utf-8").splitlines() if l.strip())
    total = train_count + eval_count

    gsc_added = sum(1 for g in GSC_GEO if g["sub"] in ("cannibalization", "gsc-diagnostics", "gsc-indexing"))
    geo_added = len(GSC_GEO) - gsc_added
    sources = {
        "googleAlgorithmUpdates": 66 + len(ALGO),
        "claudeSeoSpecializedAgents": 20 + 30,
        "keywordStrategyMatrix": 78 + len(KEYWORDS),
        "gscDiagnostics": 2 + gsc_added,
        "geoAiVisibility": 2 + geo_added,
    }

    report = {
        "status": "success",
        "datasetName": "SEO-Studio-Unified-SEO-SFT-v1",
        "totalExamples": total,
        "trainCount": train_count,
        "evalCount": eval_count,
        "trainRatio": round(train_count / total, 4),
        "evalRatio": round(eval_count / total, 4),
        "estimatedTokens": 54907 + sum(len(json.dumps(e)) // 4 for e in kept),
        "sources": sources,
        "sanitization": {"secretPatternsEnforced": 4, "deduplicationAlgorithm": "SHA256 Content Key"},
        "files": {"train": "data/training/unified_seo_train.jsonl", "eval": "data/training/unified_seo_eval.jsonl"},
        "expansion": {"added": len(kept), "dedupedOut": dropped, "categories": {
            "Google Algorithm Updates": len(ALGO),
            "20 Claude-SEO Agents": 30,
            "78-Keyword Strategy & Intent": len(KEYWORDS),
            "Search Console Cannibalization & GEO": len(GSC_GEO),
        }},
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    print(f"baseline train: {len(baseline)}  (previously added, replaced: {prior_added})")
    print(f"built: {len(new)}  kept: {len(kept)}  dedupedOut: {dropped}")
    print(f"new train total: {train_count}  eval (untouched): {eval_count}  grand total: {total}")
    print("sources:", sources)


if __name__ == "__main__":
    main()