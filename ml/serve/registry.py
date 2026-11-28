"""Reader for ``data/models/model_registry.json``.

Model ids use the ``seo-studio-*`` prefix. The migration helpers accept ids
without changing them, so callers can pass an id through the same path if an
alias is reintroduced later.

Servability: an entry may be served only when its ``status`` is ``ready``.
The legacy ``tuned_gemini`` entries are ``unverified`` (D-013) and are
refused by default; ``--allow-unverified`` overrides for operator-side smoke
tests and is reported by ``/health``.

Standard library only (D-014).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional

__all__ = [
    "RegistryError",
    "DEFAULT_REGISTRY",
    "migrate_model_id",
    "debranded_id",
    "load_registry",
    "resolve_model",
    "model_ids",
    "assert_servable",
]

#: Optional alias prefix -> canonical prefix. Empty: ids are already canonical.
ALIASES: Dict[str, str] = {}

DEFAULT_REGISTRY = Path("data/models/model_registry.json")


class RegistryError(Exception):
    """The registry file is malformed, or an entry may not be served."""


def migrate_model_id(model_id: str) -> str:
    """Map an accepted alias onto the persisted id (no-op when already legacy)."""
    if not isinstance(model_id, str):
        raise RegistryError(f"model id must be a string, got {type(model_id).__name__}")
    for alias_prefix, persisted_prefix in ALIASES.items():
        if model_id.startswith(alias_prefix):
            return persisted_prefix + model_id[len(alias_prefix) :]
    return model_id


def debranded_id(model_id: str) -> str:
    """The de-branded spelling of a persisted id (for advertisement only)."""
    for alias_prefix, persisted_prefix in ALIASES.items():
        if model_id.startswith(persisted_prefix):
            return alias_prefix + model_id[len(persisted_prefix) :]
    return model_id


def load_registry(path: Path = DEFAULT_REGISTRY) -> Dict[str, Any]:
    """Load and shape-validate the registry JSON."""
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise RegistryError(f"cannot read registry {path}: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise RegistryError(f"registry {path} is not valid JSON: {exc}") from exc
    if not isinstance(payload, Mapping):
        raise RegistryError(f"registry {path} must be a JSON object")
    models = payload.get("models")
    if not isinstance(models, list):
        raise RegistryError(f"registry {path} must contain a 'models' list")
    for index, entry in enumerate(models):
        if not isinstance(entry, Mapping):
            raise RegistryError(f"registry {path}: models[{index}] must be an object")
        if not isinstance(entry.get("modelId"), str) or not entry["modelId"]:
            raise RegistryError(f"registry {path}: models[{index}] needs a non-empty modelId")
        if not isinstance(entry.get("status"), str):
            raise RegistryError(f"registry {path}: models[{index}] needs a status")
    active = payload.get("activeModelId")
    if active is not None and not isinstance(active, str):
        raise RegistryError(f"registry {path}: activeModelId must be a string")
    return dict(payload)


def resolve_model(registry: Mapping[str, Any], requested: str) -> Optional[Dict[str, Any]]:
    """Find an entry by exact id, by migrated alias, or by recorded alias."""
    if not isinstance(requested, str) or not requested:
        return None
    migrated = migrate_model_id(requested)
    for entry in registry.get("models", []):
        if not isinstance(entry, Mapping):
            continue
        if entry.get("modelId") == requested or entry.get("modelId") == migrated:
            return dict(entry)
        aliases = entry.get("aliases")
        if isinstance(aliases, list) and requested in aliases:
            return dict(entry)
    return None


def model_ids(entry: Mapping[str, Any]) -> List[str]:
    """Every spelling an entry answers to: persisted id, alias, de-branded id."""
    persisted = str(entry["modelId"])
    ids: List[str] = [persisted]
    aliases = entry.get("aliases")
    if isinstance(aliases, list):
        ids.extend(str(a) for a in aliases if isinstance(a, str) and a)
    branded = debranded_id(persisted)
    if branded != persisted:
        ids.append(branded)
    return ids


def assert_servable(entry: Mapping[str, Any], *, allow_unverified: bool = False) -> None:
    """Raise ``RegistryError`` unless the entry may be served."""
    status = str(entry.get("status", ""))
    if status == "ready":
        return
    if status == "unverified" and allow_unverified:
        return
    raise RegistryError(
        f"model {entry['modelId']!r} has status {status!r} and may not be served"
        + (
            " (unverified legacy entry — pass --allow-unverified for a smoke test, "
            "see D-013)"
            if status == "unverified"
            else ""
        )
    )
