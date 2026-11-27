"""SFT dataset assembly behind the licence gate.

Reads chat-format JSONL (the shape produced by ``buildLoraExample`` in
``src/core/training/dataset.ts`` and by ``data/training/unified_seo_*.jsonl``)
and emits a training-ready file plus a manifest. Every row passes through:

1. the **licence registry** — the declared source must exist and be trainable
   for the requested split (rule 3);
2. the **synthetic ban** — ``metadata.synthetic: true`` never trains (rule 6);
3. the **first-party rule** — ``vault`` / ``patches`` / ``triples`` rows must
   carry ``metadata.consent is True`` and a non-empty ``metadata.tenantId``
   (parity with ``ml.registry.register_example``);
4. the **golden-set exclusion** — no row may reproduce a frozen golden case,
   so evaluation data can never leak into training;
5. **PII stripping** via the Python twin of ``stripPii``.

The 2000-pair gate (``MIN_REVIEWED_PAIRS_FOR_TRAINING``) applies to
client-derived sources only; a below-gate run reports ``blocked`` rather than
failing, mirroring ``scripts/export-lora-dataset.ts``.

Standard library only (D-014).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple

from ml.clean.pii import strip_pii
from ml.registry import LicenceError, load_registry

from .config import FIRST_PARTY_SOURCES, MIN_REVIEWED_PAIRS_FOR_TRAINING
from .errors import DatasetError

__all__ = [
    "SourceSpec",
    "load_chat_rows",
    "assemble",
    "save_rows",
    "REPO_ROOT",
]

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_GOLDEN = REPO_ROOT / "ml" / "eval" / "golden" / "cases.jsonl"

REQUIRED_ROLES = ("system", "user", "assistant")

#: Minimum normalized length before a golden fragment counts as a match —
#: short values ("Hotel") would collide with ordinary prose.
_GOLDEN_MIN_FRAGMENT = 40


@dataclass
class SourceSpec:
    """One input file, the registry id it is declared under, and its split."""

    path: Path
    source: str
    split: str = "train"

    @classmethod
    def parse(cls, text: str) -> "SourceSpec":
        """Parse ``PATH=SOURCE_ID[=SPLIT]`` (split defaults to ``train``)."""
        parts = text.split("=")
        if len(parts) not in (2, 3) or not parts[0] or not parts[1]:
            raise DatasetError(
                f"source spec must look like PATH=SOURCE_ID[=SPLIT], got {text!r}"
            )
        split = parts[2] if len(parts) == 3 else "train"
        return cls(path=Path(parts[0]), source=parts[1], split=split)


def _normalize(value: str) -> str:
    return " ".join(value.split()).lower()


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def load_chat_rows(path: Path) -> List[Dict[str, Any]]:
    """Read a chat JSONL file and validate its message shape."""
    if not path.is_file():
        raise DatasetError(f"training file not found: {path}")
    rows: List[Dict[str, Any]] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as exc:
            raise DatasetError(f"{path}:{line_number}: invalid JSON: {exc}") from exc
        messages = row.get("messages")
        if not isinstance(messages, list) or len(messages) != 3:
            raise DatasetError(
                f"{path}:{line_number}: expected exactly 3 messages, "
                f"got {len(messages) if isinstance(messages, list) else 'none'}"
            )
        roles = [m.get("role") if isinstance(m, Mapping) else None for m in messages]
        if tuple(roles) != REQUIRED_ROLES:
            raise DatasetError(
                f"{path}:{line_number}: roles must be {','.join(REQUIRED_ROLES)}, "
                f"got {','.join(str(r) for r in roles)}"
            )
        for position, message in enumerate(messages):
            content = message.get("content")
            if not isinstance(content, str) or not content.strip():
                raise DatasetError(
                    f"{path}:{line_number}: message {position} has empty content"
                )
        rows.append(row)
    return rows


def golden_fingerprints(golden_path: Path = DEFAULT_GOLDEN) -> Tuple[set, set]:
    """Normalized fingerprints of every frozen golden case.

    Returns ``(exact, fragments)``: exact matches (full serialized case or
    its text field) and long fragments (``input.text`` ≥ 40 chars) that must
    never appear verbatim in training content.
    """
    exact: set = set()
    fragments: set = set()
    for line in golden_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        case = json.loads(line)
        case_input = case.get("input") or {}
        exact.add(_normalize(json.dumps(case_input, sort_keys=True)))
        exact.add(_normalize(json.dumps(case.get("output"), sort_keys=True)))
        text = str(case_input.get("text") or "")
        if text.strip():
            normalized = _normalize(text)
            exact.add(normalized)
            if len(normalized) >= _GOLDEN_MIN_FRAGMENT:
                fragments.add(normalized)
    return exact, fragments


def _refuses_golden(
    content: str, exact: set, fragments: set
) -> bool:
    normalized = _normalize(content)
    if normalized in exact:
        return True
    return any(fragment in normalized for fragment in fragments)


def _gate_row(
    row: Mapping[str, Any],
    *,
    source: str,
    split: str,
    exact: set,
    fragments: set,
    registry: Any,
) -> Optional[str]:
    """Return a refusal reason, or ``None`` when the row may train."""
    registry.require(source)
    registry.assert_trainable(source, split)

    metadata = row.get("metadata")
    if not isinstance(metadata, Mapping):
        # Unified training files store their fields under `meta`; exported
        # LoRA rows (buildLoraExample) use `metadata`. Accept both.
        metadata = row.get("meta")
    metadata = metadata if isinstance(metadata, Mapping) else {}

    if metadata.get("synthetic") is True:
        return "synthetic rows never train (rule 6)"

    provenance = metadata.get("provenance")
    if provenance not in {"measured", "estimated", "unavailable"}:
        return (
            "metadata.provenance must be measured|estimated|unavailable, "
            f"got {provenance!r}"
        )

    if source in FIRST_PARTY_SOURCES:
        if metadata.get("consent") is not True:
            return f"source {source!r} is first-party: metadata.consent must be true"
        if not metadata.get("tenantId"):
            return f"source {source!r} is first-party: metadata.tenantId is required"
        if source == "triples":
            quality = metadata.get("quality")
            if quality not in {"reviewed", "gold"}:
                return f"triples must be reviewed or gold, got {quality!r}"

    for message in row.get("messages", []):
        content = message.get("content") if isinstance(message, Mapping) else ""
        if isinstance(content, str) and _refuses_golden(content, exact, fragments):
            return "golden-set leakage: row reproduces a frozen golden case"
    return None


def _classify(reason: str) -> str:
    if "golden" in reason:
        return "skippedGolden"
    if "shape" in reason or "roles" in reason or "messages" in reason or "content" in reason:
        return "skippedShape"
    return "skippedLicence"


def assemble(
    specs: Sequence[SourceSpec],
    *,
    split: str = "train",
    golden_path: Path = DEFAULT_GOLDEN,
    strip_pii_enabled: bool = True,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Gate, strip and de-duplicate rows from every declared source.

    Returns ``(rows, manifest)``. Refusals are collected with reasons (so an
    operator sees *why* data was excluded) and counted per reason; only rows
    that pass every gate land in ``rows``.
    """
    registry = load_registry()
    exact, fragments = golden_fingerprints(golden_path)

    rows: List[Dict[str, Any]] = []
    seen: set = set()
    manifest: Dict[str, Any] = {
        "generatedAt": datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z"),
        "split": split,
        "golden": str(golden_path),
        "goldenSha256": hashlib.sha256(golden_path.read_bytes()).hexdigest(),
        "sources": [],
        "exported": 0,
        "skippedDuplicate": 0,
        "skippedGolden": 0,
        "skippedLicence": 0,
        "skippedShape": 0,
        "piiStripped": 0,
        "refusals": [],
        "clientDerivedRows": 0,
    }

    for spec in specs:
        if spec.split != split:
            raise DatasetError(
                f"source {spec.path} is declared split={spec.split} and cannot "
                f"enter a split={split} assembly (eval data never trains)"
            )
        source_rows = load_chat_rows(spec.path)
        source_report = {
            "path": str(spec.path),
            "source": spec.source,
            "split": spec.split,
            "read": len(source_rows),
            "exported": 0,
        }
        manifest["sources"].append(source_report)

        for position, row in enumerate(source_rows):
            reason = _gate_row(
                row,
                source=spec.source,
                split=split,
                exact=exact,
                fragments=fragments,
                registry=registry,
            )
            if reason is not None:
                manifest[_classify(reason)] += 1
                if len(manifest["refusals"]) < 20:
                    manifest["refusals"].append(
                        {"source": spec.source, "row": position, "reason": reason}
                    )
                continue

            cleaned = dict(row)
            if strip_pii_enabled:
                before = json.dumps(cleaned["messages"], sort_keys=True)
                cleaned["messages"] = strip_pii(cleaned["messages"])
                after = json.dumps(cleaned["messages"], sort_keys=True)
                if before != after:
                    manifest["piiStripped"] += 1

            fingerprint = _sha256(
                json.dumps(
                    [m["content"] for m in cleaned["messages"]],
                    sort_keys=True,
                )
            )
            if fingerprint in seen:
                manifest["skippedDuplicate"] += 1
                continue
            seen.add(fingerprint)

            if spec.source in FIRST_PARTY_SOURCES:
                manifest["clientDerivedRows"] += 1
            rows.append(cleaned)
            source_report["exported"] += 1

    manifest["exported"] = len(rows)
    gate_ready = manifest["clientDerivedRows"] >= MIN_REVIEWED_PAIRS_FOR_TRAINING
    manifest["gate"] = {
        "minimum": MIN_REVIEWED_PAIRS_FOR_TRAINING,
        "clientDerivedRows": manifest["clientDerivedRows"],
        "status": "ready" if gate_ready else "blocked",
        "note": (
            "the 2000-pair gate applies to client-derived sources only "
            "(triples/patches/vault); repo sources are exempt"
        ),
    }
    return rows, manifest


