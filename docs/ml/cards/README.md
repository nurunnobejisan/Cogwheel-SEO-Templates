# Dataset cards

One card per source declared in `ml/sources.yaml`. Each states the licence, the permitted use, the feeds it may populate, and whether attribution is owed.

| Source | Licence | Use | Attribution |
|---|---|---|---|
| [commoncrawl](commoncrawl.md) | Common Crawl Terms of Use; page text remains the owners' copyright | `train` | — |
| [geo-bench](geo-bench.md) | CC BY-SA 4.0, derived from MS MARCO / ORCAS | `eval_only` | required |
| [google-search-central](google-search-central.md) | CC BY 4.0 text, Apache-2.0 code | `train_attribution` | required |
| [hotelrec](hotelrec.md) | Academic research only | `avoid` | — |
| [httparchive](httparchive.md) | Terms not yet confirmed | `eval_only` | — |
| [lighthouse-labels](lighthouse-labels.md) | Apache-2.0 | `train` | — |
| [ms-marco](ms-marco.md) | Non-commercial research only | `avoid` | — |
| [orcas](orcas.md) | Non-commercial research only | `avoid` | — |
| [osm-hotels](osm-hotels.md) | ODbL | `train_attribution` | required |
| [patches](patches.md) | Own data + consent | `train` | — |
| [repo-synthetic](repo-synthetic.md) | Own | `train` | — |
| [schemaorg](schemaorg.md) | CC BY-SA 3.0 | `train_attribution` | required |
| [triples](triples.md) | Own data + consent | `train` | — |
| [vault](vault.md) | Own data + consent | `train` | — |
| [wdc-2024](wdc-2024.md) | Common Crawl Terms of Use | `train` | — |
| [wdc-tables-2023](wdc-tables-2023.md) | Common Crawl Terms of Use | `train` | — |
| [wikidata](wikidata.md) | CC0 | `train` | — |

---

_Generated from `ml/sources.yaml` by `npm run ml:cards`. Do not edit by hand._
