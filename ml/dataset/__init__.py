"""Dataset layer — WDC subsets, Wikidata entity grounding, dataset cards.

The three things Phase 1 needs after collection and extraction:

- :mod:`ml.dataset.wdc` selects the licensed Web Data Commons subsets the
  plan allows (Hotel, LodgingBusiness, Restaurant, FAQPage, BreadcrumbList)
  and records what was actually taken;
- :mod:`ml.dataset.wikidata` grounds a hotel entity as facts for the GEO gap
  finder, reading only properties whose values are asserted on the entity;
- :mod:`ml.dataset.cards` renders one dataset card per corpus from
  ``ml/sources.yaml`` so a card can never drift from the registry.

Nothing here invents a value. A property the entity does not assert comes back
absent, not defaulted.
"""

from __future__ import annotations

from . import cards, wikidata, wdc

__all__ = ["wdc", "wikidata", "cards"]
