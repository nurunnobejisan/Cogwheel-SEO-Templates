# Proposal — Common Crawl metadata slice (D-038, investigation only)

> Status: **proposal**. This document deliberately does NOT touch
> `ml/sources.yaml`, the dataset cards or `ml/sources.json` — adding a source
> to the registry is a licence decision that needs the terms read and accepted
> first (rule 3 of the data constitution).

## What the slice would be

A `metadata_generation` training slice derived from Common Crawl page
snapshots: (url, HTML) → the page's real `<title>`, meta description and
existing JSON-LD, filtered to hospitality-relevant hosts. The supervision
signal is *the page's own published metadata* — no labelling model, no
invented targets.

## Why it could help

- `metadata_generation` is one of the two Tier 1 ship-gate tasks and is the
  first candidate for a measured `readyTasks` scope (D-036). More
  licence-clean, source-published pairs would deepen the train split without
  touching golden hosts.
- Common Crawl's Terms of Use are already accepted in the registry for three
  existing entries (`wdc-2024`, `wdc-tables-2023`, `commoncrawl`: "Common
  Crawl Terms of Use; page text remains under website copyright"), so the
  precedent for the terms is established — the **metadata-specific reading**
  still needs its own review.

## Open licence / governance questions (must be answered before registry entry)

1. **Robots.txt.** Common Crawl honours robots on crawl, but re-use of page
   content in training should still respect the site's wishes — what is our
   documented position for metadata (a short, factual field) vs body text?
2. **Copyright of the metadata itself.** Titles/descriptions are creative
   text owned by the site. "Page text remains under website copyright" —
   does training on it as supervision (not output) need a different
   justification than JSON-LD (structured, factual)?
3. **PII.** Crawl snapshots can contain personal data; the builder must run
   `ml.clean.pii.strip_pii` and a domain blocklist before rows enter
   `data/raw/`. Producer-side filtering needs a documented rule.
4. **Host overlap.** Any host present in the golden set must be excluded by
   `extract_registrable_host` (already enforced by the builders) — but the
   slice should also exclude the eval-only hosts (`httparchive`,
   `geo-bench`) to keep eval clean.
5. **Volume/recency.** Which CC segment(s) (e.g. CC-MAIN-2026-XX), WARC vs
   index files, and a freshness bound so stale metadata does not teach
   outdated patterns.

## If accepted, the minimal implementation path

1. Add a `commoncrawl-metadata` entry to `ml/sources.yaml` with
   `use: train`, explicit licence note and the answered questions above.
2. Producer script under `ml/dataset/` (D-032: no restructuring) that
   streams WARC segments, filters hospitality hosts, extracts
   title/description/JSON-LD, strips PII, and writes `data/raw/`
   (gitignored).
3. Feed through the existing `build_sft.py` gates — no new gate code.
4. A dataset card per the existing 17.

## Explicitly out of scope of this proposal

- Actually adding the registry entry or cards (human licence review).
- Any crawl by us (Common Crawl only serves existing snapshots).
- Using the slice for eval (it must stay `use: train`).
