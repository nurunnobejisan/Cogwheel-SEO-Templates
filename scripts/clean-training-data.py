#!/usr/bin/env python3
"""
Governance pass over the unified SEO SFT datasets (train + eval).

Fixes the two defects found in the *baseline* rows so the data is defensible:

1. Unresolved `{{placeholders}}` in the 48 baseline keyword rows (train) and
   30 keyword rows (eval). They are instantiated with a coherent, rotating set
   of coastal-hotel profiles (so `{{cruisePortName}}` etc. stay plausible).

2. Fabricated metrics in the baseline gold answers:
      - **Search Volume Tier:** High|Medium
      - **Benchmark CPC:** $x - $y
   These are replaced with an explicit "unavailable" line, matching the
   platform rule: never present an unmeasured metric as measured.

Also tags every row with `meta.provenance` (measured|estimated|unavailable) and
`meta.category`, and writes an audit block into dataset_quality_report.json.

Deterministic and idempotent: re-running produces byte-identical output.

Run: python3 scripts/clean-training-data.py
"""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TRAIN = ROOT / "data/training/unified_seo_train.jsonl"
EVAL = ROOT / "data/training/unified_seo_eval.jsonl"
REPORT = ROOT / "data/training/dataset_quality_report.json"

CATEGORY_KEYWORDS = "78-Keyword Strategy & Intent"

# Coastal profiles so every placeholder token (incl. cruise port) stays plausible.
PROFILES = [
    {
        "hotelName": "Harborview Seattle",
        "brand": "Hilton Hotels & Resorts",
        "loyaltyProgram": "Hilton Honors",
        "cityName": "Seattle",
        "neighborhoodName": "Belltown",
        "landmarkName": "the Space Needle",
        "downtownAttraction": "Pike Place Market",
        "historicDistrict": "Pioneer Square",
        "stadiumName": "Lumen Field",
        "themeParkName": "Wild Waves Theme & Water Park",
        "medicalCenterName": "Swedish Medical Center",
        "airportCode": "SEA",
        "trainStationName": "King Street Station",
        "cruisePortName": "Pier 66",
        "highwayCorridor": "the I-5 corridor",
        "transitHubName": "Westlake Center",
        "guestCount": "300",
        "competitorHotel": "the Edgewater Hotel",
    },
    {
        "hotelName": "The Gabriel Miami",
        "brand": "Curio Collection by Hilton",
        "loyaltyProgram": "Hilton Honors",
        "cityName": "Miami",
        "neighborhoodName": "Brickell",
        "landmarkName": "Bayfront Park",
        "downtownAttraction": "Bayside Marketplace",
        "historicDistrict": "the Miami Design District",
        "stadiumName": "loanDepot park",
        "themeParkName": "Jungle Island",
        "medicalCenterName": "Jackson Memorial Hospital",
        "airportCode": "MIA",
        "trainStationName": "Government Center Station",
        "cruisePortName": "PortMiami",
        "highwayCorridor": "the I-95 corridor",
        "transitHubName": "the Metromover",
        "guestCount": "336",
        "competitorHotel": "the Kimpton EPIC Hotel",
    },
    {
        "hotelName": "The US Grant San Diego",
        "brand": "Hilton Hotels & Resorts",
        "loyaltyProgram": "Hilton Honors",
        "cityName": "San Diego",
        "neighborhoodName": "Gaslamp Quarter",
        "landmarkName": "Balboa Park",
        "downtownAttraction": "Seaport Village",
        "historicDistrict": "the Gaslamp Quarter",
        "stadiumName": "Petco Park",
        "themeParkName": "SeaWorld San Diego",
        "medicalCenterName": "UC San Diego Health",
        "airportCode": "SAN",
        "trainStationName": "Santa Fe Depot",
        "cruisePortName": "the B Street Cruise Ship Terminal",
        "highwayCorridor": "the I-5 corridor",
        "transitHubName": "America Plaza",
        "guestCount": "280",
        "competitorHotel": "the Pendry San Diego",
    },
    {
        "hotelName": "The Revolution Hotel Boston",
        "brand": "Hilton Hotels & Resorts",
        "loyaltyProgram": "Hilton Honors",
        "cityName": "Boston",
        "neighborhoodName": "Back Bay",
        "landmarkName": "Fenway Park",
        "downtownAttraction": "Faneuil Hall Marketplace",
        "historicDistrict": "Beacon Hill",
        "stadiumName": "Fenway Park",
        "themeParkName": "the New England Aquarium",
        "medicalCenterName": "Massachusetts General Hospital",
        "airportCode": "BOS",
        "trainStationName": "South Station",
        "cruisePortName": "Flynn Cruiseport Boston",
        "highwayCorridor": "the I-90 corridor",
        "transitHubName": "Park Street Station",
        "guestCount": "280",
        "competitorHotel": "the Boston Park Plaza",
    },
]

TOKEN = re.compile(r"\{\{([A-Za-z0-9_]+)\}\}")


def categorize(system_prompt: str) -> str:
    if "Recovery Specialist" in system_prompt:
        return "Google Algorithm Updates"
    if "SERP Strategist" in system_prompt:
        return CATEGORY_KEYWORDS
    if "Unified SEO Platform" in system_prompt:
        return "20 Claude-SEO Agents"
    return "Search Console Cannibalization & GEO"


def instantiate(text: str, profile: dict) -> str:
    def sub(match: re.Match) -> str:
        key = match.group(1)
        if key not in profile:
            raise KeyError(f"no profile value for placeholder {{{{{key}}}}}")
        return profile[key]

    return TOKEN.sub(sub, text)


def neutralise_metrics(text: str) -> str:
    text = re.sub(
        r"^- \*\*Search Volume Tier:\*\*.*$",
        "- **Search Volume:** unavailable (no volume data source connected)",
        text,
        flags=re.M,
    )
    text = re.sub(
        r"^- \*\*Benchmark CPC:\*\*.*$",
        "- **CPC:** unavailable (no CPC data source connected)",
        text,
        flags=re.M,
    )
    return text


def process(path: Path) -> dict:
    rows = [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]
    templated_index = 0
    categories: Counter = Counter()
    for row in rows:
        msgs = row["messages"]
        system = msgs[0]["content"]
        category = row.setdefault("meta", {}).setdefault("category", categorize(system))
        row["meta"].setdefault("provenance", "unavailable")
        categories[category] += 1

        has_placeholder = any("{{" in m["content"] for m in msgs)
        if has_placeholder:
            profile = PROFILES[templated_index % len(PROFILES)]
            templated_index += 1
            for m in msgs:
                m["content"] = instantiate(m["content"], profile)
        for m in msgs:
            m["content"] = neutralise_metrics(m["content"])

    path.write_text(
        "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8"
    )
    return {"rows": len(rows), "templatedResolved": templated_index, "categories": dict(categories)}


def main() -> None:
    train = process(TRAIN)
    evalu = process(EVAL)

    report = json.loads(REPORT.read_text(encoding="utf-8"))
    combined: Counter = Counter()
    for stats in (train, evalu):
        combined.update(stats["categories"])
    report["audit"] = {
        "note": "Category + provenance derived from each row's meta after governance cleanup.",
        "train": train,
        "eval": evalu,
        "combinedCategories": dict(combined),
        "provenancePolicy": "Rows carry no measured client metrics, so provenance=unavailable.",
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    print(f"train: rows={train['rows']} placeholdersResolved={train['templatedResolved']}")
    print(f"eval : rows={evalu['rows']} placeholdersResolved={evalu['templatedResolved']}")
    print("combined categories:", dict(combined))


if __name__ == "__main__":
    main()
