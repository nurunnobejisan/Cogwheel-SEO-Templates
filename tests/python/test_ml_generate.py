"""Tests for WP7 schema-constrained decoding (ml/generate and server wiring)."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from typing import Any, Dict

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.generate import (  # noqa: E402
    SUPPORTED_TASKS,
    build_json_schema_response_format,
    generate_structured,
    load_task_json_schema,
)
from ml.serve.registry import load_registry  # noqa: E402
from ml.serve.server import ModelGateway, ServeConfig  # noqa: E402
from ml.train.errors import HeavyDepsError  # noqa: E402


def test_load_task_json_schemas_from_exported_files() -> None:
    assert set(SUPPORTED_TASKS) == {"schema_generation", "metadata_generation"}

    schema_json = load_task_json_schema("schema_generation")
    assert schema_json["title"] == "MlSchemaGenerationOutput"
    serialized = json.dumps(schema_json)
    assert "Hotel" in serialized
    assert "FAQPage" in serialized

    meta_json = load_task_json_schema("metadata_generation")
    assert meta_json["title"] == "MlMetadataGenerationOutput"
    assert meta_json["properties"]["title"]["maxLength"] == 60
    assert meta_json["properties"]["metaDescription"]["maxLength"] == 160

    with pytest.raises(ValueError, match="unsupported constrained task"):
        load_task_json_schema("rag_synthesis")


def test_build_json_schema_response_format_shape() -> None:
    fmt = build_json_schema_response_format("metadata_generation")
    assert fmt["type"] == "json_schema"
    assert fmt["json_schema"]["name"] == "seo_studio_metadata_generation"
    assert fmt["json_schema"]["schema"]["properties"]["title"]["maxLength"] == 60


@pytest.mark.skipif(
    importlib.util.find_spec("outlines") is not None,
    reason="outlines installed locally — lazy missing-dep path skipped",
)
def test_generate_structured_raises_heavy_deps_without_outlines() -> None:
    with pytest.raises(HeavyDepsError, match="ml/requirements-ml.txt"):
        generate_structured("Generate Hotel JSON-LD", task="schema_generation", model=object())


def test_generate_structured_with_mock_outlines_factory() -> None:
    captured: Dict[str, Any] = {}

    def fake_factory(model: Any, schema_text: str):
        captured["model"] = model
        captured["schema"] = json.loads(schema_text)

        def run(prompt: str, max_tokens: int = 1024):
            captured["prompt"] = prompt
            captured["max_tokens"] = max_tokens
            return {"title": "Grand Hotel — Downtown", "metaDescription": "Stay direct at Grand Hotel."}

        return run

    out = generate_structured(
        "Write metadata",
        task="metadata_generation",
        model="mock-model",
        max_tokens=256,
        outlines_factory=fake_factory,
    )
    parsed = json.loads(out)
    assert parsed["title"] == "Grand Hotel — Downtown"
    assert captured["schema"]["title"] == "MlMetadataGenerationOutput"
    assert captured["max_tokens"] == 256


def test_gateway_attaches_constrained_response_format_for_v1_tasks(tmp_path: Path) -> None:
    registry = load_registry()
    reg_copy = dict(registry)
    reg_copy["activeModelId"] = "seo-studio-qwen-v1"
    reg_copy["models"] = [
        {
            "modelId": "seo-studio-qwen-v1",
            "baseModel": "Qwen/Qwen3-1.7B",
            "status": "ready",
            "aliases": [],
        }
    ]
    reg_path = tmp_path / "model_registry.json"
    reg_path.write_text(json.dumps(reg_copy), encoding="utf-8")

    seen_payloads: list[Dict[str, Any]] = []

    def fake_fetch(_url: str, payload: Dict[str, Any], _headers: Dict[str, str]) -> Dict[str, Any]:
        seen_payloads.append(payload)
        return {
            "status": 200,
            "body": {
                "choices": [{"message": {"content": '{"@context":"https://schema.org","@type":"Hotel"}'}}]
            },
        }

    gateway = ModelGateway(
        ServeConfig(
            registry_path=str(reg_path),
            upstream="https://infer.example.com/v1",
            fetch_impl=fake_fetch,
        )
    )
    res = gateway.chat(
        {
            "model": "seo-studio-qwen-v1",
            "task": "schema_generation",
            "messages": [{"role": "user", "content": "Emit JSON-LD"}],
        }
    )
    assert res["model"] == "seo-studio-qwen-v1"
    assert seen_payloads[0]["response_format"]["type"] == "json_schema"
    assert seen_payloads[0]["response_format"]["json_schema"]["name"] == "seo_studio_schema_generation"

    # Untyped call leaves response_format absent.
    gateway.chat(
        {
            "model": "seo-studio-qwen-v1",
            "messages": [{"role": "user", "content": "Regular call"}],
        }
    )
    assert "response_format" not in seen_payloads[1]
