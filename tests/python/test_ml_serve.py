#!/usr/bin/env python3
"""Tests for the serving gateway (ml/serve/).

Registry alias migration and servability gates, gateway request logic
(OpenAI contract, fail-closed upstream, error codes), the HTTP surface
(auth, routes, JSON validation), and the lazy heavy-dependency boundary for
local adapter loading. CI has no torch (D-014).
"""

from __future__ import annotations

import importlib.util
import json
import sys
import threading
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.serve import registry as registry_module  # noqa: E402
from ml.serve.registry import (  # noqa: E402
    DEFAULT_REGISTRY,
    RegistryError,
    assert_servable,
    debranded_id,
    load_registry,
    migrate_model_id,
    model_ids,
    resolve_model,
)
from ml.serve.server import (  # noqa: E402
    GatewayError,
    ModelGateway,
    ServeConfig,
    main,
    serve,
)
from ml.train.errors import HeavyDepsError  # noqa: E402

READY_ID = "cogwheel-seo-unified-v9"
LEGACY_ID = "cogwheel-seo-unified-tuned_gemini-v1795487332"


def _write_registry(path: Path) -> Path:
    payload = {
        "activeModelId": READY_ID,
        "models": [
            {"modelId": READY_ID, "status": "ready", "baseModel": "qwen2.5-7b"},
            {"modelId": LEGACY_ID, "status": "unverified", "provider": "tuned_gemini"},
        ],
    }
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


@pytest.fixture()
def registry_path(tmp_path: Path) -> Path:
    return _write_registry(tmp_path / "model_registry.json")


def _config(registry_path: Path, **kwargs: Any) -> ServeConfig:
    kwargs.setdefault("registry_path", str(registry_path))
    return ServeConfig(**kwargs)


def _messages() -> list:
    return [{"role": "user", "content": "rewrite this title"}]


# --------------------------------------------------------------------------- #
# Registry: alias migration and servability
# --------------------------------------------------------------------------- #

def test_alias_migration_is_one_way():
    assert migrate_model_id("seo-studio-seo-unified-v9") == READY_ID
    assert migrate_model_id(READY_ID) == READY_ID
    assert debranded_id(READY_ID) == "seo-studio-seo-unified-v9"
    # storage never changes: the de-branded spelling maps back to persisted
    assert migrate_model_id(debranded_id(LEGACY_ID)) == LEGACY_ID


def test_resolve_accepts_both_spellings(registry_path: Path):
    registry = load_registry(registry_path)
    for spelling in (READY_ID, "seo-studio-seo-unified-v9"):
        entry = resolve_model(registry, spelling)
        assert entry is not None
        assert entry["modelId"] == READY_ID
    assert resolve_model(registry, "seo-studio-does-not-exist") is None
    assert resolve_model(registry, "") is None


def test_real_registry_loads_and_resolves_its_own_ids():
    registry = load_registry(Path(str(DEFAULT_REGISTRY)))
    for entry in registry["models"]:
        assert resolve_model(registry, entry["modelId"]) is not None
        for spelling in model_ids(entry):
            assert resolve_model(registry, spelling)["modelId"] == entry["modelId"]


def test_model_ids_advertises_every_spelling(registry_path: Path):
    entry = resolve_model(load_registry(registry_path), READY_ID)
    ids = model_ids(entry)
    assert READY_ID in ids
    assert "seo-studio-seo-unified-v9" in ids


def test_assert_servable_gates_on_status():
    ready = {"modelId": READY_ID, "status": "ready"}
    legacy = {"modelId": LEGACY_ID, "status": "unverified"}
    missing = {"modelId": "x", "status": "deprecated"}
    assert_servable(ready)  # ready always passes
    with pytest.raises(RegistryError, match="may not be served"):
        assert_servable(legacy)
    assert_servable(legacy, allow_unverified=True)
    with pytest.raises(RegistryError, match="may not be served"):
        assert_servable(missing)


def test_load_registry_validates_shape(tmp_path: Path):
    bad = tmp_path / "bad.json"
    bad.write_text('{"models": "nope"}', encoding="utf-8")
    with pytest.raises(RegistryError, match="'models' list"):
        load_registry(bad)
    bad.write_text("{not json", encoding="utf-8")
    with pytest.raises(RegistryError, match="not valid JSON"):
        load_registry(bad)
    bad.write_text("[]", encoding="utf-8")
    with pytest.raises(RegistryError, match="JSON object"):
        load_registry(bad)
    with pytest.raises(RegistryError, match="cannot read registry"):
        load_registry(tmp_path / "missing.json")


