"""Licence gate for the ML pipeline — the Python half of ``ml/sources.yaml``.

``ml/sources.yaml`` is the authored single source of truth. ``ml/sources.json``
is its generated mirror (``npm run ml:sources:export``) because the CI Python
job installs only the root ``requirements.txt`` and therefore has no PyYAML.
This module reads the mirror with the standard library alone.

Three ways in, same gate:

1. ``require_licence(source_id)`` -> the licence string, or ``LicenceError``.
2. ``assert_trainable(source_id, split)`` -> raises when a source whose ``use``
   is ``avoid`` or ``eval_only`` is about to enter a train split (rule 3).
3. ``register_example(...)`` -> builds an ``MlExample``-shaped dict and
   refuses to stamp ``synthetic: true`` as ``provenance: "measured"`` (rule 6).

Never bypass these to write a dataset row.
"""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional

__all__ = [
    "LicenceError",
    "Source",
    "SourceRegistry",
    "load_registry",
    "require_licence",
    "assert_trainable",
    "register_example",
    "domain_hash",
    "TRAINABLE_USES",
]

# `use` values that may enter a train split. Mirrors TRAINABLE_USES in
# scripts/validate-training-data.mjs and scripts/validate-ml-examples.ts.
TRAINABLE_USES = frozenset({"train", "train_attribution"})

_REGISTRY_PATH = Path(__file__).resolve().parent / "sources.json"


class LicenceError(Exception):
    """A source is missing, forbidden, or mislabelled."""


@dataclass(frozen=True)
class Source:
    """One row of the licence registry."""

    id: str
    name: str
    licence: str
    use: str
    feeds: tuple = field(default_factory=tuple)
    attribution_required: bool = False
    url: str = ""
    notes: str = ""

    @property
    def trainable(self) -> bool:
        """True when this source may enter a train split."""
        return self.use in TRAINABLE_USES

    @property
    def needs_attribution(self) -> bool:
        return self.attribution_required


class SourceRegistry:
    """Immutable, id-keyed view of ``ml/sources.json``."""

    def __init__(self, payload: Mapping[str, Any], path: Path) -> None:
        self.path = path
        self.version = int(payload.get("version", 0))
        self.updated = str(payload.get("updated", ""))
        entries = payload.get("sources")
        if not isinstance(entries, list) or not entries:
            raise LicenceError(f"{path}: `sources` must be a non-empty list")

        by_id: Dict[str, Source] = {}
        for raw in entries:
            if not isinstance(raw, Mapping):
                raise LicenceError(f"{path}: every source must be an object")
            sid = raw.get("id")
            if not isinstance(sid, str) or not sid.strip():
                raise LicenceError(f"{path}: every source needs a string `id`")
            if sid in by_id:
                raise LicenceError(f"{path}: duplicate id {sid!r}")
            use = raw.get("use")
            if use not in TRAINABLE_USES and use not in {"eval_only", "avoid"}:
                raise LicenceError(f"{path}: {sid!r} has unknown use={use!r}")
            licence = raw.get("licence")
            if not isinstance(licence, str) or not licence.strip():
                raise LicenceError(f"{path}: {sid!r} needs a `licence`")
            by_id[sid] = Source(
                id=sid,
                name=str(raw.get("name", sid)),
                licence=licence,
                use=str(use),
                feeds=tuple(raw.get("feeds") or ()),
                attribution_required=bool(raw.get("attribution_required")),
                url=str(raw.get("url") or ""),
                notes=str(raw.get("notes") or ""),
            )
        self._by_id = by_id

    # ---------------------------------------------------------------- read --
    def __len__(self) -> int:
        return len(self._by_id)

    def __contains__(self, source_id: str) -> bool:
        return source_id in self._by_id

    def __iter__(self):
        return iter(self._by_id.values())

    def get(self, source_id: str) -> Optional[Source]:
        return self._by_id.get(source_id)

    def ids(self) -> List[str]:
        return list(self._by_id)

    def trainable_ids(self) -> List[str]:
        return [s.id for s in self._by_id.values() if s.trainable]

    def require(self, source_id: str) -> Source:
        """Return the source or raise — the common path."""
        entry = self._by_id.get(source_id)
        if entry is None:
            known = ", ".join(sorted(self._by_id))
            raise LicenceError(
                f"unknown source {source_id!r}; declare it in ml/sources.yaml "
                f"and run `npm run ml:sources:export`. Known: {known}"
            )
        return entry

    # --------------------------------------------------------------- gates --
    def licence_of(self, source_id: str) -> str:
        """The licence string, exactly as written in the registry."""
        return self.require(source_id).licence

    def assert_trainable(self, source_id: str, split: str) -> Source:
        """Rule 3: refuse to put an avoid/eval_only source into a train split."""
        entry = self.require(source_id)
        if split == "train" and not entry.trainable:
            raise LicenceError(
                f"source {source_id!r} has use={entry.use} and may not enter a "
                f"train split (rule 3). Use it for evaluation only, or pick a "
                f"`train` / `train_attribution` source."
            )
        return entry

    def assert_attributed(self, source_id: str, notices: Iterable[str]) -> None:
        """Rule 3: a train_attribution source must appear in the notices."""
        entry = self.require(source_id)
        if not entry.needs_attribution:
            return
        haystack = " ".join(notices).lower()
        if entry.id.lower() not in haystack and entry.name.lower() not in haystack:
            raise LicenceError(
                f"source {source_id!r} requires attribution — add it to "
                f"THIRD_PARTY_NOTICES.md / docs/ATTRIBUTION.md"
            )


