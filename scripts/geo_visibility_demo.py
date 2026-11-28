"""Demo: AI visibility run on 5 intents x 3 languages using recorded answers."""

from __future__ import annotations

import json
import yaml
from pathlib import Path

from geo_visibility.providers import RecordedProvider
from geo_visibility.runner import run_visibility

ROOT = Path(__file__).resolve().parent.parent
INTENTS = yaml.safe_load((ROOT / "src/packs/bangladesh-hotels/queries.yaml").read_text())["intents"][:5]
ENTITIES = yaml.safe_load((ROOT / "src/packs/bangladesh-hotels/entities.yaml").read_text())["entities"]
FIXTURE = json.loads((ROOT / "data/geo_visibility/recorded_answers.json").read_text())

provider = RecordedProvider(name="recorded", fixture=FIXTURE)
results = run_visibility(provider, INTENTS, ENTITIES, n=3, out_dir=ROOT / "data/geo_visibility/runs")

# Summary: mention rate per entity x language
from collections import defaultdict
stats = defaultdict(lambda: defaultdict(lambda: {"mentioned": 0, "total": 0, "cited": 0}))
for r in results:
    for brand, m in r.mentions.items():
        s = stats[brand][r.language]
        s["total"] += 1
        if m.mentioned:
            s["mentioned"] += 1
        if m.cited:
            s["cited"] += 1

print("Provider:", provider.name)
print("Intents:", len(INTENTS), "Languages: 3, Runs per cell: 3")
print()
for brand in [e["brand"] for e in ENTITIES]:
    print(f"Brand: {brand}")
    for lang in ("en", "bn", "banglish"):
        s = stats[brand][lang]
        rate = s["mentioned"] / s["total"] if s["total"] else 0
        print(f"  {lang:9s} mention_rate={rate:.2f} ({s['mentioned']}/{s['total']}) cited={s['cited']}")
    print()