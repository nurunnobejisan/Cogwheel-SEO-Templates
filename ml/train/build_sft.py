"""Host-split v1 SFT dataset builder (WP8).

Builds gitignored ``data/build/sft-v2.jsonl`` plus ``data/build/sft-v2.report.json``
for the two v1 fine-tuning jobs only:

- ``schema_generation``: ``wdc-2024``, ``wdc-tables-2023``, ``vault``,
  ``patches``, ``triples`` (must pass ``jsonld_valid`` and, when raw HTML is
  attached, clean validation through ``scripts/ml-label-cli.ts``).
- ``metadata_generation``: ``vault``, ``patches``, ``triples`` ONLY (never
  Common Crawl or Lighthouse).

Enforces deterministic 90/10 splitting by registrable domain host hash so zero
hosts cross between ``train`` and ``eval``, excludes all frozen golden-set
hosts, refuses unreviewed ``synthetic: true`` / ``repo-synthetic`` rows (D-026),
runs PII stripping, and writes a structured counts report.

Standard library + existing ``ml/`` helpers only (D-014).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple
from urllib.parse import urlparse

from ml.clean.pii import strip_pii
from ml.eval.run_eval import check_invented_metrics, check_jsonld_valid
from ml.registry import load_registry

from .config import FIRST_PARTY_SOURCES
from .dataset import DEFAULT_GOLDEN, _refuses_golden, golden_fingerprints
from .errors import DatasetError

__all__ = [
    "DEFAULT_OUT",
    "DEFAULT_REPORT",
    "V1_JOBS",
    "JOB_ALLOWED_SOURCES",
    "extract_registrable_host",
    "assign_host_split",
    "load_golden_hosts",
    "build_sft_v2",
    "main",
]

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = REPO_ROOT / "data" / "build" / "sft-v2.jsonl"
DEFAULT_REPORT = REPO_ROOT / "data" / "build" / "sft-v2.report.json"

V1_JOBS = ("schema_generation", "metadata_generation")

JOB_ALLOWED_SOURCES: Dict[str, frozenset] = {
    "schema_generation": frozenset({"wdc-2024", "wdc-tables-2023", "vault", "patches", "triples"}),
    "metadata_generation": frozenset({"vault", "patches", "triples"}),
}

_TWO_LABEL_SUFFIXES = frozenset(
    {
        "co.uk",
        "org.uk",
        "ac.uk",
        "gov.uk",
        "com.au",
        "net.au",
        "org.au",
        "co.jp",
        "ne.jp",
        "or.jp",
        "co.nz",
        "com.br",
        "co.in",
    }
)


def extract_registrable_host(value: str) -> str:
    """Normalize a URL or hostname to its registrable domain host (lowercase)."""
    raw = str(value or "").strip()
    if not raw:
        return ""
    parsed = urlparse(raw if "://" in raw else f"https://{raw}")
    host = (parsed.hostname or "").strip().lower().rstrip(".")
    if not host:
        return ""
    if host.startswith("www."):
        host = host[4:]
    labels = [part for part in host.split(".") if part]
    if len(labels) <= 2:
        return ".".join(labels)
    tail_two = ".".join(labels[-2:])
    if tail_two in _TWO_LABEL_SUFFIXES and len(labels) >= 3:
        return ".".join(labels[-3:])
    return tail_two


def host_hash(host_key: str) -> str:
    """Short stable digest representing a registrable host in metadata."""
    return hashlib.sha256(host_key.encode("utf-8")).hexdigest()[:16]


def assign_host_split(host_key: str) -> Tuple[str, str]:
    """Deterministically assign a registrable host key into ``train`` (90%) or ``eval`` (10%)."""
    digest = hashlib.sha256(host_key.encode("utf-8")).hexdigest()
    bucket = int(digest[:8], 16) % 100
    split = "train" if bucket < 90 else "eval"
    return split, digest[:16]


def load_golden_hosts(golden_path: Path = DEFAULT_GOLDEN) -> Tuple[frozenset, frozenset]:
    """Return ``(golden_hosts, golden_domain_hashes)`` read from ``golden_path``."""
    hosts = set()
    domain_hashes = set()
    if not golden_path.is_file():
        return frozenset(), frozenset()
    for line in golden_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        case = json.loads(line)
        case_input = case.get("input") or {}
        url = str(case_input.get("url") or "")
        reg = extract_registrable_host(url)
        if reg:
            hosts.add(reg)
        dh = str(case_input.get("domainHash") or "").strip().lower()
        if dh:
            domain_hashes.add(dh)
    return frozenset(hosts), frozenset(domain_hashes)


def run_ml_label_cli(html: str, url: str) -> Tuple[bool, str]:
    """Validate an HTML fixture through ``scripts/ml-label-cli.ts`` cleanly."""
    if not html.strip():
        return False, "empty_html"
    try:
        proc = subprocess.run(
            ["npx", "tsx", str(REPO_ROOT / "scripts" / "ml-label-cli.ts"), "-", "--url", url, "--compact"],
            input=html,
            text=True,
            capture_output=True,
            timeout=30,
            check=False,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        return False, f"label_cli_exec:{exc}"
    if proc.returncode != 0:
        return False, f"label_cli_exit:{proc.returncode}"
    try:
        payload = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return False, "label_cli_invalid_json"
    if payload.get("provenance") != "measured" or not isinstance(payload.get("findings"), list):
        return False, "label_cli_missing_measured_findings"
    return True, "ok"


def _meta_of(row: Mapping[str, Any]) -> Dict[str, Any]:
    raw_meta = row.get("metadata")
    if not isinstance(raw_meta, Mapping):
        raw_meta = row.get("meta")
    return dict(raw_meta) if isinstance(raw_meta, Mapping) else {}


def _has_explicit_human_review(row: Mapping[str, Any], meta: Mapping[str, Any]) -> bool:
    return bool(
        row.get("humanReviewed") is True
        or meta.get("humanReviewed") is True
        or row.get("reviewed") is True
        or meta.get("reviewed") is True
        or str(row.get("reviewedBy") or meta.get("reviewedBy") or "").strip()
    )


def _extract_messages_and_output(row: Mapping[str, Any], task: str) -> Tuple[List[Dict[str, str]], Any, str, Optional[str]]:
    """Return ``(messages, parsed_output, url, html)`` from either chat or example rows."""
    messages = row.get("messages")
    row_input = row.get("input") if isinstance(row.get("input"), Mapping) else {}
    url = str(row.get("url") or row_input.get("url") or "").strip()
    html = row.get("html") or row_input.get("html")
    html_str = str(html) if isinstance(html, str) and html.strip() else None

    if isinstance(messages, list) and len(messages) == 3:
        parsed_msgs = [
            {"role": str(m.get("role", "")), "content": str(m.get("content", ""))}
            for m in messages
            if isinstance(m, Mapping)
        ]
        if len(parsed_msgs) != 3 or tuple(m["role"] for m in parsed_msgs) != ("system", "user", "assistant"):
            raise DatasetError("invalid 3-role chat structure")
        assistant_raw = parsed_msgs[2]["content"]
        try:
            parsed_out = json.loads(assistant_raw)
        except json.JSONDecodeError:
            parsed_out = assistant_raw
        return parsed_msgs, parsed_out, url, html_str

    raw_output = row.get("output")
    if raw_output is None:
        raise DatasetError("row missing both 3-role 'messages' and 'output'")

    output_text = (
        json.dumps(raw_output, ensure_ascii=False, sort_keys=True)
        if not isinstance(raw_output, str)
        else raw_output
    )
    system_prompt = (
        f"You are SEO Studio's grounded {task} assistant. "
        "Emit strictly valid JSON using only facts supplied in the input."
    )
    user_payload = json.dumps(row_input or {"url": url}, ensure_ascii=False, sort_keys=True)
    return (
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_payload},
            {"role": "assistant", "content": output_text},
        ],
        raw_output,
        url,
        html_str,
    )


def _normalize_row_host(row: Mapping[str, Any], meta: Mapping[str, Any], url: str) -> str:
    reg = extract_registrable_host(url)
    if reg:
        return reg
    row_input = row.get("input") if isinstance(row.get("input"), Mapping) else {}
    raw_hash = str(meta.get("domainHash") or row_input.get("domainHash") or "").strip().lower()
    if raw_hash:
        return f"hash:{raw_hash}"
    return ""


def build_sft_v2(
    rows: Iterable[Mapping[str, Any]],
    *,
    default_source: Optional[str] = None,
    golden_path: Path = DEFAULT_GOLDEN,
    html_validator: Optional[Callable[[str, str], Tuple[bool, str]]] = run_ml_label_cli,
    strip_pii_enabled: bool = True,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Filter, host-split and normalize v1 SFT rows, returning ``(rows, report)``."""
    registry = load_registry()
    exact_golden, fragment_golden = golden_fingerprints(golden_path)
    golden_hosts, golden_domain_hashes = load_golden_hosts(golden_path)

    kept_rows: List[Dict[str, Any]] = []
    seen_content: set = set()
    train_hosts: set = set()
    eval_hosts: set = set()

    total_read = 0
    refused_by_reason: Counter = Counter()
    by_job: Dict[str, Counter] = {job: Counter() for job in V1_JOBS}
    by_source: Dict[str, Counter] = {}
    by_split: Counter = Counter()

    def _refuse(reason: str, source_id: str = "unknown") -> None:
        refused_by_reason[reason] += 1
        src_bucket = by_source.setdefault(source_id, Counter())
        src_bucket["refused"] += 1

    for raw in rows:
        total_read += 1
        meta = _meta_of(raw)
        task = str(raw.get("task") or meta.get("category") or "").strip()
        source = str(meta.get("source") or raw.get("source") or default_source or "").strip()
        if not source:
            _refuse("missing_source")
            continue

        if task not in V1_JOBS:
            _refuse("unsupported_task", source)
            continue

        try:
            entry = registry.require(source)
        except Exception:
            _refuse("unknown_source", source)
            continue

        if not entry.trainable or source not in JOB_ALLOWED_SOURCES[task]:
            _refuse("disallowed_source_for_job", source)
            continue

        synthetic_flag = raw.get("synthetic") if "synthetic" in raw else meta.get("synthetic")
        reviewed_explicit = _has_explicit_human_review(raw, meta)
        if synthetic_flag is True and not reviewed_explicit:
            _refuse("synthetic_unreviewed", source)
            continue
        if source == "repo-synthetic" and not reviewed_explicit:
            _refuse("repo_synthetic_unreviewed", source)
            continue

        provenance = str(meta.get("provenance") or raw.get("provenance") or "measured").strip()
        if provenance not in {"measured", "estimated", "unavailable"}:
            _refuse("invalid_provenance", source)
            continue
        if synthetic_flag is True and provenance == "measured":
            _refuse("synthetic_claimed_measured", source)
            continue

        if source in FIRST_PARTY_SOURCES:
            consent = raw.get("consent") if "consent" in raw else meta.get("consent")
            tenant = raw.get("tenantId") or meta.get("tenantId")
            if consent is not True or not str(tenant or "").strip():
                _refuse("missing_consent_or_tenant", source)
                continue
            if source == "triples":
                quality = str(meta.get("quality") or raw.get("quality") or "").strip()
                if quality not in {"reviewed", "gold"} and not reviewed_explicit:
                    _refuse("unreviewed_triple", source)
                    continue

        try:
            messages, parsed_output, url, html_str = _extract_messages_and_output(raw, task)
        except DatasetError:
            _refuse("malformed_row", source)
            continue

        host_key = _normalize_row_host(raw, meta, url)
        if not host_key:
            _refuse("missing_host", source)
            continue

        raw_dh = host_key[5:] if host_key.startswith("hash:") else ""
        if host_key in golden_hosts or (raw_dh and raw_dh in golden_domain_hashes):
            _refuse("golden_host", source)
            continue

        if any(_refuses_golden(m["content"], exact_golden, fragment_golden) for m in messages):
            _refuse("golden_leakage", source)
            continue

        if task == "schema_generation":
            ld_status, _ = check_jsonld_valid(parsed_output)
            if ld_status != "pass":
                _refuse("invalid_jsonld", source)
                continue
            if html_str and html_validator is not None:
                ok_label, label_err = html_validator(html_str, url or "https://example.com/")
                if not ok_label:
                    _refuse(f"label_cli_failed:{label_err}", source)
                    continue

        if provenance != "measured":
            inv_status, _ = check_invented_metrics(parsed_output, {"provenance": provenance})
            if inv_status != "pass":
                _refuse("invented_metrics", source)
                continue

        if strip_pii_enabled:
            messages = strip_pii(messages)

        fingerprint = hashlib.sha256(
            json.dumps([m["content"] for m in messages], sort_keys=True).encode("utf-8")
        ).hexdigest()
        if fingerprint in seen_content:
            _refuse("duplicate", source)
            continue
        seen_content.add(fingerprint)

        split, h_hash = assign_host_split(host_key)
        if split == "train":
            train_hosts.add(host_key)
        else:
            eval_hosts.add(host_key)

        record_meta: Dict[str, Any] = {
            "category": task,
            "task": task,
            "source": source,
            "licence": entry.licence,
            "provenance": provenance,
            "synthetic": bool(synthetic_flag is True),
            "split": split,
            "hostHash": h_hash,
            "domainHash": h_hash,
            "humanReviewed": reviewed_explicit,
        }
        if source in FIRST_PARTY_SOURCES:
            record_meta["consent"] = True
            record_meta["tenantId"] = str(raw.get("tenantId") or meta.get("tenantId"))

        kept_rows.append({"messages": messages, "meta": record_meta})
        by_job[task][split] += 1
        by_job[task]["total"] += 1
        by_split[split] += 1
        src_bucket = by_source.setdefault(source, Counter())
        src_bucket[split] += 1
        src_bucket["kept"] += 1

    host_overlap = train_hosts & eval_hosts
    golden_overlap = eval_hosts & golden_hosts
    if host_overlap:
        raise DatasetError(f"host split leakage detected across {len(host_overlap)} host(s)")
    if golden_overlap:
        raise DatasetError(f"frozen golden host leaked into eval: {sorted(golden_overlap)}")

    report: Dict[str, Any] = {
        "generatedAt": datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z"),
        "totalRead": total_read,
        "kept": len(kept_rows),
        "refusedTotal": sum(refused_by_reason.values()),
        "byJob": {job: dict(sorted(counter.items())) for job, counter in by_job.items()},
        "bySource": {src: dict(sorted(counter.items())) for src, counter in sorted(by_source.items())},
        "bySplit": dict(sorted(by_split.items())),
        "refusedByReason": dict(sorted(refused_by_reason.items())),
        "trainHostCount": len(train_hosts),
        "evalHostCount": len(eval_hosts),
        "hostOverlapCount": len(host_overlap),
        "goldenHostOverlapCount": len(golden_overlap),
        "goldenSha256": (
            hashlib.sha256(golden_path.read_bytes()).hexdigest()
            if golden_path.is_file()
            else None
        ),
    }
    return kept_rows, report


