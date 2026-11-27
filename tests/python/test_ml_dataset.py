#!/usr/bin/env python3
"""Tests for the dataset layer (ml/dataset/).

WDC subset selection, Wikidata entity grounding, and dataset-card generation.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.dataset import cards, wikidata, wdc  # noqa: E402

# --------------------------------------------------------------------- WDC --


def test_allowed_type_accepts_hotel() -> None:
    assert wdc.allowed_type({"@type": "Hotel"})
    assert wdc.allowed_type({"@graph": [{"@type": "FAQPage"}]})


def test_allowed_type_rejects_everything_else() -> None:
    assert not wdc.allowed_type({"@type": "Person"})
    assert not wdc.allowed_type({"@type": "Recipe"})
    assert not wdc.allowed_type({})


def test_filter_keeps_only_allow_listed_records() -> None:
    records = [
        {"@type": "Hotel", "name": "A"},
        {"@type": "Recipe", "name": "B"},
        {"@type": ["Thing", "Restaurant"], "name": "C"},
        "not an object",
    ]
    kept, report = wdc.filter_records(records)
    assert [r["name"] for r in kept] == ["A", "C"]
    assert report.total == 4
    assert report.kept == 2
    assert report.rejected_unknown_type == 1
    assert report.rejected_malformed == 1
    assert report.kept_by_type["Hotel"] == 1
    assert report.kept_by_type["Restaurant"] == 1


def test_table_corpus_uses_the_narrower_allow_list() -> None:
    records = [{"@type": "BreadcrumbList"}]
    kept, report = wdc.filter_records(records, table_corpus=True)
    assert kept == []
    assert report.rejected_unknown_type == 1

    kept2, _ = wdc.filter_records(records)  # JSON-LD corpus allows it
    assert len(kept2) == 1


def test_select_subset_unwraps_common_containers() -> None:
    payload = {"records": [{"@type": "Hotel"}, {"@type": "Person"}]}
    kept, _ = wdc.select_subset(payload)
    assert len(kept) == 1


def test_select_subset_handles_bare_list() -> None:
    kept, _ = wdc.select_subset([{"@type": "Hotel"}])
    assert len(kept) == 1


def test_select_subset_reports_unsupported_shape() -> None:
    kept, report = wdc.select_subset(42)
    assert kept == []
    assert report.warnings


def test_parse_lines_skips_corrupt_lines() -> None:
    payload = b'{"@type": "Hotel"}\nnot json\n{"@type": "FAQPage"}\n[1,2]\n'
    records, malformed = wdc.parse_lines(payload)
    assert len(records) == 2
    assert malformed == 2


def test_empty_payload_is_not_an_error() -> None:
    kept, report = wdc.select_subset([])
    assert kept == []
    assert report.total == 0


# --------------------------------------------------------------- Wikidata ---


def _entity(claims=None, label="The Nines") -> dict:
    return {
        "id": "Q42",
        "labels": {"en": {"value": label}},
        "claims": claims or {},
    }


def test_label_and_id_read() -> None:
    facts = wikidata.facts_from_entity(_entity())
    assert facts.entity_id == "Q42"
    assert facts.label == "The Nines"


def test_asserted_values_become_facts() -> None:
    claims = {
        "P1104": [{"mainsnak": {"snaktype": "value", "datavalue": {"value": 267}}}],
        "P856": [
            {"mainsnak": {"snaktype": "value", "datavalue": {"value": "https://thenines.com"}}}
        ],
    }
    facts = wikidata.facts_from_entity(_entity(claims))
    assert facts.facts["numberOfRooms"] == 267
    assert facts.facts["sameAs"] == "https://thenines.com"


def test_no_value_snak_is_not_a_fact() -> None:
    """A `novalue` snak means "not asserted" — reporting it would invent one."""
    claims = {"P5074": [{"mainsnak": {"snaktype": "novalue"}}]}
    facts = wikidata.facts_from_entity(_entity(claims))
    assert "petsAllowed" not in facts.facts
    assert "P5074" not in facts.properties_read


def test_coordinate_location_becomes_geo() -> None:
    claims = {
        "P625": [
            {
                "mainsnak": {
                    "snaktype": "value",
                    "datavalue": {"value": {"latitude": 45.5152, "longitude": -122.6784}},
                }
            }
        ]
    }
    facts = wikidata.facts_from_entity(_entity(claims))
    assert facts.facts["geo"] == {"latitude": 45.5152, "longitude": -122.6784}


def test_time_values_are_normalised() -> None:
    claims = {
        "P4404": [
            {
                "mainsnak": {
                    "snaktype": "value",
                    "datavalue": {"value": {"time": "+1990-01-01T00:00:00Z"}},
                }
            }
        ]
    }
    facts = wikidata.facts_from_entity(_entity(claims))
    assert facts.facts["openingHours"] == "1990-01-01T00:00:00Z"


def test_entity_without_claims_warns_not_raises() -> None:
    facts = wikidata.facts_from_entity({"id": "Q1"})
    assert facts.warnings
    assert facts.facts == {}


def test_multiple_values_are_kept_as_a_list() -> None:
    claims = {
        "P366": [
            {"mainsnak": {"snaktype": "value", "datavalue": {"value": "swimming_pool"}}},
            {"mainsnak": {"snaktype": "value", "datavalue": {"value": "restaurant"}}},
        ]
    }
    facts = wikidata.facts_from_entity(_entity(claims))
    assert facts.facts["amenityFeature"] == ["swimming_pool", "restaurant"]


def test_signals_and_missing_signals_are_complements() -> None:
    claims = {
        "P856": [
            {"mainsnak": {"snaktype": "value", "datavalue": {"value": "https://x.com"}}}
        ]
    }
    facts = wikidata.facts_from_entity(_entity(claims))
    present = wikidata.entity_signals(facts)
    missing = wikidata.missing_signals(facts)
    assert present["sameAs"] is True
    assert "sameAs" not in missing
    assert len(present) == len(wikidata.GEO_SIGNALS)
    assert sum(1 for v in present.values() if v) + len(missing) == len(wikidata.GEO_SIGNALS)


def test_to_example_input_omits_unasserted_signals() -> None:
    """An unknown signal must be absent, not written as False/None."""
    facts = wikidata.facts_from_entity(_entity())
    payload = wikidata.to_example_input(facts, domain="thenines.com")
    assert payload["measured"] == {}
    assert "thenines" not in payload["domainHash"]


def test_to_example_input_includes_measured_signals() -> None:
    claims = {
        "P1104": [{"mainsnak": {"snaktype": "value", "datavalue": {"value": 267}}}],
    }
    facts = wikidata.facts_from_entity(_entity(claims))
    payload = wikidata.to_example_input(facts, domain="thenines.com", url="https://thenines.com/")
    assert payload["measured"] == {"numberOfRooms": 267}
    assert payload["url"] == "https://thenines.com/"
    assert payload["entityId"] == "Q42"


def test_sparql_rows_become_entities() -> None:
    payload = {
        "results": {
            "bindings": [
                {"entity": {"value": "http://www.wikidata.org/entity/Q42"},
                 "label": {"value": "The Nines"}},
                {"entity": {"value": "http://www.wikidata.org/entity/Q7"},
                 "label": {"value": "Other"}},
                {"label": {"value": "orphan row"}},
            ]
        }
    }
    entities = wikidata.facts_from_sparql_json(payload)
    assert len(entities) == 2
    assert entities[0].entity_id == "Q42"
    assert entities[0].label == "The Nines"


def test_sparql_empty_response() -> None:
    assert wikidata.facts_from_sparql_json({}) == []


# ------------------------------------------------------------------ cards ---


def _sources():
    payload = json.loads((REPO_ROOT / "ml" / "sources.json").read_text(encoding="utf-8"))
    return payload["sources"]


def test_every_source_has_a_card() -> None:
    sources = _sources()
    rendered = cards.render_all(sources)
    assert len(rendered) == len(sources)
    for source in sources:
        assert f"{source['id']}.md" in rendered


def test_card_states_licence_use_and_attribution() -> None:
    geo = next(s for s in _sources() if s["id"] == "geo-bench")
    card = cards.render_card(geo)
    assert "CC BY-SA 4.0" in card
    assert "`eval_only`" in card
    assert "attribution" in card.lower()
    assert "THIRD_PARTY_NOTICES.md" in card


def test_avoid_card_explains_the_ban() -> None:
    ms_marco = next(s for s in _sources() if s["id"] == "ms-marco")
    card = cards.render_card(ms_marco)
    assert "`avoid`" in card
    assert "train:validate" in card  # points at the CI gate


def test_train_card_has_no_forbidden_language() -> None:
    triples = next(s for s in _sources() if s["id"] == "triples")
    card = cards.render_card(triples)
    assert "`train`" in card
    assert "Forbidden" not in card


def test_render_index_links_every_source() -> None:
    index = cards.render_index(_sources())
    for source in _sources():
        assert f"]({source['id']}.md)" in index


def test_cards_are_current_on_disk() -> None:
    """CI gate: regenerating must produce byte-identical cards."""
    problems = cards.check_cards(_sources(), REPO_ROOT / "docs" / "ml" / "cards")
    assert problems == [], "\n".join(problems)


def test_use_rules_cover_every_use_value() -> None:
    for source in _sources():
        assert source["use"] in cards.USE_RULES, f"no rule text for {source['use']}"
