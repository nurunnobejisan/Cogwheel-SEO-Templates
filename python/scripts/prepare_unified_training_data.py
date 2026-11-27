#!/usr/bin/env python3
"""SEO Studio Unified SEO Platform - Training Data Preparation Pipeline.

Synthesizes knowledge from:
1. Google Algorithm Updates dataset (`data/google-updates.json` from claude-seo)
2. 20 Specialized SEO Agent prompts (`src/core/claude-seo/agents/`)
3. Open-SEO Audit Issues Catalog & AI Visibility (`src/core/open-seo/`)
4. GSC FastMCP Tools & Cannibalization / Inspection logic (`src/core/gsc/`)
5. SEO Studio 78-Keyword Matrix & OTA Direct Booking Guardrails (`data/`)

Generates structured SFT (Supervised Fine-Tuning) datasets in standard OpenAI / Gemini
chat format:
{"messages": [{"role": "system", ...}, {"role": "user", ...}, {"role": "assistant", ...}]}

Splits deterministically into:
- `data/training/unified_seo_train.jsonl` (80%)
- `data/training/unified_seo_eval.jsonl` (20%)
And produces a detailed `data/training/dataset_quality_report.json`.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
TRAINING_DIR = DATA_DIR / "training"
AGENTS_DIR = PROJECT_ROOT / "src" / "core" / "claude-seo" / "agents"

# Regex patterns for safety sanitization
SECRET_PATTERNS = [
    re.compile(r"sk-[a-zA-Z0-9]{20,}", re.IGNORECASE),
    re.compile(r"AIzaSy[a-zA-Z0-9_-]{33}", re.IGNORECASE),
    re.compile(r"(?:bearer\s+[a-zA-Z0-9._-]{20,})", re.IGNORECASE),
    re.compile(r"(?:private_key.*?:.*?-----BEGIN)", re.IGNORECASE),
]


def sanitize_text(text: str) -> str:
    """Scrub sensitive credentials, tokens or API keys."""
    cleaned = text
    for pat in SECRET_PATTERNS:
        cleaned = pat.sub("[REDACTED_SECRET]", cleaned)
    return cleaned.strip()


def estimate_tokens(text: str) -> int:
    """Rough word-to-token count ratio approximation."""
    return max(1, int(len(text) / 3.8))


def make_sft_example(system_prompt: str, user_prompt: str, assistant_response: str) -> dict[str, Any]:
    """Build canonical chat message structure."""
    return {
        "messages": [
            {"role": "system", "content": sanitize_text(system_prompt)},
            {"role": "user", "content": sanitize_text(user_prompt)},
            {"role": "assistant", "content": sanitize_text(assistant_response)},
        ]
    }


def generate_google_update_examples(updates_path: Path) -> list[dict[str, Any]]:
    """Generate training pairs based on Google algorithm updates history."""
    examples: list[dict[str, Any]] = []
    if not updates_path.is_file():
        return examples

    with open(updates_path, encoding="utf-8") as f:
        data = json.load(f)

    updates_list = data.get("updates", []) if isinstance(data, dict) else data

    system_prompt = (
        "You are SEO Studio's Principal Search Algorithm & Recovery Specialist. "
        "Analyze Google core algorithm updates, helpful content systems, spam policies, and "
        "technical volatility to provide precise diagnostic and recovery actions."
    )

    for item in updates_list:
        if not isinstance(item, dict):
            continue
        name = item.get("name", "Google Update")
        date = item.get("date", "Unknown Date")
        kind = item.get("kind", "core")
        notes = item.get("notes", "Update affecting organic search ranking algorithms.")
        source = item.get("source", "https://developers.google.com/search/updates")

        user_prompt = (
            f"Our website experienced significant organic search traffic fluctuation around {date}. "
            f"Could this be related to the '{name}' ({kind}) update? "
            f"What was the focus of this update and what are the exact remediation steps?"
        )

        assistant_response = (
            f"### Analysis: {name} ({date})\n\n"
            f"**Classification:** {kind.upper()}\n"
            f"**Official Source:** {source}\n\n"
            f"**Documented Impact & Notes:**\n{notes}\n\n"
            f"**Diagnostic & Recovery Steps:**\n"
            f"1. **Audit Content Helpfulness:** Identify pages that lost impressions; verify if content satisfies primary user intent without clickbait.\n"
            f"2. **E-E-A-T & Author Verification:** Verify author credentials, citations, and editorial transparency.\n"
            f"3. **Technical Hygiene:** Check Core Web Vitals, mobile usability, and ensure no spam policy violations.\n"
            f"4. **Monitoring:** Compare GSC search performance across 28-day pre- and post-rollout periods."
        )

        examples.append(make_sft_example(system_prompt, user_prompt, assistant_response))

    return examples


def generate_agent_prompt_examples(agents_dir: Path) -> list[dict[str, Any]]:
    """Convert specialized Claude-SEO agent markdown prompts into instruction tuning pairs."""
    examples: list[dict[str, Any]] = []
    if not agents_dir.is_dir():
        return examples

    agent_files = sorted(agents_dir.glob("*.md"))
    for file_path in agent_files:
        content = file_path.read_text(encoding="utf-8")
        agent_name = file_path.stem.replace("-", " ").title()

        system_prompt = (
            f"You are the {agent_name} Agent in the SEO Studio Unified SEO Platform. "
            f"Operate under the following domain specification:\n\n{content[:800]}"
        )

        user_prompt = f"Run a specialized {agent_name} audit on our website URL and outline critical check criteria."
        assistant_response = (
            f"### {agent_name} Diagnostic Framework\n\n"
            f"As the {agent_name} Agent, I evaluate:\n"
            f"1. **Core Compliance**: Checking standards against official Google Search Central guidelines.\n"
            f"2. **Critical Failure Modes**: Detecting blocking directives, erroneous canonicals, or broken assets.\n"
            f"3. **Optimization Potential**: Producing actionable, prioritized recommendations with estimated impact.\n\n"
            f"To inspect your target URL, submit the page URL or provide the DOM snapshot."
        )

        examples.append(make_sft_example(system_prompt, user_prompt, assistant_response))

    return examples


def generate_keyword_strategy_examples(matrix_path: Path) -> list[dict[str, Any]]:
    """Convert 78-keyword strategy matrix into keyword intent and SERP targeting pairs."""
    examples: list[dict[str, Any]] = []
    if not matrix_path.is_file():
        return examples

    with open(matrix_path, encoding="utf-8") as f:
        data = json.load(f)

    keywords = data.get("keywords", []) if isinstance(data, dict) else data
    system_prompt = (
        "You are SEO Studio's Senior SERP Strategist and Keyword Optimization Specialist. "
        "Provide search volume, search intent classification, competition level, and target meta/heading optimization."
    )

    for item in keywords:
        if not isinstance(item, dict):
            continue
        kw = item.get("keyword", "")
        category = item.get("category", "Brand/Direct Booking")
        sub_cat = item.get("subCategory", "Brand Strategy")
        intent = item.get("searchIntent", "Commercial")
        vol_tier = item.get("searchVolumeTier", "Medium")
        cpc_info = item.get("cpcEstimate") or {}
        cpc_value = cpc_info.get("value", "n/a")
        cpc_source = cpc_info.get("source", "unlabelled")
        target_page = item.get("targetPageType", "Homepage")
        recommended_schema = item.get("recommendedSchema", "Hotel")
        entity_prompt = item.get("targetEntityPrompt", "")
        comp_context = item.get("competitiveContext", "")

        if not kw:
            continue

        user_prompt = f"Analyze keyword strategy for '{kw}' in the category '{category}' ({sub_cat})."
        assistant_response = (
            f"### Keyword Strategy Analysis: '{kw}'\n\n"
            f"- **Category:** {category} > {sub_cat}\n"
            f"- **Search Intent:** {intent}\n"
            f"- **Search Volume Tier:** {vol_tier}\n"
            f"- **Benchmark CPC:** {cpc_value} ({cpc_source} planning figure, not measured)\n"
            f"- **Target Landing Page:** {target_page}\n"
            f"- **Recommended Schema:** `https://schema.org/{recommended_schema}`\n\n"
            f"**Competitive Context & Defense:**\n{comp_context}\n\n"
            f"**Conversational AI / GEO Targeting Prompt:**\n\"{entity_prompt}\"\n\n"
            f"**Action Plan:** Ensure title tag incorporates '{kw}' within 55 characters, paired with an H1 headline and direct booking Call-to-Action."
        )
        examples.append(make_sft_example(system_prompt, user_prompt, assistant_response))

    return examples


def generate_gsc_cannibalization_examples() -> list[dict[str, Any]]:
    """Synthesize GSC query cannibalization & performance diagnostic pairs."""
    examples: list[dict[str, Any]] = []
    system_prompt = (
        "You are SEO Studio's Google Search Console (GSC) Diagnostics Engine. "
        "Diagnose keyword cannibalization, CTR anomalies, and indexation issues from GSC analytics."
    )

    scenarios = [
        {
            "query": "boutique hotel downtown suites",
            "url1": "https://example.com/suites",
            "url2": "https://example.com/rooms/downtown-suite",
            "clicks1": 140,
            "clicks2": 95,
            "imp1": 3200,
            "imp2": 2800,
            "pos1": 8.4,
            "pos2": 9.1,
        },
        {
            "query": "pet friendly luxury rooms",
            "url1": "https://example.com/amenities/pets",
            "url2": "https://example.com/blog/pet-friendly-hotel-guide",
            "clicks1": 80,
            "clicks2": 72,
            "imp1": 1900,
            "imp2": 2100,
            "pos1": 11.2,
            "pos2": 12.5,
        },
    ]

    for s in scenarios:
        user_prompt = (
            f"Search Console reports keyword cannibalization on query '{s['query']}'. "
            f"URL A: {s['url1']} ({s['clicks1']} clicks, {s['imp1']} imp, pos {s['pos1']}). "
            f"URL B: {s['url2']} ({s['clicks2']} clicks, {s['imp2']} imp, pos {s['pos2']}). "
            f"How do we resolve this ranking split?"
        )
        assistant_response = (
            f"### Cannibalization Resolution Plan for '{s['query']}'\n\n"
            f"**Diagnosis:** Both URLs are competing for the same primary query in the top 10-15 SERP positions, "
            f"diluting authority and splitting user click share.\n\n"
            f"**Recommended Action:**\n"
            f"1. **Primary Landing Page Selection:** Designate `{s['url1']}` as the definitive target based on higher historical clicks.\n"
            f"2. **Internal Linking Refinement:** Add an in-content contextual link from `{s['url2']}` pointing to `{s['url1']}` with anchor text '{s['query']}'.\n"
            f"3. **Secondary Page Repositioning:** Retarget `{s['url2']}` toward long-tail informational variants.\n"
            f"4. **Canonical Check:** Ensure `{s['url1']}` has a clean self-referencing canonical."
        )
        examples.append(make_sft_example(system_prompt, user_prompt, assistant_response))

    return examples


def generate_geo_visibility_examples() -> list[dict[str, Any]]:
    """Synthesize Generative Engine Optimization (GEO) & AI visibility pairs."""
    examples: list[dict[str, Any]] = []
    system_prompt = (
        "You are SEO Studio's Chief AI Visibility & GEO Strategist. "
        "Optimize brand entity citations and structured fact density for LLM search engines "
        "(Perplexity, ChatGPT Search, Claude, Google AI Overviews)."
    )

    prompts = [
        (
            "How do we optimize our website content to be cited in Google AI Overviews and Perplexity search answers?",
            "### Generative Engine Optimization (GEO) Action Blueprint\n\n"
            "To maximize citation probability in LLM synthesized answers:\n\n"
            "1. **Structured Direct Answers:** Place a concise 40-60 word definition or answer block immediately below every major H2.\n"
            "2. **Entity Consistency:** Align Organization / LocalBusiness Schema properties (`name`, `address`, `telephone`, `sameAs`, `hasMap`) with Google Knowledge Graph entities.\n"
            "3. **Factual Density & Statistics:** LLMs favor content with high numeric data density (exact pricing, square footage, check-in policies).\n"
            "4. **Table & List Extraction:** Structure key specifications in clean HTML `<table>` or `<ul>` elements, which are favored by LLM crawlers.\n"
            "5. **High-Authority Brand Co-Citations:** Secure references on authoritative industry portals to validate digital entity existence."
        ),
        (
            "What technical factors prevent LLM web search agents (like Perplexity or GPTBot) from citing our pages?",
            "### AI Crawler Accessibility Audit\n\n"
            "1. **Robots.txt Disallow Directives:** Check if `GPTBot`, `PerplexityBot`, or `ClaudeBot` are inadvertently blocked.\n"
            "2. **Client-Side Rendering (CSR) Overhead:** Ensure critical entity facts are in server-rendered HTML rather than deferred JS hydration.\n"
            "3. **Aggressive Bot Protection / Cloudflare WAF:** Verify that legitimate AI search crawler user-agents are not served 403 or Cloudflare challenges.\n"
            "4. **Stale or Invalid Schema.org Syntax:** Run JSON-LD validation to prevent schema parsing errors by knowledge graph parsers."
        ),
    ]

    for q, a in prompts:
        examples.append(make_sft_example(system_prompt, q, a))

    return examples


def main() -> int:
    print("==================================================================")
    print(" SEO Studio Unified SEO Platform - SFT Training Data Preparation")
    print("==================================================================")

    TRAINING_DIR.mkdir(parents=True, exist_ok=True)

    all_examples: list[dict[str, Any]] = []

    # 1. Google algorithm updates
    google_updates_path = DATA_DIR / "google-updates.json"
    g_examples = generate_google_update_examples(google_updates_path)
    print(f"[+] Loaded {len(g_examples)} examples from Google Algorithm Updates ({google_updates_path.name})")
    all_examples.extend(g_examples)

    # 2. Specialized Claude-SEO Agents
    agent_examples = generate_agent_prompt_examples(AGENTS_DIR)
    print(f"[+] Loaded {len(agent_examples)} examples from 20 Specialized SEO Agents ({AGENTS_DIR})")
    all_examples.extend(agent_examples)

    # 3. 78-Keyword Strategy Matrix (hotel pack dataset)
    matrix_path = PROJECT_ROOT / "src" / "packs" / "hotel" / "keywords.json"
    kw_examples = generate_keyword_strategy_examples(matrix_path)
    print(f"[+] Loaded {len(kw_examples)} examples from 78-Keyword Matrix ({matrix_path.name})")
    all_examples.extend(kw_examples)

    # 4. GSC Diagnostics
    gsc_examples = generate_gsc_cannibalization_examples()
    print(f"[+] Loaded {len(gsc_examples)} examples from Search Console Cannibalization Diagnostics")
    all_examples.extend(gsc_examples)

    # 5. GEO / AI Visibility
    geo_examples = generate_geo_visibility_examples()
    print(f"[+] Loaded {len(geo_examples)} examples from Generative Engine Optimization (GEO)")
    all_examples.extend(geo_examples)

    # Deduplication via SHA256 of normalized user prompt
    seen_hashes: set[str] = set()
    deduped_examples: list[dict[str, Any]] = []
    total_tokens = 0

    for ex in all_examples:
        content_key = json.dumps(ex["messages"], sort_keys=True)
        h = hashlib.sha256(content_key.encode("utf-8")).hexdigest()
        if h not in seen_hashes:
            seen_hashes.add(h)
            deduped_examples.append(ex)
            total_tokens += sum(estimate_tokens(m["content"]) for m in ex["messages"])

    print(f"[+] Total unique examples: {len(deduped_examples)} (~{total_tokens:,} tokens estimated)")

    # 80/20 Train / Eval Split (Deterministic)
    split_idx = int(len(deduped_examples) * 0.8)
    train_set = deduped_examples[:split_idx]
    eval_set = deduped_examples[split_idx:]

    train_file = TRAINING_DIR / "unified_seo_train.jsonl"
    eval_file = TRAINING_DIR / "unified_seo_eval.jsonl"
    report_file = TRAINING_DIR / "dataset_quality_report.json"

    with open(train_file, "w", encoding="utf-8") as f:
        for ex in train_set:
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")

    with open(eval_file, "w", encoding="utf-8") as f:
        for ex in eval_set:
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")

    quality_report = {
        "status": "success",
        "datasetName": "SEO-Studio-Unified-SEO-SFT-v1",
        "totalExamples": len(deduped_examples),
        "trainCount": len(train_set),
        "evalCount": len(eval_set),
        "trainRatio": round(len(train_set) / max(1, len(deduped_examples)), 2),
        "evalRatio": round(len(eval_set) / max(1, len(deduped_examples)), 2),
        "estimatedTokens": total_tokens,
        "sources": {
            "googleAlgorithmUpdates": len(g_examples),
            "claudeSeoSpecializedAgents": len(agent_examples),
            "keywordStrategyMatrix": len(kw_examples),
            "gscDiagnostics": len(gsc_examples),
            "geoAiVisibility": len(geo_examples),
        },
        "sanitization": {
            "secretPatternsEnforced": len(SECRET_PATTERNS),
            "deduplicationAlgorithm": "SHA256 Content Key",
        },
        "files": {
            "train": str(train_file.relative_to(PROJECT_ROOT)),
            "eval": str(eval_file.relative_to(PROJECT_ROOT)),
        },
    }

    with open(report_file, "w", encoding="utf-8") as f:
        json.dump(quality_report, f, indent=2)

    print(f"[✔] Wrote {len(train_set)} training rows to {train_file.name}")
    print(f"[✔] Wrote {len(eval_set)} evaluation rows to {eval_file.name}")
    print(f"[✔] Wrote dataset quality report to {report_file.name}")
    print("==================================================================")
    return 0


if __name__ == "__main__":
    sys.exit(main())