def save_rows(rows: Sequence[Mapping[str, Any]], path: Path) -> str:
    """Write rows as JSONL; returns the sha256 of the written bytes."""
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = "\n".join(
        json.dumps(dict(row), ensure_ascii=False, sort_keys=True) for row in rows
    )
    data = (payload + "\n") if payload else ""
    path.write_text(data, encoding="utf-8")
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Assemble a licence-gated SFT dataset")
    parser.add_argument("--out", type=Path, default=Path("data/sft-dataset.jsonl"))
    parser.add_argument(
        "--source",
        action="append",
        default=[],
        metavar="PATH=SOURCE_ID[=SPLIT]",
        help="repeatable; defaults to data/training/unified_seo_train.jsonl=repo-synthetic",
    )
    parser.add_argument(
        "--triples",
        type=Path,
        default=None,
        help="optional data/lora-dataset.jsonl from scripts/export-lora-dataset.ts (=triples)",
    )
    parser.add_argument("--golden", type=Path, default=DEFAULT_GOLDEN)
    parser.add_argument("--dry-run", action="store_true", help="validate, do not write")
    parser.add_argument(
        "--require-ready",
        action="store_true",
        help="exit 1 when the client-derived 2000-pair gate is blocked",
    )
    args = parser.parse_args(list(argv) if argv is not None else None)

    specs = [SourceSpec.parse(text) for text in args.source]
    if not specs:
        specs = [
            SourceSpec(
                path=REPO_ROOT / "data" / "training" / "unified_seo_train.jsonl",
                source="repo-synthetic",
            )
        ]
    if args.triples:
        specs.append(SourceSpec(path=args.triples, source="triples"))

    try:
        rows, manifest = assemble(specs, golden_path=args.golden)
    except (DatasetError, LicenceError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    manifest["output"] = str(args.out)
    if not args.dry_run:
        manifest["outputSha256"] = save_rows(rows, args.out)
        manifest_path = args.out.with_suffix(".manifest.json")
        manifest_path.write_text(
            json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        print(f"wrote {len(rows)} rows -> {args.out}")
        print(f"manifest -> {manifest_path}")
    else:
        print(f"dry run: {len(rows)} rows would be written -> {args.out}")

    gate = manifest["gate"]
    print(
        f"gate: {gate['status']} "
        f"({gate['clientDerivedRows']}/{gate['minimum']} client-derived rows)"
    )
    for refusal in manifest["refusals"][:5]:
        print(f"  refused {refusal['source']}:{refusal['row']} — {refusal['reason']}")

    if args.require_ready and gate["status"] != "ready":
        print("BLOCKING: client-derived corpus below the training threshold.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
