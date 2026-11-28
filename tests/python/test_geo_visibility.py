"""Tests for geo_visibility (Bangla AI visibility)."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import json
import yaml

from python.geo_visibility.normalize import normalize_text
from python.geo_visibility.mentions import detect_mentions
from python.geo_visibility.providers import RecordedProvider
from python.geo_visibility.runner import run_visibility


def test_normalize_text_fallback():
    # Should not crash even if banglish-normalizer unavailable.
    assert isinstance(normalize_text("Ami Bhalo Achi"), str)


def test_detect_mentions_mentioned():
    from python.geo_visibility.providers import Answer
    ans = Answer(text="Pan Pacific Sonargaon is a top pick.", citations=["panpacific.com"])
    m = detect_mentions(ans, "Pan Pacific Sonargaon Dhaka", "panpacific.com",
                        {"en": ["Pan Pacific Sonargaon"]})
    assert m.mentioned is True
    assert m.cited is True


def test_detect_mentions_not_mentioned():
    from python.geo_visibility.providers import Answer
    ans = Answer(text="No hotels mentioned here.", citations=[])
    m = detect_mentions(ans, "Pan Pacific Sonargaon Dhaka", "panpacific.com", {})
    assert m.mentioned is False


def test_run_visibility_recorded():
    root = Path(__file__).parent.parent.parent
    intents = yaml.safe_load((root / "src/packs/bangladesh-hotels/queries.yaml").read_text())["intents"][:2]
    entities = yaml.safe_load((root / "src/packs/bangladesh-hotels/entities.yaml").read_text())["entities"][:1]
    fixture = json.loads((root / "data/geo_visibility/recorded_answers.json").read_text())
    provider = RecordedProvider(name="recorded", fixture=fixture)
    results = run_visibility(provider, intents, entities, n=2)
    assert len(results) == 2 * 3 * 2  # 2 intents x 3 langs x 2 runs
    for r in results:
        assert r.provider == "recorded"
        assert r.answer_text
        assert "Pan Pacific Sonargaon Dhaka" in r.mentions