# --------------------------------------------------------------------------- #
# Gateway request logic
# --------------------------------------------------------------------------- #

def test_health_reports_servability(registry_path: Path):
    strict = ModelGateway(_config(registry_path)).health()
    assert strict["ok"] is True
    assert strict["upstreamConfigured"] is False
    assert strict["servableModels"] == [READY_ID]
    assert strict["totalModels"] == 2

    lax = ModelGateway(_config(registry_path, allow_unverified=True)).health()
    assert set(lax["servableModels"]) == {READY_ID, LEGACY_ID}


def test_list_models_hides_unservable(registry_path: Path):
    strict = ModelGateway(_config(registry_path)).list_models()
    ids = {m["id"] for m in strict["data"]}
    assert READY_ID in ids
    assert "seo-studio-seo-unified-v9" in ids
    assert LEGACY_ID not in ids

    lax = ModelGateway(_config(registry_path, allow_unverified=True)).list_models()
    assert {m["id"] for m in lax["data"]} >= {READY_ID, LEGACY_ID}


def test_chat_forwards_openai_shape(registry_path: Path):
    captured: Dict[str, Any] = {}

    def fake_fetch(url: str, payload: Dict[str, Any], headers: Dict[str, str]):
        captured.update(url=url, payload=payload, headers=headers)
        return {
            "status": 200,
            "body": {
                "choices": [{"message": {"role": "assistant", "content": "new title"}}],
                "model": "upstream-internal-name",
            },
        }

    gateway = ModelGateway(
        _config(registry_path, upstream="https://infer.example.com/v1", fetch_impl=fake_fetch)
    )
    result = gateway.chat({"model": "seo-studio-seo-unified-v9", "messages": _messages()})
    assert result["choices"][0]["message"]["content"] == "new title"
    # the client's id is echoed back, not the upstream's internal name
    assert result["model"] == READY_ID
    assert captured["url"] == "https://infer.example.com/v1/chat/completions"
    assert captured["payload"]["model"] == READY_ID
    assert captured["payload"]["temperature"] == 0.2
    assert captured["payload"]["max_tokens"] == 1024


def test_chat_fails_closed_without_upstream(registry_path: Path):
    gateway = ModelGateway(_config(registry_path))
    with pytest.raises(GatewayError) as exc:
        gateway.chat({"model": READY_ID, "messages": _messages()})
    assert exc.value.status == 503
    assert exc.value.code == "upstream_not_configured"
    assert "never fabricates" in exc.value.message


def test_chat_gates_models(registry_path: Path):
    gateway = ModelGateway(_config(registry_path))
    with pytest.raises(GatewayError) as missing:
        gateway.chat({"model": "seo-studio-ghost", "messages": _messages()})
    assert (missing.value.status, missing.value.code) == (404, "model_not_found")

    with pytest.raises(GatewayError) as unverified:
        gateway.chat({"model": LEGACY_ID, "messages": _messages()})
    assert (unverified.value.status, unverified.value.code) == (403, "model_not_servable")


def test_chat_validates_body(registry_path: Path):
    gateway = ModelGateway(_config(registry_path))
    for body in (
        {},
        {"messages": []},
        {"messages": [{"role": "user"}]},
        {"messages": _messages(), "temperature": "hot"},
        {"messages": _messages(), "max_tokens": 0},
        {"messages": _messages(), "max_tokens": 999999},
    ):
        with pytest.raises(GatewayError) as exc:
            gateway.chat(body)
        assert exc.value.status == 400
        assert exc.value.code == "bad_request"


def test_chat_maps_upstream_failures(registry_path: Path):
    def five_hundred(_url, _payload, _headers):  # noqa: ANN001
        return {"status": 500, "body": {}}

    gateway = ModelGateway(
        _config(registry_path, upstream="https://infer.example.com/v1", fetch_impl=five_hundred)
    )
    with pytest.raises(GatewayError) as exc:
        gateway.chat({"model": READY_ID, "messages": _messages()})
    assert (exc.value.status, exc.value.code) == (502, "upstream_error")

    def bad_shape(_url, _payload, _headers):  # noqa: ANN001
        return {"status": 200, "body": {"nope": True}}

    gateway = ModelGateway(
        _config(registry_path, upstream="https://infer.example.com/v1", fetch_impl=bad_shape)
    )
    with pytest.raises(GatewayError) as exc:
        gateway.chat({"model": READY_ID, "messages": _messages()})
    assert exc.value.code == "upstream_bad_response"


