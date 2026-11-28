"""Constrained JSON-schema decoding via ``outlines`` (WP7).

Loads the canonical JSON Schema files exported by ``npm run export:json-schemas``
from ``schemas/`` (`ml-schema-generation.schema.json` and
`ml-metadata-generation.schema.json`) so there is no second hand-written schema.

``outlines`` is imported lazily inside :func:`generate_structured` so CI stays
stdlib-only (D-014); when absent, calling generation raises :class:`HeavyDepsError`.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable, Dict, Mapping, Optional

from ml.train.errors import HeavyDepsError

__all__ = [
    "SUPPORTED_TASKS",
    "load_task_json_schema",
    "build_json_schema_response_format",
    "generate_structured",
]

REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMAS_DIR = REPO_ROOT / "schemas"

SCHEMA_FILES: Dict[str, Path] = {
    "schema_generation": SCHEMAS_DIR / "ml-schema-generation.schema.json",
    "metadata_generation": SCHEMAS_DIR / "ml-metadata-generation.schema.json",
}

SUPPORTED_TASKS = tuple(SCHEMA_FILES.keys())


def load_task_json_schema(task: str) -> Dict[str, Any]:
    """Load the exported JSON Schema contract for a v1 adapter ``task``."""
    path = SCHEMA_FILES.get(task)
    if path is None:
        supported = ", ".join(SUPPORTED_TASKS)
        raise ValueError(f"unsupported constrained task {task!r}; expected one of: {supported}")
    if not path.is_file():
        raise FileNotFoundError(
            f"missing exported JSON Schema {path}; run `npm run export:json-schemas`"
        )
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"{path} did not contain a JSON object")
    return payload


def build_json_schema_response_format(task: str) -> Dict[str, Any]:
    """Return an OpenAI-compatible ``response_format`` dict for ``task``."""
    schema = load_task_json_schema(task)
    return {
        "type": "json_schema",
        "json_schema": {
            "name": f"seo_studio_{task}",
            "strict": False,
            "schema": schema,
        },
    }


def _import_outlines():
    try:
        import outlines  # type: ignore[import-not-found]
    except ImportError as exc:
        raise HeavyDepsError("outlines (constrained JSON decoding)") from exc
    return outlines


def generate_structured(
    prompt: str,
    *,
    task: str,
    model: Any = None,
    max_tokens: int = 1024,
    outlines_factory: Optional[Callable[[Any, str], Callable[..., Any]]] = None,
) -> str:
    """Decode ``prompt`` constrained to ``task``'s exported JSON Schema."""
    schema = load_task_json_schema(task)
    schema_text = json.dumps(schema, separators=(",", ":"))

    if outlines_factory is not None:
        generator = outlines_factory(model, schema_text)
    else:
        outlines_mod = _import_outlines()
        if model is None:
            raise ValueError("model must be provided when using live outlines decoding")
        generator = outlines_mod.generate.json(model, schema_text)

    result = generator(prompt, max_tokens=max_tokens)
    if isinstance(result, str):
        return result
    if hasattr(result, "model_dump"):
        return json.dumps(result.model_dump(), ensure_ascii=False)
    if isinstance(result, Mapping):
        return json.dumps(dict(result), ensure_ascii=False)
    return json.dumps(result, ensure_ascii=False)
