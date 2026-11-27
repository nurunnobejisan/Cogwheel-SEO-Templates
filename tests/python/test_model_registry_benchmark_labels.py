#!/usr/bin/env python3
"""Registry benchmark numbers must be labelled, never presented as measured.

`data/models/model_registry.json` stores a lexical-proxy benchmark (D-013).
Nothing in the product may show those numbers as accuracy, and every entry
carries `provenance` / `measured` / `note` so a reader cannot mistake them for
a golden-set evaluation.
"""

from __future__ import annotations

import json
from pathlib import Path

from python.scripts.train_unified_model import BENCHMARK_NOTE, run_eval_benchmark

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
REGISTRY_FILE = REPO_ROOT / "data" / "models" / "model_registry.json"


def _models() -> list[dict]:
    payload = json.loads(REGISTRY_FILE.read_text(encoding="utf-8"))
    models = payload.get("models")
    assert isinstance(models, list) and models, "registry must contain at least one model"
    return models


def test_every_registry_entry_labels_its_benchmark() -> None:
    for entry in _models():
        model_id = entry["modelId"]
        benchmark = entry["evaluationBenchmark"]
        assert benchmark["provenance"] == "lexical-proxy", model_id
        assert benchmark["measured"] is False, model_id
        assert "not a model-quality measurement" in benchmark["note"], model_id
        # An unlabelled benchmark would only ever be reachable from an
        # unverified entry; a measured run is what earns "ready".
        assert entry["status"] in {"unverified", "ready"}, model_id
        if benchmark["measured"] is False:
            assert entry["status"] != "ready", f"{model_id} serves an unmeasured benchmark"


def test_benchmark_output_carries_the_label() -> None:
    empty = run_eval_benchmark([])
    assert empty["provenance"] == "lexical-proxy"
    assert empty["measured"] is False
    assert empty["note"] == BENCHMARK_NOTE

    sample = [
        {
            "messages": [
                {"role": "user", "content": "Fix this page"},
                {
                    "role": "assistant",
                    "content": "### Recommended fix\nAdd JSON-LD schema and keep the title to 55 characters.",
                },
            ]
        }
    ]
    measured_looking = run_eval_benchmark(sample)
    # Even a perfect lexical-proxy run stays labelled as unmeasured.
    assert measured_looking["overallScore"] == 100.0
    assert measured_looking["provenance"] == "lexical-proxy"
    assert measured_looking["measured"] is False
    assert "not a model-quality measurement" in measured_looking["note"]