@pytest.mark.skipif(
    importlib.util.find_spec("transformers") is not None,
    reason="with transformers installed the adapter path would try to load weights",
)
def test_adapter_mode_needs_heavy_deps(registry_path: Path):
    gateway = ModelGateway(_config(registry_path, adapter="/nonexistent/adapter"))
    with pytest.raises(HeavyDepsError, match="requirements-ml"):
        gateway.chat({"model": READY_ID, "messages": _messages()})


# --------------------------------------------------------------------------- #
# HTTP surface
# --------------------------------------------------------------------------- #

@pytest.fixture()
def http_server(registry_path: Path):
    config = _config(registry_path, upstream="")  # no upstream: fail closed
    server = serve(config, "127.0.0.1", 0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    yield base
    server.shutdown()
    server.server_close()
    thread.join(timeout=5)


def _get(url: str) -> Any:
    try:
        with urllib.request.urlopen(url, timeout=5) as response:  # noqa: S310
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read().decode("utf-8"))


def _post(url: str, body: bytes, headers: Dict[str, str] | None = None) -> Any:
    request = urllib.request.Request(  # noqa: S310
        url, data=body, headers=headers or {"content-type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(request, timeout=5) as response:  # noqa: S310
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read().decode("utf-8"))


def test_http_health_and_models(http_server: str):
    status, health = _get(f"{http_server}/health")
    assert status == 200
    assert health["ok"] is True
    assert health["upstreamConfigured"] is False

    status, models = _get(f"{http_server}/v1/models")
    assert status == 200
    assert models["object"] == "list"
    assert any(m["id"] == READY_ID for m in models["data"])


def test_http_chat_fails_closed_without_upstream(http_server: str):
    status, payload = _post(
        f"{http_server}/v1/chat/completions",
        json.dumps({"model": READY_ID, "messages": _messages()}).encode("utf-8"),
    )
    assert status == 503
    assert payload["error"]["code"] == "upstream_not_configured"


def test_http_error_paths(http_server: str):
    status, payload = _post(
        f"{http_server}/v1/chat/completions",
        json.dumps({"model": "seo-studio-ghost", "messages": _messages()}).encode("utf-8"),
    )
    assert (status, payload["error"]["code"]) == (404, "model_not_found")

    status, payload = _post(
        f"{http_server}/v1/chat/completions",
        json.dumps({"model": LEGACY_ID, "messages": _messages()}).encode("utf-8"),
    )
    assert (status, payload["error"]["code"]) == (403, "model_not_servable")

    status, payload = _post(f"{http_server}/v1/chat/completions", b"{not json")
    assert (status, payload["error"]["code"]) == (400, "bad_request")

    status, payload = _post(f"{http_server}/v1/chat/completions", b"")
    assert (status, payload["error"]["code"]) == (400, "bad_request")

    status, payload = _post(
        f"{http_server}/nope", json.dumps({"model": READY_ID}).encode("utf-8")
    )
    assert (status, payload["error"]["code"]) == (404, "not_found")


def test_http_requires_bearer_when_api_key_set(registry_path: Path):
    config = _config(registry_path, api_key="hunter2")
    server = serve(config, "127.0.0.1", 0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    try:
        status, payload = _post(
            f"{base}/v1/chat/completions",
            json.dumps({"model": READY_ID, "messages": _messages()}).encode("utf-8"),
        )
        assert (status, payload["error"]["code"]) == (401, "unauthorized")

        status, _ = _get(f"{base}/v1/models")  # GET without token
        assert status == 401

        status, _ = _post(
            f"{base}/v1/chat/completions",
            json.dumps({"model": READY_ID, "messages": _messages()}).encode("utf-8"),
            headers={
                "content-type": "application/json",
                "authorization": "Bearer hunter2",
            },
        )
        # authorized now — reaches the fail-closed upstream check
        assert status == 503
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def test_main_reports_registry_errors(tmp_path: Path, capsys: pytest.CaptureFixture):
    bad = tmp_path / "bad.json"
    bad.write_text('{"models": 3}', encoding="utf-8")
    assert main(["--registry", str(bad)]) == 2
    assert "registry error" in capsys.readouterr().err


def test_registry_module_exports():
    for name in ("migrate_model_id", "load_registry", "resolve_model", "assert_servable"):
        assert hasattr(registry_module, name)
