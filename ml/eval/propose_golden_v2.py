"""Propose unreviewed Golden v2 evaluation candidates from held-out hosts (WP9).

Reads held-out / eval-split records and writes unreviewed candidate cases for
human inspection under gitignored ``data/build/golden-v2-candidates.jsonl``.
Every candidate carries ``humanReviewed: false`` and NEVER mutates the frozen
v1 set (``ml/eval/golden/cases.jsonl``) or promotes itself automatically.

Standard library + existing ``ml/`` helpers only (D-014).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

from ml.eval.run_eval import check_jsonld_valid, check_title_budget
from ml.registry import load_registry
from ml.train.build_sft import assign_host_split, extract_registrable_host, load_golden_hosts
from ml.train.dataset import DEFAULT_GOLDEN

__all__ = [
    "DEFAULT_CANDIDATES_OUT",
    "TARGET_PER_TASK",
    "propose_candidates",
    "main",
]

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CANDIDATES_OUT = REPO_ROOT / "data" / "build" / "golden-v2-candidates.jsonl"
DEFAULT_SFT_V2 = REPO_ROOT / "data" / "build" / "sft-v2.jsonl"
TARGET_PER_TASK = 75
V1_TASKS = ("schema_generation", "metadata_generation")


def _extract_input_output(row: Mapping[str, Any]) -> Tuple[Dict[str, Any], Any, str, str]:
    messages = row.get("messages")
    meta = row.get("meta") if isinstance(row.get("meta"), Mapping) else row.get("metadata")
    meta = meta if isinstance(meta, Mapping) else {}
    task = str(row.get("task") or meta.get("task") or meta.get("category") or "").strip()
    source = str(row.get("source") or meta.get("source") or "").strip()

    if isinstance(messages, list) and len(messages) == 3:
        user_raw = str(messages[1].get("content") or "")
        asst_raw = str(messages[2].get("content") or "")
        try:
            row_input = json.loads(user_raw)
            if not isinstance(row_input, Mapping):
                row_input = {"text": user_raw}
        except json.JSONDecodeError:
            row_input = {"text": user_raw}
        try:
            output = json.loads(asst_raw)
        except json.JSONDecodeError:
            output = asst_raw
        return dict(row_input), output, task, source

    row_input = dict(row.get("input") or {})
    if "url" in row and "url" not in row_input:
        row_input["url"] = row["url"]
    return row_input, row.get("output"), task, source


def _load_train_hosts(path: Optional[Path]) -> Tuple[set, set]:
    hosts: set = set()
    hashes: set = set()
    if path is None or not path.is_file():
        return hosts, hashes
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        row = json.loads(line)
        meta = row.get("meta") if isinstance(row.get("meta"), Mapping) else row.get("metadata") or {}
        split = meta.get("split") or row.get("split")
        if split != "train":
            continue
        if meta.get("hostHash"):
            hashes.add(str(meta["hostHash"]).lower())
        if meta.get("domainHash"):
            hashes.add(str(meta["domainHash"]).lower())
        url = (row.get("input") or {}).get("url") or row.get("url") or ""
        reg = extract_registrable_host(str(url))
        if reg:
            hosts.add(reg)
    return hosts, hashes


def propose_candidates(
    rows: Iterable[Mapping[str, Any]],
    *,
    train_path: Optional[Path] = DEFAULT_SFT_V2,
    frozen_golden_path: Path = DEFAULT_GOLDEN,
    max_per_task: int = TARGET_PER_TASK,
) -> List[Dict[str, Any]]:
    """Build unreviewed Golden v2 candidates strictly disjoint from train & frozen golden."""
    registry = load_registry()
    golden_hosts, golden_hashes = load_golden_hosts(frozen_golden_path)
    train_hosts, train_hashes = _load_train_hosts(train_path)

    counts = {task: 0 for task in V1_TASKS}
    seen_ids: set = set()
    candidates: List[Dict[str, Any]] = []
    now_iso = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    for row in rows:
        meta = row.get("meta") if isinstance(row.get("meta"), Mapping) else row.get("metadata") or {}
        if meta.get("split") == "train" or row.get("split") == "train":
            continue

        row_input, output, task, source = _extract_input_output(row)
        if task not in V1_TASKS or counts[task] >= max_per_task:
            continue
        if not source:
            continue
        try:
            entry = registry.require(source)
        except Exception:
            continue
        if entry.use == "avoid":
            continue

        url = str(row_input.get("url") or "").strip()
        reg_host = extract_registrable_host(url)
        raw_hash = str(meta.get("hostHash") or row_input.get("domainHash") or "").strip().lower()
        if not reg_host and not raw_hash:
            continue
        _, computed_hash = assign_host_split(reg_host or raw_hash)
        domain_hash = raw_hash or computed_hash

        if reg_host in golden_hosts or domain_hash in golden_hashes:
            continue
        if reg_host in train_hosts or domain_hash in train_hashes:
            continue

        if task == "schema_generation":
            status, _ = check_jsonld_valid(output)
            if status != "pass":
                continue
            checks = ["jsonld_valid", "grounding"]
        else:
            if not isinstance(output, Mapping):
                continue
            status, _ = check_title_budget(output)
            if status != "pass":
                continue
            checks = ["title_budget", "grounding"]

        measured = row_input.get("measured")
        safe_input: Dict[str, Any] = {
            "domainHash": domain_hash,
            "measured": measured if isinstance(measured, Mapping) else {},
        }
        if url.startswith(("http://", "https://")):
            safe_input["url"] = url
        if isinstance(row_input.get("text"), str) and row_input["text"].strip():
            safe_input["text"] = row_input["text"].strip()

        case_id = hashlib.sha256(
            f"{task}\n{json.dumps(safe_input, sort_keys=True)}".encode("utf-8")
        ).hexdigest()
        if case_id in seen_ids:
            continue
        seen_ids.add(case_id)

        candidates.append(
            {
                "id": case_id,
                "task": task,
                "input": safe_input,
                "output": output,
                "provenance": "estimated",
                "source": source,
                "licence": entry.licence,
                "synthetic": True,
                "split": "eval",
                "createdAt": now_iso,
                "checks": checks,
                "humanReviewed": False,
                "reviewStatus": "pending_human_review",
                "note": "UNREVIEWED CANDIDATE — verify grounding, schema types, and budgets before promoting with humanReviewed=true.",
            }
        )
        counts[task] += 1

    return candidates


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Propose held-out Golden v2 candidate cases")
    parser.add_argument("--in", dest="input_path", type=Path, required=True)
    parser.add_argument("--out", type=Path, default=DEFAULT_CANDIDATES_OUT)
    parser.add_argument("--train-file", type=Path, default=DEFAULT_SFT_V2)
    parser.add_argument("--golden", type=Path, default=DEFAULT_GOLDEN)
    parser.add_argument("--max-per-task", type=int, default=TARGET_PER_TASK)
    args = parser.parse_args(list(argv) if argv is not None else None)

    if not args.input_path.is_file():
        print(f"error: input file not found: {args.input_path}", file=sys.stderr)
        return 1

    rows = [
        json.loads(line)
        for line in args.input_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    candidates = propose_candidates(
        rows,
        train_path=args.train_file,
        frozen_golden_path=args.golden,
        max_per_task=args.max_per_task,
    )

    args.out.parent.mkdir(parents=True, exist_ok=True)
    payload = "\n".join(json.dumps(c, ensure_ascii=False, sort_keys=True) for c in candidates)
    args.out.write_text((payload + "\n") if payload else "", encoding="utf-8")
    print(f"wrote {len(candidates)} unreviewed candidate(s) -> {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
