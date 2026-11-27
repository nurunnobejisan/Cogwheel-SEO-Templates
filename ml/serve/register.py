"""Promote a verified training run to ``ready`` in the model registry.

``ready`` is earned, never typed (D-023). Promotion runs a fixed gate chain
and refuses unless every gate passes:

1. ``manifest_shape``   — sft/dpo run manifest, well-formed.
2. ``real_run``         — ``mode: train`` with ``trainingStarted`` (dry-run
                          manifests carry no weights and can never promote).
3. ``base_model``       — base model resolves through the Phase 3 allow-list
                          and the manifest licence matches the allow-list's.
4. ``golden_frozen``    — manifest golden sha == the current frozen golden
                          set == the report's golden sha (all three agree).
5. ``data_recorded``    — training data sha256 + row count present.
6. ``adapter_recorded`` — adapter artifact named, weights **not** committed
                          to the repo (rule 4).
7. ``git_sha``          — the manifest names the commit it was produced at.
8. ``report_present``   — a ``ml/eval/run_eval.py`` report is supplied and
                          matches the manifest's golden sha.
9. ``report_coverage``  — every golden case has an output (skips are not
                          passes).
10. ``report_failures`` — failures <= ``--allow-failures`` (default 0).
11. ``report_meta``     — when the report's ``outputsMeta`` names an adapter
                          or base model, it must match the manifest.

The registry write is atomic (tmp + replace) and keeps a ``.bak`` of the
previous file. Legacy ``unverified`` entries are never touched.

Standard library only (D-014). Run::

    python3 -m ml.serve.register --manifest <run>.manifest.json \\
        --report <run>-report.json [--active] [--dry-run]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple

from ml.serve.registry import DEFAULT_REGISTRY, RegistryError, load_registry
from ml.train.config import resolve_base_model

__all__ = ["DEFAULT_GOLDEN", "verify_promotion", "build_entry", "promote", "main"]

DEFAULT_GOLDEN = Path("ml/eval/golden/cases.jsonl")

Check = Tuple[str, bool, str]


class PromotionError(Exception):
    """A gate failed or a file could not be read (exit code 1/2)."""


def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _load_json(path: Path, what: str) -> Dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise PromotionError(f"cannot read {what} {path}: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise PromotionError(f"{what} {path} is not valid JSON: {exc}") from exc
    if not isinstance(payload, dict):
        raise PromotionError(f"{what} {path} must be a JSON object")
    return payload


def verify_promotion(
    manifest: Mapping[str, Any],
    report: Mapping[str, Any],
    *,
    golden_path: Path = DEFAULT_GOLDEN,
    allow_failures: int = 0,
) -> List[Check]:
    """Run the gate chain; a check is ``(name, passed, detail)``."""
    checks: List[Check] = []

    kind = manifest.get("kind")
    checks.append(
        (
            "manifest_shape",
            kind in {"sft", "dpo"} and isinstance(manifest.get("runId"), str),
            f"kind={kind!r} runId={manifest.get('runId')!r}",
        )
    )

    real_run = manifest.get("mode") == "train" and manifest.get("trainingStarted") is True
    checks.append(
        (
            "real_run",
            real_run,
            f"mode={manifest.get('mode')!r} trainingStarted="
            f"{manifest.get('trainingStarted')!r} (dry-run manifests cannot promote)",
        )
    )

    base = manifest.get("baseModel") or {}
    base_id = base.get("id") if isinstance(base, Mapping) else None
    base_licence = base.get("licence") if isinstance(base, Mapping) else None
    allowlisted: Optional[Mapping[str, str]] = None
    base_error = ""
    try:
        allowlisted = resolve_base_model(str(base_id or ""))
    except Exception as exc:  # ConfigError and shape errors both gate here
        base_error = str(exc)
    base_ok = allowlisted is not None and allowlisted.get("licence") == base_licence
    checks.append(
        (
            "base_model",
            base_ok,
            f"id={base_id!r} licence={base_licence!r} "
            + (f"allow-list={allowlisted.get('licence')!r}" if allowlisted else base_error),
        )
    )

    golden = manifest.get("golden") or {}
    manifest_golden_sha = golden.get("sha256") if isinstance(golden, Mapping) else None
    try:
        current_golden_sha = _sha256_file(golden_path)
    except OSError as exc:
        raise PromotionError(f"cannot read golden set {golden_path}: {exc}") from exc
    report_golden_sha = report.get("goldenSha256")
    golden_ok = (
        isinstance(manifest_golden_sha, str)
        and manifest_golden_sha == current_golden_sha == report_golden_sha
    )
    checks.append(
        (
            "golden_frozen",
            golden_ok,
            f"manifest={str(manifest_golden_sha)[:12]}… "
            f"current={current_golden_sha[:12]}… report={str(report_golden_sha)[:12]}…",
        )
    )

    data = manifest.get("data") or {}
    data_sha = data.get("sha256") if isinstance(data, Mapping) else None
    data_rows = data.get("rows") if isinstance(data, Mapping) else None
    data_ok = (
        isinstance(data_sha, str)
        and bool(data_sha)
        and isinstance(data_rows, int)
        and data_rows > 0
    )
    checks.append(
        (
            "data_recorded",
            data_ok,
            f"rows={data_rows!r} sha256={str(data_sha)[:12]}…"
            if data_sha
            else f"rows={data_rows!r}",
        )
    )

    artifacts = manifest.get("artifacts") or {}
    adapter = artifacts.get("adapter") if isinstance(artifacts, Mapping) else None
    weights_committed = (
        artifacts.get("weightsCommitted") if isinstance(artifacts, Mapping) else None
    )
    checks.append(
        (
            "adapter_recorded",
            isinstance(adapter, str) and bool(adapter) and weights_committed is False,
            f"adapter={adapter!r} weightsCommitted={weights_committed!r}",
        )
    )

    git_sha = manifest.get("gitSha")
    checks.append(
        (
            "git_sha",
            isinstance(git_sha, str) and bool(git_sha),
            f"gitSha={str(git_sha)[:12] if git_sha else None}…",
        )
    )

    checks.append(
        (
            "report_present",
            bool(report),
            f"cases={report.get('cases')!r} outputsProvided={report.get('outputsProvided')!r}",
        )
    )

    cases = report.get("cases")
    outputs_provided = report.get("outputsProvided")
    coverage_ok = (
        isinstance(cases, int)
        and isinstance(outputs_provided, int)
        and cases > 0
        and outputs_provided == cases
    )
    checks.append(
        (
            "report_coverage",
            coverage_ok,
            f"outputs {outputs_provided!r} of {cases!r} cases (skips are not passes)",
        )
    )

    failures = report.get("failures")
    failure_count = len(failures) if isinstance(failures, list) else -1
    checks.append(
        (
            "report_failures",
            0 <= failure_count <= allow_failures,
            f"{failure_count} failure(s) allowed={allow_failures}",
        )
    )

    meta = report.get("outputsMeta") or {}
    meta = meta if isinstance(meta, Mapping) else {}

    def _first(key: str) -> Any:
        values = meta.get(key)
        return values[0] if isinstance(values, list) and values else None

    meta_notes: List[str] = []
    meta_ok = True
    meta_adapter = _first("adapter")
    if meta_adapter is not None and meta_adapter != adapter:
        meta_ok = False
        meta_notes.append(f"adapter mismatch meta={meta_adapter!r} manifest={adapter!r}")
    meta_base = _first("baseModel")
    if meta_base is not None and meta_base != base_id:
        meta_ok = False
        meta_notes.append(f"baseModel mismatch meta={meta_base!r} manifest={base_id!r}")
    if not meta_notes:
        meta_notes.append("outputsMeta absent or matching")
    checks.append(("report_meta", meta_ok, "; ".join(meta_notes)))

    return checks


def build_entry(
    manifest: Mapping[str, Any],
    report: Mapping[str, Any],
    *,
    model_id: str,
    manifest_path: Path,
    report_path: Path,
    manifest_sha: str,
    report_sha: str,
    golden_sha: str,
    failure_count: int,
) -> Dict[str, Any]:
    """Assemble the registry entry for a verified run (status: ready)."""
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    run_id = str(manifest.get("runId"))
    meta = report.get("outputsMeta") or {}

    def _first(key: str) -> Any:
        values = meta.get(key) if isinstance(meta, Mapping) else None
        return values[0] if isinstance(values, list) and values else None

    template_version = _first("templateVersion")
    base = manifest.get("baseModel") or {}
    data = manifest.get("data") or {}
    return {
        "modelId": model_id,
        "modelVersion": run_id,
        "baseModel": str(base.get("id") or ""),
        "provider": "sft_lora",
        "status": "ready",
        "createdAt": now,
        "promotedAt": now,
        "statusReason": (
            f"Promoted from verified manifest {manifest_path.name} (run {run_id}): "
            f"golden-set report {report_sha[:12]}… with {failure_count} failure(s), "
            f"golden sha {golden_sha[:12]}…, data sha {str(data.get('sha256'))[:12]}…"
            + (f", template v{template_version}" if template_version is not None else "")
        ),
        "provenance": {
            "runId": run_id,
            "gitSha": manifest.get("gitSha"),
            "manifest": str(manifest_path),
            "manifestSha256": manifest_sha,
            "goldenSha256": golden_sha,
            "dataSha256": data.get("sha256"),
            "report": str(report_path),
            "reportSha256": report_sha,
            "reportFailures": failure_count,
            "templateVersion": template_version,
        },
    }


def promote(
    *,
    manifest_path: Path,
    report_path: Path,
    registry_path: Path = DEFAULT_REGISTRY,
    golden_path: Path = DEFAULT_GOLDEN,
    model_id: str = "",
    allow_failures: int = 0,
    set_active: bool = False,
    force: bool = False,
    dry_run: bool = False,
) -> Dict[str, Any]:
    """Verify gates and (unless dry_run) write the registry entry."""
    manifest = _load_json(manifest_path, "manifest")
    report = _load_json(report_path, "report")

    checks = verify_promotion(
        manifest, report, golden_path=golden_path, allow_failures=allow_failures
    )
    failed = [name for name, ok, _ in checks if not ok]
    if failed:
        details = "; ".join(f"{name}: {detail}" for name, ok, detail in checks if not ok)
        raise PromotionError(f"gate(s) failed — {', '.join(failed)} | {details}")

    run_id = str(manifest.get("runId"))
    resolved_model_id = model_id.strip() or f"seo-studio-{run_id}"
    manifest_sha = _sha256_file(manifest_path)
    report_sha = _sha256_file(report_path)
    golden_sha = _sha256_file(golden_path)
    failure_count = len(report.get("failures") or [])

    entry = build_entry(
        manifest,
        report,
        model_id=resolved_model_id,
        manifest_path=manifest_path,
        report_path=report_path,
        manifest_sha=manifest_sha,
        report_sha=report_sha,
        golden_sha=golden_sha,
        failure_count=failure_count,
    )

    registry = load_registry(registry_path)
    entries = list(registry.get("models") or [])
    existing_index = next(
        (
            i
            for i, e in enumerate(entries)
            if isinstance(e, Mapping) and e.get("modelId") == resolved_model_id
        ),
        None,
    )
    if existing_index is not None:
        previous = entries[existing_index]
        previous_sha = ((previous.get("provenance") or {}).get("manifestSha256")
                        if isinstance(previous.get("provenance"), Mapping) else None)
        if previous_sha != manifest_sha and not force:
            raise PromotionError(
                f"modelId {resolved_model_id!r} already exists with a different manifest "
                f"({str(previous_sha)[:12]}… vs {manifest_sha[:12]}…) — pass --force to replace"
            )
        entry = {**previous, **entry, "createdAt": previous.get("createdAt", entry["createdAt"])}
        entries[existing_index] = entry
    else:
        entries.append(entry)

    updated = dict(registry)
    updated["models"] = entries
    updated["lastUpdated"] = entry["promotedAt"]
    if set_active:
        updated["activeModelId"] = resolved_model_id

    if dry_run:
        return {"dryRun": True, "checks": checks, "entry": entry, "registry": updated}

    _atomic_write(registry_path, updated)
    return {"dryRun": False, "checks": checks, "entry": entry}


def _atomic_write(path: Path, payload: Mapping[str, Any]) -> None:
    try:
        if path.is_file():
            backup = path.with_name(path.name + ".bak")
            backup.write_bytes(path.read_bytes())
        tmp = path.with_name(path.name + ".tmp")
        tmp.write_text(
            json.dumps(dict(payload), indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        os.replace(tmp, path)
    except OSError as exc:
        raise PromotionError(f"cannot write registry {path}: {exc}") from exc


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python3 -m ml.serve.register",
        description="Promote a verified training run to 'ready' in the model registry",
    )
    parser.add_argument("--manifest", type=Path, required=True, help="run manifest JSON")
    parser.add_argument(
        "--report",
        type=Path,
        required=True,
        help="ml/eval/run_eval.py report JSON",
    )
    parser.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY)
    parser.add_argument("--golden", type=Path, default=DEFAULT_GOLDEN)
    parser.add_argument("--model-id", default="", help="default: seo-studio-<runId>")
    parser.add_argument(
        "--allow-failures",
        type=int,
        default=0,
        help="promote despite up to N golden-set check failures (recorded, default 0)",
    )
    parser.add_argument("--active", action="store_true", help="also set activeModelId")
    parser.add_argument("--force", action="store_true", help="replace an existing different entry")
    parser.add_argument("--dry-run", action="store_true", help="print the result, write nothing")
    args = parser.parse_args(list(argv) if argv is not None else None)

    if args.allow_failures < 0:
        print("error: --allow-failures must be >= 0", file=sys.stderr)
        return 2

    try:
        result = promote(
            manifest_path=args.manifest,
            report_path=args.report,
            registry_path=args.registry,
            golden_path=args.golden,
            model_id=args.model_id,
            allow_failures=args.allow_failures,
            set_active=args.active,
            force=args.force,
            dry_run=args.dry_run,
        )
    except PromotionError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    except RegistryError as exc:
        print(f"registry error: {exc}", file=sys.stderr)
        return 2

    for name, ok, detail in result["checks"]:
        print(f"{'PASS' if ok else 'FAIL'}  {name}: {detail}")
    entry = result["entry"]
    if result["dryRun"]:
        print(f"dry-run: would promote {entry['modelId']!r} (nothing written)")
        print(json.dumps(entry, indent=2, sort_keys=True))
        return 0
    print(f"promoted {entry['modelId']!r} -> ready")
    if args.active:
        print(f"activeModelId -> {entry['modelId']!r}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
