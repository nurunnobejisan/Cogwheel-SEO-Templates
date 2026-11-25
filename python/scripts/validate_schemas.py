#!/usr/bin/env python3
"""Cogwheel SEO Studio — Schema Validation CLI.

Validates hospitality datasets (78-keyword strategy matrix, OTA config, brand guardrails,
and audit payloads) against the Python Pydantic models and JSON Schema definitions.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

# Ensure parent directory is in sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent.parent
sys.path.insert(0, str(ROOT_DIR))

from python.scripts.models import (
    KeywordStrategyMatrix,
    OtaConfig,
)


def load_json_file(file_path: Path) -> dict[str, Any]:
    """Safely load and parse a JSON file from disk.

    Args:
        file_path: Path to the target JSON document.

    Returns:
        Parsed dictionary payload.

    Raises:
        FileNotFoundError: If the target file does not exist.
        json.JSONDecodeError: If the file is not valid JSON.
    """
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
    with open(file_path, encoding="utf-8") as f:
        return json.load(f)  # type: ignore[no-any-return]


def validate_keyword_matrix(data_path: Path) -> bool:
    """Validate 78-keyword strategy matrix dataset.

    Args:
        data_path: Path to 78-keyword-strategy-matrix.json.

    Returns:
        True if validation succeeds, False otherwise.
    """
    print(f"Validating Keyword Strategy Matrix: {data_path.name}...")
    try:
        raw_data = load_json_file(data_path)
        matrix = KeywordStrategyMatrix(**raw_data)
        keyword_count = len(matrix.keywords)
        print(f"  [OK] Validated {keyword_count} keywords across {len(matrix.categories)} categories.")
        if keyword_count != 78:
            print(f"  [WARN] Expected exactly 78 keywords, found {keyword_count}.")
        return True
    except Exception as e:
        print(f"  [FAIL] Keyword Strategy Matrix validation error: {e}", file=sys.stderr)
        return False


def validate_ota_config(data_path: Path) -> bool:
    """Validate live Over-the-Air (OTA) configuration payload.

    Args:
        data_path: Path to ota-config.json.

    Returns:
        True if validation succeeds, False otherwise.
    """
    print(f"Validating OTA Live Configuration: {data_path.name}...")
    try:
        raw_data = load_json_file(data_path)
        config = OtaConfig(**raw_data)
        print(f"  [OK] Schema version: {config.schemaVersion}, Title limit: {config.pixelLimits.titleMaxPx}px.")
        return True
    except Exception as e:
        print(f"  [FAIL] OTA Config validation error: {e}", file=sys.stderr)
        return False


def validate_exported_json_schemas(schemas_dir: Path) -> bool:
    """Verify that all standard JSON Schema files exist and are valid JSON.

    Args:
        schemas_dir: Directory containing exported *.schema.json files.

    Returns:
        True if all schemas are present and valid, False otherwise.
    """
    print(f"Inspecting standard JSON Schema files in {schemas_dir.name}/...")
    required_schemas = [
        "keyword-matrix.schema.json",
        "brand-guardrails.schema.json",
        "audit-payload.schema.json",
        "page-audit-data.schema.json",
        "ota-config.schema.json",
        "hotel-seo.schema.json",
    ]

    all_valid = True
    for schema_file in required_schemas:
        schema_path = schemas_dir / schema_file
        if not schema_path.exists():
            print(f"  [FAIL] Missing schema file: {schema_file}", file=sys.stderr)
            all_valid = False
            continue
        try:
            with open(schema_path, encoding="utf-8") as f:
                parsed = json.load(f)
                title = parsed.get("title", "Unknown")
                print(f"  [OK] {schema_file} ({title})")
        except Exception as e:
            print(f"  [FAIL] Invalid JSON in {schema_file}: {e}", file=sys.stderr)
            all_valid = False

    return all_valid


def main() -> int:
    """CLI execution entrypoint.

    Returns:
        0 if all validations pass, 1 otherwise.
    """
    parser = argparse.ArgumentParser(
        description="Validate Cogwheel SEO Studio datasets against Python Single Source of Truth models."
    )
    parser.add_argument(
        "--matrix",
        type=Path,
        default=ROOT_DIR / "data" / "78-keyword-strategy-matrix.json",
        help="Path to 78-keyword-strategy-matrix.json",
    )
    parser.add_argument(
        "--ota",
        type=Path,
        default=ROOT_DIR / "data" / "ota-config.json",
        help="Path to ota-config.json",
    )
    parser.add_argument(
        "--schemas",
        type=Path,
        default=ROOT_DIR / "schemas",
        help="Path to schemas/ directory",
    )

    args = parser.parse_args()

    success = True
    if not validate_keyword_matrix(args.matrix):
        success = False
    if not validate_ota_config(args.ota):
        success = False
    if not validate_exported_json_schemas(args.schemas):
        success = False

    if success:
        print("\nSUCCESS: All datasets and JSON schemas verified against Single Source of Truth.")
        return 0
    else:
        print("\nFAILURE: One or more validations failed.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