def _load_input_rows(specs: Sequence[str]) -> List[Tuple[Dict[str, Any], Optional[str]]]:
    loaded: List[Tuple[Dict[str, Any], Optional[str]]] = []
    for raw_spec in specs:
        parts = raw_spec.split("=", 1)
        path = Path(parts[0])
        src_override = parts[1].strip() if len(parts) == 2 and parts[1].strip() else None
        if not path.is_file():
            raise DatasetError(f"input dataset file not found: {path}")
        for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError as exc:
                raise DatasetError(f"{path}:{line_no}: invalid JSON: {exc}") from exc
            if not isinstance(obj, dict):
                raise DatasetError(f"{path}:{line_no}: expected JSON object")
            if src_override and "source" not in obj:
                obj["source"] = src_override
            loaded.append((obj, src_override))
    return loaded


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Build host-split v1 SFT dataset (sft-v2.jsonl)")
    parser.add_argument(
        "--in",
        dest="inputs",
        action="append",
        default=None,
        metavar="PATH[=SOURCE_ID]",
        help="Input JSONL file (repeatable); optional =SOURCE_ID default. "
        "Optional since v2 WP9: a scheduled build with no sources writes a "
        "truthful zero-row report instead of failing",
    )
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--golden", type=Path, default=DEFAULT_GOLDEN)
    parser.add_argument(
        "--no-verify-html",
        action="store_true",
        help="Skip invoking scripts/ml-label-cli.ts even if raw html fields are present",
    )
    parser.add_argument("--dry-run", action="store_true", help="Validate without writing files")
    args = parser.parse_args(list(argv) if argv is not None else None)

    try:
        items = _load_input_rows(args.inputs or [])
        validator = None if args.no_verify_html else run_ml_label_cli
        kept_rows, report = build_sft_v2(
            [row for row, _ in items],
            golden_path=args.golden,
            html_validator=validator,
        )
    except DatasetError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    report["output"] = str(args.out)
    if not args.dry_run:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        payload = "\n".join(json.dumps(r, ensure_ascii=False, sort_keys=True) for r in kept_rows)
        bytes_text = (payload + "\n") if payload else ""
        args.out.write_text(bytes_text, encoding="utf-8")
        report["outputSha256"] = hashlib.sha256(bytes_text.encode("utf-8")).hexdigest()

        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"wrote {len(kept_rows)} rows -> {args.out}")
        print(f"report -> {args.report}")
    else:
        print(f"dry run: {len(kept_rows)} rows would be written -> {args.out}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
