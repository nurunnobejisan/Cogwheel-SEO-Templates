#!/usr/bin/env python3
"""SEO Studio — Over-the-Air (OTA) Rule Synchronization CLI.

Synchronizes and validates live keyword matrices and brand guardrails from
GitHub main, verifying integrity against local models.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path
from typing import Any

# Ensure parent directory is in sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent.parent
sys.path.insert(0, str(ROOT_DIR))

from python.scripts.models import KeywordStrategyMatrix, OtaConfig

REPO_OWNER = "nurunnobejisan"
REPO_NAME = "SEO-Studio"
RAW_BASE = f"https://raw.githubusercontent.com/{REPO_OWNER}/{REPO_NAME}/main"
REMOTE_MATRIX_URL = f"{RAW_BASE}/data/78-keyword-strategy-matrix.json"
REMOTE_OTA_URL = f"{RAW_BASE}/data/ota-config.json"


def fetch_remote_json(url: str, timeout: int = 10) -> dict[str, Any]:
    """Fetch remote JSON document with timeout and error handling.

    Args:
        url: Remote raw GitHub URL.
        timeout: Network timeout in seconds.

    Returns:
        Parsed JSON dictionary payload.

    Raises:
        urllib.error.URLError: If the remote resource cannot be reached.
    """
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "SEO-Studio-Python-OTA-Sync/2.7", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        data = response.read().decode("utf-8")
        return json.loads(data)  # type: ignore[no-any-return]


def sync_ota_rules(dry_run: bool = False) -> bool:
    """Fetch and validate live OTA rules from GitHub main.

    Args:
        dry_run: If True, tests network connectivity and validation without saving.

    Returns:
        True if sync and validation succeed, False otherwise.
    """
    print(f"Connecting to GitHub raw endpoint: {RAW_BASE}...")

    # 1. Fetch & validate OTA config
    try:
        print(f"Fetching OTA configuration: {REMOTE_OTA_URL}...")
        ota_payload = fetch_remote_json(REMOTE_OTA_URL)
        ota_config = OtaConfig(**ota_payload)
        print(f"  [OK] Validated OTA Config schema v{ota_config.schemaVersion}")
    except Exception as e:
        print(f"  [FAIL] OTA Config sync error: {e}", file=sys.stderr)
        return False

    # 2. Fetch & validate Keyword Matrix
    try:
        print(f"Fetching 78-Keyword Matrix: {REMOTE_MATRIX_URL}...")
        matrix_payload = fetch_remote_json(REMOTE_MATRIX_URL)
        matrix = KeywordStrategyMatrix(**matrix_payload)
        print(f"  [OK] Validated {len(matrix.keywords)} keywords across {len(matrix.categories)} categories")
    except Exception as e:
        print(f"  [FAIL] Keyword Matrix sync error: {e}", file=sys.stderr)
        return False

    if not dry_run:
        local_ota = ROOT_DIR / "data" / "ota-config.json"
        with open(local_ota, "w", encoding="utf-8") as f:
            json.dump(ota_payload, f, indent=2)
        print(f"Saved verified OTA configuration to: {local_ota}")

    print("\nOTA synchronization completed successfully.")
    return True


def main() -> int:
    """CLI execution entrypoint.

    Returns:
        0 on success, 1 on failure.
    """
    parser = argparse.ArgumentParser(
        description="Synchronize live hospitality SEO rules from GitHub."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate remote schemas without overwriting local files",
    )
    args = parser.parse_args()

    success = sync_ota_rules(dry_run=args.dry_run)
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
