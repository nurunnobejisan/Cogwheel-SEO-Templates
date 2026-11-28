"""The TS and Python thin-content gates must read the same shared defaults."""

import inspect
import json
from pathlib import Path

from api.content_engine import (
    CONTENT_GATE_CONFIG,
    batch_similarity_audit,
    calculate_jaccard_similarity,
)


CONFIG_PATH = Path(__file__).parent.parent.parent / "shared" / "engine" / "content-gate.json"


def test_python_defaults_match_shared_config() -> None:
    batch_params = inspect.signature(batch_similarity_audit).parameters
    assert batch_params["max_similarity"].default == CONTENT_GATE_CONFIG["maxSimilarityThreshold"]
    assert batch_params["min_words"].default == CONTENT_GATE_CONFIG["minUniqueWordCount"]

    jaccard_params = inspect.signature(calculate_jaccard_similarity).parameters
    assert jaccard_params["n"].default == CONTENT_GATE_CONFIG["ngramSize"]


def test_shared_config_matches_the_checked_in_json() -> None:
    on_disk = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    assert on_disk == CONTENT_GATE_CONFIG
    assert on_disk["maxSimilarityThreshold"] == 0.7
    assert on_disk["minUniqueWordCount"] == 250
    assert on_disk["ngramSize"] == 3
    assert len(on_disk["boilerplatePhrases"]) == 8
