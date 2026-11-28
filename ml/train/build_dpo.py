"""DPO pair builder (v2 WP2).

Builds gitignored ``data/build/dpo-v2.jsonl`` plus
``data/build/dpo-v2.report.json`` from three first-party feedback sources:

1. **healing decisions** — ``data/ml-review/healing-decisions.jsonl``:
   approved vs rejected fix patches recorded by the healing pipeline
   (source id ``patches``).
2. **vault decisions** — ``data/ml-review/vault-decisions.jsonl``:
   approve/reject pairs exported from the extension training vault
   (source id ``vault``).
3. **review-queue shadow disagreements** — ``data/ml-review-queue.jsonl``
   (v2 WP1 store): rows with ``source: "shadow_disagreement"`` that a human
   **approved**; ``chosen`` is the approved output and ``rejected`` the
   original candidate (source id ``triples``).

Producer decision records carry ``input``, ``output`` and
``decision: "approved" | "rejected"``; the builder groups them by a stable
input fingerprint and pairs one approved with one rejected record per input.
Unpaired decisions carry no preference signal and are counted, never used.

Every pair passes the same gates as ``ml/train/dpo.py`` and
``ml/train/build_sft.py``:

- licence registry gate on the declared source (rule 3);
- first-party sources require ``consent is True`` + ``tenantId``;
- the synthetic ban — ``synthetic: true`` without explicit human review never
  trains (D-026);
- ``chosen == rejected`` pairs are refused;
- PII stripped from prompt/chosen/rejected;
- golden-set content refused, and golden-set **hosts** excluded so eval hosts
  never enter the train split;
- deterministic 90/10 host split via ``build_sft.assign_host_split``.

The 2000-pair gate applies downstream at training time (``dpo.py``); this
builder only reports counts. Standard library + existing ``ml/`` helpers only
(D-014).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter
from collections.abc import Iterable, Mapping, Sequence
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from ml.clean.pii import strip_pii
from ml.registry import load_registry

from .build_sft import (
    assign_host_split,
    extract_registrable_host,
    load_golden_hosts,
)
from .config import FIRST_PARTY_SOURCES
from .dataset import DEFAULT_GOLDEN, _refuses_golden, golden_fingerprints
from .errors import DatasetError

__all__ = [
    "DEFAULT_OUT",
    "DEFAULT_REPORT",
    "REVIEW_QUEUE_FILE",
    "PRODUCER_FILES",
    "SOURCE_FOR_ORIGIN",
    "DecisionRecord",
    "load_decision_records",
    "pair_decisions",
    "build_dpo_v2",
    "main",
]

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = REPO_ROOT / "data" / "build" / "dpo-v2.jsonl"
DEFAULT_REPORT = REPO_ROOT / "data" / "build" / "dpo-v2.report.json"
REVIEW_QUEUE_FILE = REPO_ROOT / "data" / "ml-review-queue.jsonl"

PRODUCER_FILES: dict[str, Path] = {
    "healing": REPO_ROOT / "data" / "ml-review" / "healing-decisions.jsonl",
    "vault": REPO_ROOT / "data" / "ml-review" / "vault-decisions.jsonl",
}

#: Licence-registry source id each origin declares.
SOURCE_FOR_ORIGIN: dict[str, str] = {
    "healing": "patches",
    "vault": "vault",
    "review_queue": "triples",
}

VALID_DECISIONS = frozenset({"approved", "rejected"})


class DecisionRecord(dict[str, Any]):
    """One producer decision: an input plus one output and its human decision."""


def _input_fingerprint(input_value: Any) -> str:
    return hashlib.sha256(
        json.dumps(input_value, sort_keys=True, ensure_ascii=False, default=str).encode("utf-8")
    ).hexdigest()


def _meta_of(raw: Mapping[str, Any]) -> Mapping[str, Any]:
    meta = raw.get("metadata")
    return meta if isinstance(meta, Mapping) else {}


def _read_jsonl(path: Path) -> list[Mapping[str, Any]]:
    if not path.is_file():
        return []
    rows: list[Mapping[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            parsed = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, Mapping):
            rows.append(parsed)
    return rows


def load_decision_records(
    producer_files: Mapping[str, Path] = PRODUCER_FILES,
    review_queue_path: Path = REVIEW_QUEUE_FILE,
) -> tuple[list[tuple[str, DecisionRecord]], Counter]:
    """Load decision records from every producer, returning ``(records, skipped)``.

    ``records`` items are ``(origin, record)``. Producer decision files yield
    one record per line; the review queue yields only **approved**
    ``shadow_disagreement`` rows (a rejected row never becomes a train row;
    a pending row is not yet a human decision).
    """
    skipped: Counter = Counter()
    records: list[tuple[str, DecisionRecord]] = []

    for origin, path in producer_files.items():
        for raw in _read_jsonl(path):
            decision = str(raw.get("decision") or "").strip().lower()
            if decision not in VALID_DECISIONS:
                skipped[f"{origin}:invalid_decision"] += 1
                continue
            if raw.get("input") is None or raw.get("output") is None:
                skipped[f"{origin}:missing_input_or_output"] += 1
                continue
            records.append((origin, DecisionRecord(raw)))

    for raw in _read_jsonl(review_queue_path):
        source = str(raw.get("source") or "").strip()
        if source != "shadow_disagreement":
            continue
        if raw.get("reviewed") is not True:
            skipped["review_queue:pending_or_unreviewed"] += 1
            continue
        if raw.get("decision") != "approved":
            # Rejected rows are structurally excluded: they can never
            # become a train row.
            skipped["review_queue:rejected_row"] += 1
            continue
        record = DecisionRecord(
            {
                "input": raw.get("input"),
                "output": raw.get("output") if raw.get("output") is not None else raw.get("candidateOutput"),
                "rejectedOutput": raw.get("originalOutput") or raw.get("candidateOutput"),
                "decision": "approved",
                "consent": _meta_of(raw).get("consent", raw.get("consent")),
                "tenantId": _meta_of(raw).get("tenantId", raw.get("tenantId")),
                "url": (raw.get("input") or {}).get("url") if isinstance(raw.get("input"), Mapping) else None,
                "task": raw.get("task"),
                "synthetic": False,
            }
        )
        if record["output"] is None or record["rejectedOutput"] is None:
            skipped["review_queue:missing_output"] += 1
            continue
        records.append(("review_queue", record))

    return records, skipped


def pair_decisions(
    records: Sequence[tuple[str, DecisionRecord]],
) -> tuple[list[dict[str, Any]], Counter]:
    """Group decisions by input fingerprint and emit one pair per matched input.

    Each pair is ``{"origin", "input", "chosen", "rejected", "record"}`` where
    ``record`` is the approved decision (carrying consent/tenant/url). Inputs
    with only one decision kind are counted as unpaired and skipped — a single
    outcome is not a preference signal.
    """
    grouped: dict[str, dict[str, Any]] = {}
    for origin, record in records:
        fingerprint = _input_fingerprint(record.get("input"))
        bucket = grouped.setdefault(fingerprint, {"origin": origin, "approved": [], "rejected": []})
        bucket["approved" if record.get("decision") == "approved" else "rejected"].append(record)

    pairs: list[dict[str, Any]] = []
    skipped: Counter = Counter()
    for _fingerprint, bucket in grouped.items():
        approved = bucket["approved"]
        rejected = bucket["rejected"]
        chosen_record = approved[0] if approved else None
        rejected_record = rejected[0] if rejected else None

        # Review-queue rows carry the losing candidate inline; a shadow pair is
        # valid even when no *separate* rejected decision exists.
        if bucket["origin"] == "review_queue" and chosen_record is not None and chosen_record.get("rejectedOutput") is not None:
            rejected_value = chosen_record["rejectedOutput"]
        elif chosen_record is not None and rejected_record is not None:
            rejected_value = rejected_record.get("output")
        else:
            skipped["unpaired_input"] += 1
            continue

        chosen = chosen_record.get("output")
        pairs.append(
            {
                "origin": bucket["origin"],
                "input": chosen_record.get("input"),
                "chosen": chosen,
                "rejected": rejected_value,
                "record": chosen_record,
            }
        )
    return pairs, skipped


def build_dpo_v2(
    pairs: Iterable[Mapping[str, Any]],
    *,
    golden_path: Path = DEFAULT_GOLDEN,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Filter, gate, host-split and normalize DPO pairs, returning ``(rows, report)``."""
    registry = load_registry()
    exact_golden, fragment_golden = golden_fingerprints(golden_path)
    golden_hosts, golden_domain_hashes = load_golden_hosts(golden_path)

    kept_rows: list[dict[str, Any]] = []
    refused_by_reason: Counter = Counter()
    by_origin: dict[str, Counter] = {}
    by_split: Counter = Counter()
    pii_stripped = 0

    def _refuse(reason: str, origin: str) -> None:
        refused_by_reason[reason] += 1
        by_origin.setdefault(origin, Counter())["refused"] += 1

    for pair in pairs:
        origin = str(pair.get("origin") or "").strip()
        record = pair.get("record") or {}
        source = SOURCE_FOR_ORIGIN.get(origin, "")
        if not source:
            _refuse("unknown_origin", origin or "unknown")
            continue

        try:
            entry = registry.require(source)
        except Exception:
            _refuse("unknown_source", origin)
            continue
        if not entry.trainable:
            _refuse("source_not_trainable", origin)
            continue

        if source in FIRST_PARTY_SOURCES:
            consent = record.get("consent")
            tenant = record.get("tenantId")
            if consent is not True or not str(tenant or "").strip():
                _refuse("missing_consent_or_tenant", origin)
                continue

        synthetic_flag = record.get("synthetic")
        if synthetic_flag is True:
            _refuse("synthetic_row", origin)
            continue

        chosen = pair.get("chosen")
        rejected = pair.get("rejected")
        if chosen is None or rejected is None:
            _refuse("missing_chosen_or_rejected", origin)
            continue
        prompt = json.dumps(pair.get("input"), sort_keys=True, ensure_ascii=False, default=str)
        chosen_text = chosen if isinstance(chosen, str) else json.dumps(chosen, sort_keys=True, ensure_ascii=False, default=str)
        rejected_text = rejected if isinstance(rejected, str) else json.dumps(rejected, sort_keys=True, ensure_ascii=False, default=str)
        if chosen_text == rejected_text:
            _refuse("chosen_equals_rejected", origin)
            continue

        # Golden-set content never trains.
        golden_probe = f"{prompt}\n{chosen_text}\n{rejected_text}"
        if _refuses_golden(golden_probe, exact_golden, fragment_golden):
            _refuse("golden_content", origin)
            continue

        cleaned = {"prompt": prompt, "chosen": chosen_text, "rejected": rejected_text}
        before = json.dumps(cleaned, sort_keys=True)
        for field in ("prompt", "chosen", "rejected"):
            cleaned[field] = strip_pii(cleaned[field])
        if json.dumps(cleaned, sort_keys=True) != before:
            pii_stripped += 1
        if cleaned["chosen"] == cleaned["rejected"]:
            _refuse("chosen_equals_rejected_after_pii", origin)
            continue

        url = str(record.get("url") or "") or str((pair.get("input") or {}).get("url") if isinstance(pair.get("input"), Mapping) else "")
        host_key = extract_registrable_host(url)
        domain_hash = str(record.get("domainHash") or "").strip().lower()
        if not host_key and not domain_hash:
            _refuse("missing_host", origin)
            continue
        if host_key and host_key in golden_hosts:
            _refuse("golden_host", origin)
            continue
        if domain_hash and domain_hash in golden_domain_hashes:
            _refuse("golden_host", origin)
            continue
        split, h_hash = assign_host_split(host_key or f"domainhash:{domain_hash}")

        kept_rows.append(
            {
                "prompt": cleaned["prompt"],
                "chosen": cleaned["chosen"],
                "rejected": cleaned["rejected"],
                "metadata": {
                    "source": source,
                    "origin": origin,
                    "task": str(record.get("task") or ""),
                    "split": split,
                    "hostHash": h_hash,
                    "tenantId": str(record.get("tenantId") or ""),
                    "consent": True,
                    "synthetic": False,
                },
            }
        )
        by_origin.setdefault(origin, Counter())["kept"] += 1
        by_split[split] += 1

    report: dict[str, Any] = {
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "kind": "dpo-v2",
        "golden": str(golden_path),
        "goldenSha256": hashlib.sha256(golden_path.read_bytes()).hexdigest() if golden_path.is_file() else None,
        "read": sum(by_origin[o]["kept"] + by_origin[o].get("refused", 0) for o in by_origin),
        "exported": len(kept_rows),
        "refusedByReason": dict(refused_by_reason),
        "byOrigin": {o: dict(c) for o, c in by_origin.items()},
        "bySplit": dict(by_split),
        "piiStripped": pii_stripped,
    }
    return kept_rows, report


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Build the v2 DPO pair dataset (dpo-v2.jsonl)")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--golden", type=Path, default=DEFAULT_GOLDEN)
    parser.add_argument(
        "--healing-file",
        type=Path,
        default=PRODUCER_FILES["healing"],
        help="Healing decision records (approved vs rejected patches)",
    )
    parser.add_argument(
        "--vault-file",
        type=Path,
        default=PRODUCER_FILES["vault"],
        help="Vault decision records (approve/reject pairs)",
    )
    parser.add_argument(
        "--review-queue",
        type=Path,
        default=REVIEW_QUEUE_FILE,
        help="v2 WP1 review-queue store (shadow_disagreement rows)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Validate without writing files")
    args = parser.parse_args(list(argv) if argv is not None else None)

    try:
        records, load_skipped = load_decision_records(
            producer_files={"healing": args.healing_file, "vault": args.vault_file},
            review_queue_path=args.review_queue,
        )
        pairs, pair_skipped = pair_decisions(records)
        kept_rows, report = build_dpo_v2(pairs, golden_path=args.golden)
    except DatasetError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    report["loadSkipped"] = dict(load_skipped)
    report["pairSkipped"] = dict(pair_skipped)
    report["output"] = str(args.out)

    if not args.dry_run:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        payload = "\n".join(json.dumps(r, ensure_ascii=False, sort_keys=True) for r in kept_rows)
        bytes_text = (payload + "\n") if payload else ""
        args.out.write_text(bytes_text, encoding="utf-8")
        report["outputSha256"] = hashlib.sha256(bytes_text.encode("utf-8")).hexdigest()

        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"wrote {len(kept_rows)} pairs -> {args.out}")
        print(f"report -> {args.report}")
    else:
        print(f"dry run: {len(kept_rows)} pairs would be written -> {args.out}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