_REGISTRY: Optional[SourceRegistry] = None


def load_registry(refresh: bool = False) -> SourceRegistry:
    """Load (and memoise) the registry from ``ml/sources.json``."""
    global _REGISTRY
    if _REGISTRY is not None and not refresh:
        return _REGISTRY
    if not _REGISTRY_PATH.is_file():
        raise LicenceError(
            f"missing {_REGISTRY_PATH} — run `npm run ml:sources:export`"
        )
    try:
        payload = json.loads(_REGISTRY_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise LicenceError(f"{_REGISTRY_PATH} is not valid JSON: {exc}") from exc
    _REGISTRY = SourceRegistry(payload, _REGISTRY_PATH)
    return _REGISTRY


def require_licence(source_id: str) -> str:
    """Module-level convenience wrapper around ``load_registry()``."""
    return load_registry().licence_of(source_id)


def assert_trainable(source_id: str, split: str) -> Source:
    """Module-level convenience wrapper around ``load_registry()``."""
    return load_registry().assert_trainable(source_id, split)


# --------------------------------------------------------------- row builder


def domain_hash(domain: str) -> str:
    """Split-grouping key. Never the raw domain — the plan forbids leaking it."""
    return hashlib.sha256(domain.encode("utf-8")).hexdigest()[:16]


def _sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def register_example(
    *,
    task: str,
    source: str,
    input: Mapping[str, Any],
    output: Any,
    split: str,
    provenance: str,
    synthetic: bool,
    licence: Optional[str] = None,
    tenant_id: Optional[str] = None,
    consent: Optional[bool] = None,
    created_at: Optional[str] = None,
) -> Dict[str, Any]:
    """Build a schema-valid ``MlExample`` dict, enforcing rules 3 and 6.

    Raises ``LicenceError`` when:
      - the source is unknown (rule 3);
      - the source cannot enter the requested split (rule 3);
      - ``synthetic`` is true while ``provenance == "measured"`` (rule 6);
      - ``provenance`` is not one of measured / estimated / unavailable;
      - ``split`` is not train / eval / test;
      - first-party rows omit ``consent`` or ``tenantId`` (rule: consent +
        tenantId on anything derived from client data).
    """
    registry = load_registry()

    if split not in {"train", "eval", "test"}:
        raise LicenceError(f"split must be train|eval|test, got {split!r}")
    if provenance not in {"measured", "estimated", "unavailable"}:
        raise LicenceError(
            f"provenance must be measured|estimated|unavailable, got {provenance!r}"
        )

    entry = registry.assert_trainable(source, split)

    if synthetic and provenance == "measured":
        raise LicenceError(
            "rule 6: a synthetic row cannot claim provenance='measured'. "
            "Use provenance='estimated' for synthetic data."
        )
    if synthetic and split == "train":
        raise LicenceError(
            "rule 6: synthetic rows may not enter a train split. "
            f"Move this row to split='eval' (source={source!r})."
        )

    if consent is not None and consent is not True:
        raise LicenceError("consent must be true when present — never train on unconsented data")

    # First-party sources carry client-derived data: consent and tenantId are
    # mandatory, and PII must already be stripped by ml.clean.
    first_party = entry.id in {"vault", "patches", "triples"}
    if first_party:
        if consent is not True:
            raise LicenceError(
                f"source {entry.id!r} is first-party: `consent: true` is required"
            )
        if not tenant_id:
            raise LicenceError(
                f"source {entry.id!r} is first-party: `tenantId` is required "
                "for per-tenant isolation"
            )

    payload_in = dict(input)
    canonical = json.dumps(
        {"task": task, "input": payload_in}, sort_keys=True, separators=(",", ":")
    )

    row: Dict[str, Any] = {
        "id": _sha256_hex(canonical),
        "task": task,
        "input": payload_in,
        "output": output,
        "provenance": provenance,
        "source": entry.id,
        "licence": entry.licence,
        "synthetic": bool(synthetic),
        "split": split,
        "createdAt": created_at
        or datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    }
    if tenant_id:
        row["tenantId"] = tenant_id
    if consent is True:
        row["consent"] = True
    return row


def default_registry_path() -> Path:
    """Exposed for tests."""
    return _REGISTRY_PATH


def env_flag(name: str, default: bool = False) -> bool:
    """Read a boolean env var without inventing a value when it is unset."""
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}
