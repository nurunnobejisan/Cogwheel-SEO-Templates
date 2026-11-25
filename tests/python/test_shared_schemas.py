"""Parity between the materialized JSON Schemas and the Python models.

`shared/schemas/*.json` is exported from the TypeScript Zod contracts. The
Python API (`api/models.py`) must expose the same field names, required fields
and primitive defaults, otherwise a payload accepted by one runtime can be
rejected by the other.

The models are parsed with `ast` so this test runs with or without Pydantic
installed in the local environment.
"""

from __future__ import annotations

import ast
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SCHEMA_DIR = ROOT / "shared" / "schemas"
MODELS_PATH = ROOT / "api" / "models.py"

MODEL_TO_SCHEMA = {
    "DestinationGuideModel": "destination-guide.schema.json",
    "RoomShowcaseModel": "room-showcase.schema.json",
    "HotelFaqModel": "hotel-faq.schema.json",
    "PageMetadataModel": "page-metadata.schema.json",
    "SiteManifestItemModel": "site-manifest.schema.json",
}

_REQUIRED = object()


def load_model_classes() -> dict[str, ast.ClassDef]:
    tree = ast.parse(MODELS_PATH.read_text(encoding="utf-8"), filename=str(MODELS_PATH))
    return {node.name: node for node in tree.body if isinstance(node, ast.ClassDef)}


def load_schema_object(file_name: str) -> dict:
    schema = json.loads((SCHEMA_DIR / file_name).read_text(encoding="utf-8"))
    if schema.get("type") == "array":
        schema = schema["items"]
    return schema


def python_fields(model: ast.ClassDef) -> dict[str, object]:
    """Return field name -> default marker.

    ``_REQUIRED`` distinguishes a required field from one whose default is
    literally ``None`` (PageMetadata.focusKeyword).
    """

    fields: dict[str, object] = {}
    for node in model.body:
        if not isinstance(node, ast.AnnAssign):
            continue
        name = node.target.id
        if node.value is None:
            fields[name] = _REQUIRED
            continue
        try:
            fields[name] = ast.literal_eval(node.value)
        except (ValueError, TypeError):
            fields[name] = _REQUIRED
    return fields


@pytest.mark.parametrize("model_name,schema_file", sorted(MODEL_TO_SCHEMA.items()))
def test_python_model_matches_exported_schema(model_name: str, schema_file: str) -> None:
    classes = load_model_classes()
    assert model_name in classes, f"{model_name} is missing from api/models.py"

    schema = load_schema_object(schema_file)
    properties = schema.get("properties", {})
    schema_required = set(schema.get("required", []))

    fields = python_fields(classes[model_name])
    py_required = {name for name, default in fields.items() if default is _REQUIRED}

    assert set(fields) == set(properties), (
        f"{model_name} fields differ from {schema_file}: "
        f"python-only={sorted(set(fields) - set(properties))}, "
        f"schema-only={sorted(set(properties) - set(fields))}"
    )
    assert py_required == schema_required, (
        f"{model_name} required fields differ from {schema_file}: "
        f"python-only={sorted(py_required - schema_required)}, "
        f"schema-only={sorted(schema_required - py_required)}"
    )

    for name, prop in properties.items():
        if "default" in prop and name in fields:
            assert fields[name] == prop["default"], (
                f"{model_name}.{name} default {fields[name]!r} does not match "
                f"schema default {prop['default']!r}"
            )
