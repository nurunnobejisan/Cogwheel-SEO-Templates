#!/usr/bin/env python3
"""Tests for the cleaning layer (ml/clean/).

PII stripping must match the TypeScript twin in
``src/core/training/dataset.ts``; hashing must match ``contentHash``; dedup
must be deterministic across processes.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.clean import (  # noqa: E402
    assert_no_pii,
    canonical,
    content_hash,
    is_duplicate,
    jaccard,
    minhash_signature,
    pii_counts,
    strip_pii,
)


# -------------------------------------------------------------------- PII ---


def test_email_redacted() -> None:
    out = strip_pii("contact john.doe+seo@example.co.uk today")
    assert "john.doe" not in out
    assert "[REDACTED_EMAIL]" in out


def test_phone_redacted() -> None:
    out = strip_pii("call +1 503-555-0123 or (503) 555 0123")
    assert "503-555-0123" not in out
    assert "555 0123" not in out
    assert out.count("[REDACTED_PHONE]") == 2


def test_secret_tokens_redacted() -> None:
    out = strip_pii("token sk-abcdefghijklmnop123456 leaked")
    assert "sk-abc" not in out
    assert "[REDACTED_SECRET]" in out


def test_google_api_key_redacted() -> None:
    key = "AIzaSy" + "A" * 33
    out = strip_pii(f"key {key} here")
    assert key not in out
    assert "[REDACTED_KEY]" in out


def test_nested_structures_stripped_in_place() -> None:
    payload = {
        "a": ["mail me at jane@foo.com", {"b": "ring +1 503-555-0199"}],
        "c": 42,
        "d": None,
    }
    out = strip_pii(payload)
    assert "jane@foo.com" not in repr(out)
    assert "503-555-0199" not in repr(out)
    # structure preserved
    assert out["c"] == 42
    assert out["d"] is None
    assert isinstance(out["a"][1], dict)


def test_non_string_values_pass_through() -> None:
    assert strip_pii(123) == 123
    assert strip_pii(True) is True
    assert strip_pii(None) is None


def test_assert_no_pii_passes_on_clean_data() -> None:
    assert_no_pii({"text": "a perfectly ordinary sentence"})


def test_assert_no_pii_raises_on_dirty_data() -> None:
    with pytest.raises(ValueError, match="PII still present"):
        assert_no_pii({"text": "reach me at a@b.com"})


def test_pii_counts_zero_after_strip() -> None:
    key = "AIzaSy" + "B" * 33
    pem = "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----"
    dirty = {
        "to": "a@b.com",
        "tel": "+1 503-555-0100",
        "key": "sk-abcdefghijklmnop123456",
        "google": key,
        "pem": pem,
    }
    assert all(v > 0 for v in pii_counts(dirty).values())
    assert all(v == 0 for v in pii_counts(strip_pii(dirty)).values())


# ------------------------------------------------------------ canonicalisation


def test_canonical_sorts_object_keys() -> None:
    assert canonical({"b": 1, "a": 2}) == canonical({"a": 2, "b": 1})


def test_canonical_preserves_array_order() -> None:
    assert canonical([1, 2]) != canonical([2, 1])


def test_canonical_handles_scalars() -> None:
    assert canonical(None) == "null"
    assert canonical(True) == "true"
    assert canonical(False) == "false"
    assert canonical(3) == "3"
    assert canonical("x") == '"x"'


def test_content_hash_is_order_insensitive_and_stable() -> None:
    first = content_hash({"b": 2, "a": 1}, "fix")
    second = content_hash({"a": 1, "b": 2}, "fix")
    assert first == second
    assert len(first) == 64


def test_content_hash_differs_on_different_input() -> None:
    assert content_hash({"a": 1}, "x") != content_hash({"a": 1}, "y")
    assert content_hash({"a": 1}, "x") != content_hash({"a": 2}, "x")


# ----------------------------------------------------------------- MinHash ---


def test_signature_is_deterministic() -> None:
    text = "The Nines, a Luxury Collection Hotel in downtown Portland"
    assert minhash_signature(text) == minhash_signature(text)


def test_identical_text_scores_one() -> None:
    text = "Deluxe King Room, 320 sq ft, city view"
    a = minhash_signature(text)
    b = minhash_signature(text)
    assert jaccard(a, b) == 1.0


def test_unrelated_text_scores_low() -> None:
    a = minhash_signature("Luxury hotel with spa and rooftop bar in Portland")
    b = minhash_signature("Quarterly earnings rose on strong semiconductor demand")
    assert jaccard(a, b) < 0.3


def test_near_duplicate_detected() -> None:
    original = "Grand Palisade Hotel offers deluxe rooms, a pool and a restaurant in Portland."
    known = [minhash_signature(original)]
    near = "Grand Palisade Hotel offers deluxe rooms, a pool and a restaurant in Portland"
    duplicate, score = is_duplicate(near, known)
    assert duplicate is True
    assert score >= 0.9


def test_distinct_text_not_flagged() -> None:
    known = [minhash_signature("Luxury hotel downtown Portland with restaurant")]
    duplicate, score = is_duplicate("Contact our sales team about enterprise pricing", known)
    assert duplicate is False
    assert score < 0.9


def test_empty_text_has_zero_signature() -> None:
    assert minhash_signature("") == [0] * 128


def test_short_text_still_produces_signature() -> None:
    sig = minhash_signature("spa")
    assert len(sig) == 128
    assert any(v != 0 for v in sig)


def test_num_perm_is_respected() -> None:
    assert len(minhash_signature("hello world", num_perm=64)) == 64


def test_invalid_num_perm_raises() -> None:
    with pytest.raises(ValueError, match="num_perm"):
        minhash_signature("x", num_perm=0)


def test_jaccard_mismatched_lengths_is_zero() -> None:
    assert jaccard([1, 2], [1, 2, 3]) == 0.0
    assert jaccard([], []) == 0.0
