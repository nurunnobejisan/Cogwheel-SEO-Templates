"""OpenAI-compatible gateway for the SEO Studio fine-tuned model.

``ml/serve`` is the small stdlib-only (D-014) server that sits in front of a
Phase 3 adapter and speaks the ``/v1/models`` + ``/v1/chat/completions``
contract that ``src/core/ai/custom-model.ts`` (and any OpenAI client) speaks.
The app points ``CUSTOM_MODEL_ENDPOINT`` at this gateway; the gateway
forwards to an upstream — either an OpenAI-compatible inference server
(vLLM / SGLang / etc. in front of the LoRA adapter, the supported path) or a
locally loaded adapter (``--adapter``, requires the heavy deps from
``ml/requirements-ml.txt``; raises ``HeavyDepsError`` without them).

Safety properties (docs/PLATFORM_RUNTIME.md):

- **Servability gate** — a model may be served only when its registry status
  is ``ready``; legacy ``unverified`` entries (D-013) are refused unless the
  operator passes ``--allow-unverified`` for a smoke test. /health reports it.
- **No fake completions** — with no upstream configured the gateway answers
  ``503 upstream_not_configured``; it never invents model output.
- **Optional bearer** — with ``SERVE_API_KEY`` set (or ``--api-key``) every
  ``/v1/*`` request must present ``Authorization: Bearer <key>``; the app
  sends ``CUSTOM_MODEL_API_KEY`` as that bearer.
- **No prompt logging** — only method, path, status, model id and latency
  are logged; never prompts, page text or client data.

Run::

    python3 -m ml.serve.server --host 127.0.0.1 --port 8000 \\
        --upstream https://inference.example.com/v1
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, List, Mapping, Optional

from ml.generate import (
    SUPPORTED_TASKS as CONSTRAINED_TASKS,
    build_json_schema_response_format,
    generate_structured,
)
from ml.serve.registry import (
    DEFAULT_REGISTRY,
    RegistryError,
    assert_servable,
    load_registry,
    model_ids,
    resolve_model,
)
from ml.train.errors import HeavyDepsError

__all__ = [
    "ServeConfig",
    "ModelGateway",
    "build_handler",
    "serve",
    "main",
]

DEFAULT_UPSTREAM_TIMEOUT_S = 60.0
MAX_BODY_BYTES = 1_000_000


class ServeConfig:
    """Everything the gateway needs; built once at startup."""

    def __init__(
        self,
        *,
        registry_path: str = str(DEFAULT_REGISTRY),
        upstream: str = "",
        upstream_api_key: str = "",
        api_key: str = "",
        allow_unverified: bool = False,
        timeout_s: float = DEFAULT_UPSTREAM_TIMEOUT_S,
        adapter: str = "",
        fetch_impl=None,
    ) -> None:
        self.registry_path = registry_path
        self.registry = load_registry(_path(registry_path))
        self.upstream = upstream.rstrip("/")
        self.upstream_api_key = upstream_api_key
        self.api_key = api_key
        self.allow_unverified = allow_unverified
        self.timeout_s = timeout_s
        self.adapter = adapter
        self.fetch_impl = fetch_impl  # injected for tests; None = urllib
        self.started_at = time.time()

    def resolve(self, requested: str) -> Dict[str, Any]:
        """Resolve + servability-gate a requested model id (raises RegistryError)."""
        entry = resolve_model(self.registry, requested)
        if entry is None:
            raise RegistryError(f"model {requested!r} is not in the registry")
        assert_servable(entry, allow_unverified=self.allow_unverified)
        return entry


def _path(raw: str):
    from pathlib import Path

    return Path(raw)


class ModelGateway:
    """Request logic, separated from HTTP so tests can call it directly."""

    def __init__(self, config: ServeConfig) -> None:
        self.config = config
        self._adapter_pipeline = None

    def health(self) -> Dict[str, Any]:
        registry = self.config.registry
        entries = registry.get("models", [])
        servable = [
            e["modelId"]
            for e in entries
            if isinstance(e, Mapping)
            if _is_servable(e, self.config.allow_unverified)
        ]
        return {
            "ok": True,
            "uptime_s": round(time.time() - self.config.started_at, 3),
            "upstreamConfigured": bool(self.config.upstream or self.config.adapter),
            "allowUnverified": self.config.allow_unverified,
            "activeModelId": registry.get("activeModelId"),
            "servableModels": servable,
            "totalModels": len(entries),
        }

    def list_models(self) -> Dict[str, Any]:
        data: List[Dict[str, Any]] = []
        for entry in self.config.registry.get("models", []):
            if not isinstance(entry, Mapping):
                continue
            if not _is_servable(entry, self.config.allow_unverified):
                continue
            data.append({"id": entry["modelId"], "owned_by": "seo-studio"})
            for alias in model_ids(entry):
                if alias != entry["modelId"]:
                    data.append({"id": alias, "owned_by": "seo-studio"})
        return {"object": "list", "data": data}

    def chat(self, body: Mapping[str, Any]) -> Dict[str, Any]:
        """Validate, gate, forward. Raises ``GatewayError`` with an HTTP status."""
        messages = body.get("messages")
        if not isinstance(messages, list) or not messages:
            raise GatewayError(400, "bad_request", "'messages' must be a non-empty list")
        for message in messages:
            if not isinstance(message, Mapping) or not isinstance(message.get("content"), str):
                raise GatewayError(400, "bad_request", "each message needs a string 'content'")

        raw_task = body.get("task")
        task: Optional[str] = None
        if raw_task is not None:
            if not isinstance(raw_task, str) or not raw_task.strip():
                raise GatewayError(400, "bad_request", "'task' must be a non-empty string")
            task = raw_task.strip()

        requested = body.get("model") or self.config.registry.get("activeModelId") or ""
        entry = self._resolve_or_raise(str(requested))
        upstream_model = str(entry.get("modelId"))

        payload: Dict[str, Any] = {
            "model": upstream_model,
            "messages": messages,
            "temperature": _number(body.get("temperature"), default=0.2, lo=0.0, hi=2.0),
            "max_tokens": _number(body.get("max_tokens"), default=1024, lo=1, hi=32768),
        }
        if "response_format" in body and body["response_format"] is not None:
            payload["response_format"] = body["response_format"]
        elif task in CONSTRAINED_TASKS:
            payload["response_format"] = build_json_schema_response_format(task)

        if self.config.adapter:
            text = self._run_adapter(payload, task=task)
            return _completion_response(upstream_model, text)
        return self._forward(payload, upstream_model)

    def _resolve_or_raise(self, requested: str) -> Dict[str, Any]:
        try:
            return self.config.resolve(requested)
        except RegistryError as exc:
            message = str(exc)
            if "not in the registry" in message:
                raise GatewayError(404, "model_not_found", message) from exc
            raise GatewayError(403, "model_not_servable", message) from exc

    def _forward(self, payload: Dict[str, Any], model_id: str) -> Dict[str, Any]:
        if not self.config.upstream:
            raise GatewayError(
                503,
                "upstream_not_configured",
                "no upstream configured — pass --upstream or --adapter "
                "(the gateway never fabricates completions)",
            )
        url = f"{self.config.upstream}/chat/completions"
        headers = {"content-type": "application/json"}
        if self.config.upstream_api_key:
            headers["authorization"] = f"Bearer {self.config.upstream_api_key}"
        request = urllib.request.Request(
            url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST"
        )
        try:
            if self.config.fetch_impl is not None:
                response = self.config.fetch_impl(url, payload, headers)
                status = int(response.get("status", 200))
                raw = response.get("body")
            else:
                with urllib.request.urlopen(  # noqa: S310 - operator-configured upstream
                    request, timeout=self.config.timeout_s
                ) as handle:
                    status = handle.status
                    raw = handle.read()
        except urllib.error.HTTPError as exc:
            raise GatewayError(502, "upstream_error", f"upstream HTTP {exc.code}") from exc
        except (urllib.error.URLError, OSError, TimeoutError) as exc:
            raise GatewayError(502, "upstream_error", f"upstream unreachable: {exc}") from exc

        if status < 200 or status >= 300:
            raise GatewayError(502, "upstream_error", f"upstream HTTP {status}")
        if isinstance(raw, (bytes, bytearray)):
            try:
                raw = json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise GatewayError(
                    502, "upstream_bad_response", "upstream sent invalid JSON"
                ) from exc
        if not isinstance(raw, Mapping) or "choices" not in raw:
            raise GatewayError(502, "upstream_bad_response", "upstream response has no 'choices'")
        result = dict(raw)
        result["model"] = model_id  # the id the client asked for, not the upstream's
        return result

    def _run_adapter(self, payload: Dict[str, Any], *, task: Optional[str] = None) -> str:
        """Generate with a locally loaded adapter (heavy deps, lazy import)."""
        pipeline = self._load_adapter()
        prompt = _messages_to_prompt(payload["messages"])
        if task in CONSTRAINED_TASKS:
            text = generate_structured(
                prompt,
                task=task,
                model=pipeline.model,
                max_tokens=int(payload["max_tokens"]),
            )
            if not isinstance(text, str) or not text.strip():
                raise GatewayError(502, "upstream_bad_response", "constrained adapter produced no text")
            return text
        output = pipeline(
            prompt,
            max_new_tokens=int(payload["max_tokens"]),
            temperature=float(payload["temperature"]),
            do_sample=float(payload["temperature"]) > 0,
        )
        text = output[0]["generated_text"] if output else ""
        if not isinstance(text, str) or not text.strip():
            raise GatewayError(502, "upstream_bad_response", "adapter produced no text")
        return text

    def _load_adapter(self):
        if self._adapter_pipeline is not None:
            return self._adapter_pipeline
        try:
            from transformers import AutoModelForCausalLM, AutoTokenizer  # noqa: PLC0415
        except ImportError as exc:  # pragma: no cover - exercised only without ml deps
            raise HeavyDepsError(
                "serving a local adapter needs ml/requirements-ml.txt "
                "(transformers/torch); prefer an OpenAI-compatible --upstream "
                "(vLLM in front of the adapter)"
            ) from exc
        tokenizer = AutoTokenizer.from_pretrained(self.config.adapter)
        model = AutoModelForCausalLM.from_pretrained(self.config.adapter)
        self._adapter_pipeline = _Pipeline(tokenizer, model)
        return self._adapter_pipeline


class _Pipeline:
    """Minimal text-generation callable so the adapter path stays testable."""

    def __init__(self, tokenizer, model) -> None:
        self.tokenizer = tokenizer
        self.model = model

    def __call__(self, prompt: str, *, max_new_tokens: int, temperature: float, do_sample: bool):
        import torch  # noqa: PLC0415 - heavy dep, only reached with ml deps installed

        inputs = self.tokenizer(prompt, return_tensors="pt")
        with torch.no_grad():
            output_ids = self.model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                temperature=max(temperature, 1e-5) if do_sample else None,
                do_sample=do_sample,
                pad_token_id=self.tokenizer.eos_token_id,
            )
        text = self.tokenizer.decode(
            output_ids[0][inputs["input_ids"].shape[1] :], skip_special_tokens=True
        )
        return [{"generated_text": text}]


class GatewayError(Exception):
    """A client-visible failure with an HTTP status and machine code."""

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def _is_servable(entry: Mapping[str, Any], allow_unverified: bool) -> bool:
    status = str(entry.get("status", ""))
    return status == "ready" or (status == "unverified" and allow_unverified)


def _number(value: Any, *, default: float, lo: float, hi: float) -> float:
    if value is None:
        return default
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise GatewayError(400, "bad_request", f"expected a number between {lo} and {hi}")
    if not lo <= float(value) <= hi:
        raise GatewayError(400, "bad_request", f"expected a number between {lo} and {hi}")
    return float(value)


def _messages_to_prompt(messages: List[Mapping[str, Any]]) -> str:
    parts = []
    for message in messages:
        role = str(message.get("role", "user"))
        parts.append(f"{role}: {message.get('content', '')}")
    parts.append("assistant:")
    return "\n".join(parts)


def _completion_response(model_id: str, text: str) -> Dict[str, Any]:
    return {
        "id": f"chatcmpl-{int(time.time() * 1000)}",
        "object": "chat.completion",
        "model": model_id,
        "choices": [
            {"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}
        ],
    }


def build_handler(gateway: ModelGateway):
    """Build a BaseHTTPRequestHandler class bound to ``gateway``."""

    class Handler(BaseHTTPRequestHandler):
        server_version = "seo-studio-serve/1.0"
        protocol_version = "HTTP/1.1"

        def log_message(self, fmt: str, *args: Any) -> None:  # noqa: A003 - stdlib signature
            # No prompt logging (docs/PLATFORM_RUNTIME.md): the default
            # BaseHTTPRequestHandler log line would include the request line
            # only, but we suppress it entirely and log our own redacted line.
            pass

        def _send(self, status: int, payload: Mapping[str, Any]) -> None:
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _error(self, status: int, code: str, message: str) -> None:
            self._send(status, {"error": {"code": code, "message": message}})

        def _authorized(self) -> bool:
            expected = gateway.config.api_key
            if not expected:
                return True
            header = self.headers.get("authorization", "")
            return header == f"Bearer {expected}"

        def do_GET(self) -> None:  # noqa: N802 - stdlib signature
            started = time.time()
            path = self.path.split("?", 1)[0]
            if not self._authorized():
                self._error(401, "unauthorized", "missing or invalid bearer token")
                self._log(path, 401, "", started)
                return
            if path in ("/health", "/v1/health"):
                self._send(200, gateway.health())
                self._log(path, 200, "", started)
            elif path == "/v1/models":
                self._send(200, gateway.list_models())
                self._log(path, 200, "", started)
            else:
                self._error(404, "not_found", f"no route for {path}")
                self._log(path, 404, "", started)

        def do_POST(self) -> None:  # noqa: N802 - stdlib signature
            started = time.time()
            path = self.path.split("?", 1)[0]
            if not self._authorized():
                self._error(401, "unauthorized", "missing or invalid bearer token")
                self._log(path, 401, "", started)
                return
            if path != "/v1/chat/completions":
                self._error(404, "not_found", f"no route for {path}")
                self._log(path, 404, "", started)
                return
            try:
                length = int(self.headers.get("content-length") or 0)
            except ValueError:
                length = 0
            if length <= 0 or length > MAX_BODY_BYTES:
                self._error(400, "bad_request", "missing or oversized request body")
                self._log(path, 400, "", started)
                return
            raw = self.rfile.read(length)
            try:
                body = json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                self._error(400, "bad_request", "request body is not valid JSON")
                self._log(path, 400, "", started)
                return
            if not isinstance(body, Mapping):
                self._error(400, "bad_request", "request body must be a JSON object")
                self._log(path, 400, "", started)
                return
            model_id = str(body.get("model") or "")
            try:
                result = gateway.chat(body)
            except GatewayError as exc:
                self._error(exc.status, exc.code, exc.message)
                self._log(path, exc.status, model_id, started)
                return
            except HeavyDepsError as exc:
                self._error(503, "heavy_deps_missing", str(exc))
                self._log(path, 503, model_id, started)
                return
            self._send(200, result)
            self._log(path, 200, str(result.get("model", model_id)), started)

        def _log(self, path: str, status: int, model_id: str, started: float) -> None:
            # ids, providers, latency and outcomes only — never prompts.
            latency_ms = round((time.time() - started) * 1000, 1)
            sys.stderr.write(
                f"serve {self.command or 'GET'} {path} -> {status} "
                f"model={model_id or '-'} latency_ms={latency_ms}\n"
            )
            sys.stderr.flush()

    return Handler


def serve(config: ServeConfig, host: str, port: int) -> ThreadingHTTPServer:
    """Bind and return the server (caller calls serve_forever())."""
    handler = build_handler(ModelGateway(config))
    return ThreadingHTTPServer((host, port), handler)


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python3 -m ml.serve.server",
        description="OpenAI-compatible gateway for the SEO Studio fine-tuned model",
    )
    parser.add_argument("--host", default="127.0.0.1", help="bind address (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="bind port (default: 8000)")
    parser.add_argument(
        "--registry", default=str(DEFAULT_REGISTRY), help="path to model_registry.json"
    )
    parser.add_argument(
        "--upstream",
        default=os.environ.get("SERVE_UPSTREAM", ""),
        help="OpenAI-compatible base URL, e.g. https://inference.example.com/v1",
    )
    parser.add_argument(
        "--adapter",
        default=os.environ.get("SERVE_ADAPTER", ""),
        help="local adapter path (needs ml/requirements-ml.txt; prefer --upstream)",
    )
    parser.add_argument(
        "--allow-unverified",
        action="store_true",
        help="serve 'unverified' registry entries too (operator smoke tests, D-013)",
    )
    parser.add_argument(
        "--api-key",
        default=os.environ.get("SERVE_API_KEY", ""),
        help="require 'Authorization: Bearer <key>' on /v1/* (also SERVE_API_KEY)",
    )
    args = parser.parse_args(argv)

    try:
        config = ServeConfig(
            registry_path=args.registry,
            upstream=args.upstream,
            upstream_api_key=os.environ.get("UPSTREAM_API_KEY", ""),
            api_key=args.api_key,
            allow_unverified=args.allow_unverified,
            adapter=args.adapter,
        )
    except RegistryError as exc:
        sys.stderr.write(f"registry error: {exc}\n")
        return 2

    server = serve(config, args.host, args.port)
    mode = f"adapter={args.adapter}" if args.adapter else f"upstream={config.upstream or 'NONE'}"
    sys.stderr.write(
        f"seo-studio serve on http://{args.host}:{args.port} ({mode}, "
        f"allow_unverified={args.allow_unverified})\n"
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        sys.stderr.write("\nshutting down\n")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
