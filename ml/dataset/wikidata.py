"""Wikidata entity grounding for the GEO gap finder.

Reads asserted facts about a hotel entity so the gap finder can say what the
page is missing **without inventing anything**: a property the entity does not
assert comes back absent, never defaulted.

Standard library only. This module parses and normalises; the caller performs
the request (behind the SSRF guard) so politeness and caching stay in one
place.

The ``wikidata`` source in ``ml/sources.yaml`` is CC0, so these facts are
free to train on — but they are still labelled with their source.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

__all__ = [
    "WIKIDATA_PROPERTIES",
    "EntityFacts",
    "facts_from_entity",
    "facts_from_sparql_json",
    "entity_signals",
    "missing_signals",
    "to_example_input",
]

#: Wikidata property ids this plan uses, mapped to the signal name the GEO gap
#: finder reports. Only these are read; anything else on the entity is ignored
#: so the record stays small and reviewable.
WIKIDATA_PROPERTIES: Dict[str, str] = {
    "P625": "geo",                    # coordinate location
    "P856": "sameAs",                 # official website
    "P778": "address",                # street address (deprecated but common)
    "P669": "streetAddress",          # street
    "P276": "addressLocality",        # location
    "P131": "addressRegion",          # located in administrative entity
    "P281": "postalCode",             # postal code
    "P17": "country",                 # country
    "P159": "addressLocality",        # headquarter location
    "P1104": "numberOfRooms",         # number of rooms
    "P1552": "hasQuality",            # star / classification
    "P2556": "stars",                 # star rating
    "P5074": "petsAllowed",           # pets allowed
    "P4404": "openingHours",          # opening hours
    "P366": "amenityFeature",         # uses
    "P8607": "publicTransit",         # near public transport
    "P2789": "parkingAvailability",   # parking
}

#: Signals the GEO gap finder reports as present/absent on the page.
GEO_SIGNALS: Tuple[str, ...] = (
    "geo",
    "streetAddress",
    "addressLocality",
    "addressRegion",
    "postalCode",
    "sameAs",
    "openingHours",
    "numberOfRooms",
    "amenityFeature",
    "petsAllowed",
)


@dataclass
class EntityFacts:
    """Grounded facts about one entity."""

    entity_id: str = ""
    label: str = ""
    #: signal name -> asserted value(s); absent means "not asserted"
    facts: Dict[str, Any] = field(default_factory=dict)
    #: raw property ids read, for provenance
    properties_read: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    @property
    def signals_present(self) -> List[str]:
        """Signals the entity actually asserts, in a stable order."""
        return [name for name in GEO_SIGNALS if name in self.facts]

    def as_dict(self) -> Dict[str, Any]:
        return {
            "entityId": self.entity_id,
            "label": self.label,
            "facts": self.facts,
            "propertiesRead": self.properties_read,
            "warnings": self.warnings,
        }


def _claim_value(claim: Mapping[str, Any]) -> Any:
    """Pull the canonical value out of a Wikidata claim.

    Snak types other than `value` (some, no-value, unknown) are treated as
    *not asserted* — reporting them as a fact would be inventing one.
    """
    mainsnak = claim.get("mainsnak")
    if not isinstance(mainsnak, Mapping):
        return None
    if mainsnak.get("snaktype") != "value":
        return None
    datavalue = mainsnak.get("datavalue")
    if not isinstance(datavalue, Mapping):
        return None
    value = datavalue.get("value")

    # Time values come back as "+1990-01-01T00:00:00Z" — expose the date part.
    if isinstance(value, Mapping) and "time" in value:
        raw = str(value["time"])
        return raw[1:] if raw.startswith("+") else raw

    # Quantity values are wrapped.
    if isinstance(value, Mapping) and "amount" in value:
        amount = str(value["amount"])
        return amount[1:] if amount.startswith("+") else amount

    # Globe-coordinate values.
    if isinstance(value, Mapping) and "latitude" in value:
        return {
            "latitude": value.get("latitude"),
            "longitude": value.get("longitude"),
        }

    # Monolingual text / entity references.
    if isinstance(value, Mapping) and "text" in value:
        return value.get("text")
    if isinstance(value, Mapping) and "id" in value:
        return value.get("id")

    if isinstance(value, (str, int, float, bool)):
        return value
    return None


def facts_from_entity(payload: Mapping[str, Any]) -> EntityFacts:
    """Normalise a Wikidata entity response into :class:`EntityFacts`.

    Never raises on a partial entity: unknown properties are ignored and
    missing claims simply do not produce a signal.
    """
    facts = EntityFacts()
    facts.entity_id = str(payload.get("id") or "")

    labels = payload.get("labels")
    if isinstance(labels, Mapping):
        en = labels.get("en")
        if isinstance(en, Mapping) and isinstance(en.get("value"), str):
            facts.label = en["value"]

    claims = payload.get("claims")
    if not isinstance(claims, Mapping):
        facts.warnings.append("entity has no `claims` object")
        return facts

    for prop_id, signal in WIKIDATA_PROPERTIES.items():
        raw_claims = claims.get(prop_id)
        if not isinstance(raw_claims, list) or not raw_claims:
            continue
        values: List[Any] = []
        for claim in raw_claims:
            if not isinstance(claim, Mapping):
                continue
            value = _claim_value(claim)
            if value is not None:
                values.append(value)
        if not values:
            # Present but only "no value" snaks — still not asserted.
            continue
        facts.properties_read.append(prop_id)
        # Collapse to a bare value when there is exactly one.
        facts.facts[signal] = values[0] if len(values) == 1 else values

    return facts


def facts_from_sparql_json(payload: Mapping[str, Any]) -> List[EntityFacts]:
    """Normalise a SPARQL SELECT response into a list of :class:`EntityFacts`.

    Used when several candidate entities are compared to pick the right one.
    Each row becomes one entity; a row missing its binding is skipped with a
    warning rather than producing an empty-but-present fact.
    """
    results = payload.get("results")
    bindings: Sequence[Mapping[str, Any]] = ()
    if isinstance(results, Mapping):
        raw = results.get("bindings")
        if isinstance(raw, list):
            bindings = [b for b in raw if isinstance(b, Mapping)]

    out: List[EntityFacts] = []
    for row in bindings:
        facts = EntityFacts()
        entity = row.get("entity") or row.get("item")
        if isinstance(entity, Mapping) and isinstance(entity.get("value"), str):
            facts.entity_id = entity["value"].rsplit("/", 1)[-1]
        label = row.get("label")
        if isinstance(label, Mapping) and isinstance(label.get("value"), str):
            facts.label = label["value"]
        if not facts.entity_id:
            facts.warnings.append("row has no entity binding")
            continue
        for key, value in row.items():
            if key in {"entity", "item", "label"}:
                continue
            if isinstance(value, Mapping) and "value" in value:
                facts.facts[key] = value["value"]
        out.append(facts)
    return out


def entity_signals(facts: EntityFacts) -> Dict[str, bool]:
    """Which GEO signals the entity asserts — the gap finder's baseline."""
    return {name: name in facts.facts for name in GEO_SIGNALS}


def missing_signals(facts: EntityFacts) -> List[str]:
    """Signals the entity does **not** assert.

    These are the ones a page must not claim either: with no ground truth,
    asserting them would be fabrication.
    """
    return [name for name in GEO_SIGNALS if name not in facts.facts]


def to_example_input(
    facts: EntityFacts, *, domain: str, url: Optional[str] = None
) -> Dict[str, Any]:
    """Shape entity facts into the ``input`` half of an ``MlExample``.

    Only measured/observed values land in ``measured``; a missing signal is
    omitted rather than written as ``None``, so downstream code cannot mistake
    "unknown" for "false".
    """
    import hashlib

    measured: Dict[str, Any] = {}
    for name in facts.signals_present:
        measured[name] = facts.facts[name]

    payload: Dict[str, Any] = {
        "domainHash": hashlib.sha256(domain.encode("utf-8")).hexdigest()[:16],
        "measured": measured,
    }
    if url:
        payload["url"] = url
    if facts.entity_id:
        payload["entityId"] = facts.entity_id
    return payload
