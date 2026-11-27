#!/usr/bin/env python3
"""Tests for the ML licence registry (ml/registry.py).

Covers the three gates rule 3 and rule 6 depend on: unknown sources, forbidden
sources in a train split, and synthetic rows claiming to be measured.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.registry import (  # noqa: E402
    TRAINABLE_USES,
    LicenceError,
    SourceRegistry,
    assert_trainable,
    domain_hash,
    load_registry,
    register_example,
    require_licence,
)


@pytest.fixture(scope="module")
def registry() -> SourceRegistry:
    return load_registry(refresh=True)


# --------------------------------------------------------------- shape ------


def test_registry_loads(registry: SourceRegistry) -> None:
    assert len(registry) >= 17
    assert registry.version == 1


def test_every_use_value_is_recognised(registry: SourceRegistry) -> None:
    valid = TRAINABLE_USES | {"eval_only", "avoid"}
    for source in registry:
        assert source.use in valid, f"{source.id} has unexpected use={source.use}"


def test_avoid_sources_declare_no_feeds(registry: SourceRegistry) -> None:
    for source in registry:
        if source.use == "avoid":
            assert source.feeds == (), f"{source.id} is avoid but declares feeds"


def test_train_attribution_always_requires_attribution(registry: SourceRegistry) -> None:
    for source in registry:
        if source.use == "train_attribution":
            assert source.needs_attribution, f"{source.id} is train_attribution without the flag"


def test_forbidden_datasets_are_avoid_or_eval_only(registry: SourceRegistry) -> None:
    """The plan's hard bans must be encoded, not merely documented."""
    assert registry.require("ms-marco").use == "avoid"
    assert registry.require("orcas").use == "avoid"
    assert registry.require("hotelrec").use == "avoid"
    # GEO-bench is derived from MS MARCO/ORCAS: eval only, never train.
    assert registry.require("geo-bench").use == "eval_only"


def test_licence_strings_match_registry(registry: SourceRegistry) -> None:
    for source in registry:
        assert source.licence.strip(), f"{source.id} has an empty licence"
        assert require_licence(source.id) == source.licence


# ---------------------------------------------------------------- gates ----


def test_unknown_source_raises() -> None:
    with pytest.raises(LicenceError, match="unknown source"):
        load_registry().require("not-a-real-source")


@pytest.mark.parametrize("source_id", ["ms-marco", "orcas", "hotelrec", "geo-bench"])
def test_forbidden_sources_blocked_from_train(source_id: str) -> None:
    with pytest.raises(LicenceError, match="may not enter a train split"):
        assert_trainable(source_id, "train")


@pytest.mark.parametrize("source_id", ["geo-bench", "httparchive"])
def test_eval_only_sources_allowed_in_eval(source_id: str) -> None:
    entry = assert_trainable(source_id, "eval")
    assert entry.use == "eval_only"


def test_trainable_source_allowed_in_train() -> None:
    entry = assert_trainable("triples", "train")
    assert entry.trainable


def test_module_level_licence_wrapper() -> None:
    assert "CC BY-SA" in require_licence("geo-bench")


# ---------------------------------------------------------- row builder -----


def _base(**overrides) -> dict:
    kwargs = dict(
        task="rag_synthesis",
        source="repo-synthetic",
        input={"domainHash": "abc123", "measured": {}},
        output={"explanation": "x"},
        split="eval",
        provenance="estimated",
        synthetic=True,
    )
    kwargs.update(overrides)
    return kwargs


def test_register_builds_valid_row() -> None:
    row = register_example(**_base())
    assert len(row["id"]) == 64  # sha256 hex
    assert row["licence"]  # copied from the registry
    assert row["split"] == "eval"
    assert row["synthetic"] is True
    assert row["provenance"] == "estimated"
    assert "tenantId" not in row  # not first-party


def test_synthetic_cannot_claim_measured() -> None:
    with pytest.raises(LicenceError, match="cannot claim provenance"):
        register_example(**_base(provenance="measured"))


def test_synthetic_cannot_enter_train() -> None:
    with pytest.raises(LicenceError, match="synthetic rows may not enter a train"):
        register_example(**_base(split="train"))


def test_unknown_source_rejected_by_builder() -> None:
    with pytest.raises(LicenceError, match="unknown source"):
        register_example(**_base(source="nope"))


def test_avoid_source_rejected_in_train_by_builder() -> None:
    with pytest.raises(LicenceError, match="may not enter a train split"):
        register_example(
            **_base(source="ms-marco", split="train", provenance="measured", synthetic=False)
        )


def test_bad_provenance_rejected() -> None:
    with pytest.raises(LicenceError, match="provenance must be"):
        register_example(**_base(provenance="invented"))


def test_bad_split_rejected() -> None:
    with pytest.raises(LicenceError, match="split must be"):
        register_example(**_base(split="holdout"))


def test_first_party_requires_consent() -> None:
    with pytest.raises(LicenceError, match="consent"):
        register_example(
            **_base(
                source="vault",
                split="train",
                provenance="measured",
                synthetic=False,
                tenant_id="t1",
            )
        )


def test_first_party_requires_tenant_id() -> None:
    with pytest.raises(LicenceError, match="tenantId"):
        register_example(
            **_base(
                source="vault",
                split="train",
                provenance="measured",
                synthetic=False,
                consent=True,
            )
        )


def test_first_party_full_row_accepted() -> None:
    row = register_example(
        **_base(
            source="vault",
            split="train",
            provenance="measured",
            synthetic=False,
            consent=True,
            tenant_id="tenant-9",
        )
    )
    assert row["tenantId"] == "tenant-9"
    assert row["consent"] is True


def test_consent_must_be_true_when_present() -> None:
    with pytest.raises(LicenceError, match="consent must be true"):
        register_example(**_base(consent=False))


# ------------------------------------------------------------- helpers ------


def test_domain_hash_is_stable_and_not_the_domain() -> None:
    first = domain_hash("thenines.com")
    second = domain_hash("thenines.com")
    assert first == second
    assert len(first) == 16
    assert "thenines" not in first


def test_domain_hash_differs_per_domain() -> None:
    assert domain_hash("a.com") != domain_hash("b.com")
