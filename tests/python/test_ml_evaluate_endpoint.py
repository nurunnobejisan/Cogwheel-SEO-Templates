#!/usr/bin/env python3
"""Tests for endpoint generation (Phase 5, ml/train/evaluate.py).

A local stub OpenAI-compatible server exercises the real HTTP path:
successful generation over the frozen golden set, bearer handling, and the
fail-closed behaviour (HTTP error, bad shape, empty content) where no
partial output file may be written and no output may be invented.
"""

from __future__ import annotations

import json
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, List, Optional

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.eval import run_eval  # noqa: E402
from ml.train import evaluate as evaluate_module  # noqa: E402
from ml.train.errors import DatasetError  # noqa: E402

GOLDEN = REPO_ROOT / "ml" / "eval" / "golden" / "cases.jsonl"


class StubServer:
    """OpenAI-compatible stub whose behaviour is set per test."""

    def __init__(self, *, status: int = 200, content: Optional[str] = None,
                 body: Optional[bytes] = None, require_bearer: str = "") -> None:
        self.status = status
        self.content = content
        self.body = body
        self.require_bearer = require_bearer
        self.requests: List[Dict[str, Any]] = []
        stub = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, fmt: str, *args: Any) -> None:
                pass

            def do_POST(self) -> None:  # noqa: N802
                length = int(self.headers.get("content-length") or 0)
                raw = self.rfile.read(length)
                payload = json.loads(raw.decode("utf-8"))
                stub.requests.append(
                    {
                        "path": self.path,
                        "authorization": self.headers.get("authorization", ""),
                        "payload": payload,
                    }
                )
                if stub.require_bearer and (
                    self.headers.get("authorization") != f"Bearer {stub.require_bearer}"
                ):
                    self._send(401, {"error": {"message": "unauthorized"}})
                    return
                if stub.body is not None:
                    self._send_raw(stub.status, stub.body)
                    return
                content = stub.content if stub.content is not None else "generated"
                self._send(
                    stub.status,
                    {"choices": [{"message": {"role": "assistant", "content": content}}]},
                )

            def _send(self, status: int, payload: Dict[str, Any]) -> None:
                self._send_raw(status, json.dumps(payload).encode("utf-8"))

            def _send_raw(self, status: int, data: bytes) -> None:
                self.send_response(status)
                self.send_header("content-type", "application/json")
                self.send_header("content-length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}/v1/chat/completions"
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def close(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=5)


@pytest.fixture()
def stub():
    server = StubServer()
    yield server
    server.close()


def _requests(limit: int = 3) -> List[Dict[str, Any]]:
    return evaluate_module.build_requests(GOLDEN)[:limit]


# --------------------------------------------------------------------------- #
# generate_via_endpoint
# --------------------------------------------------------------------------- #

def test_endpoint_generates_rows_for_every_request(stub: StubServer):
    requests = _requests()
    rows = evaluate_module.generate_via_endpoint(
        requests, endpoint=stub.url, model="seo-studio-sft-test"
    )
    assert [row["caseId"] for row in rows] == [r["caseId"] for r in requests]
    for row in rows:
        assert row["templateVersion"] == evaluate_module.TEMPLATE_VERSION
        assert row["endpoint"] == stub.url
        assert row["requestedModel"] == "seo-studio-sft-test"
        assert row["output"] is not None
    # the payload is OpenAI-shaped and deterministic (temperature 0)
    assert len(stub.requests) == len(requests)
    for i, request in enumerate(requests):
        seen = stub.requests[i]
        assert seen["path"] == "/v1/chat/completions"
        assert seen["payload"]["model"] == "seo-studio-sft-test"
        assert seen["payload"]["temperature"] == 0.0
        assert seen["payload"]["messages"] == request["messages"]


def test_endpoint_parses_json_and_string_outputs(stub: StubServer):
    # JSON content parses for JSON tasks; page_classification stays a string
    stub.content = '{"@type": "Hotel"}'
    rows = evaluate_module.generate_via_endpoint(_requests(), endpoint=stub.url)
    assert rows[0]["output"] == {"@type": "Hotel"}

    classification = [r for r in _requests() if r["task"] == "page_classification"]
    if classification:
        stub.content = "  article  "
        rows = evaluate_module.generate_via_endpoint(classification, endpoint=stub.url)
        assert rows[0]["output"] == "article"


def test_endpoint_sends_bearer_from_api_key():
    server = StubServer(require_bearer="sekret")
    try:
        with pytest.raises(DatasetError, match="HTTP 401"):
            evaluate_module.generate_via_endpoint(
                _requests(), endpoint=server.url, api_key="wrong"
            )
        rows = evaluate_module.generate_via_endpoint(
            _requests(limit=1), endpoint=server.url, api_key="sekret"
        )
        assert len(rows) == 1
        assert server.requests[-1]["authorization"] == "Bearer sekret"
    finally:
        server.close()


def test_endpoint_reads_bearer_from_serve_api_key_env(stub: StubServer, monkeypatch):
    monkeypatch.setenv("SERVE_API_KEY", "from-env")
    evaluate_module.generate_via_endpoint(_requests(limit=1), endpoint=stub.url)
    assert stub.requests[-1]["authorization"] == "Bearer from-env"


# --------------------------------------------------------------------------- #
# Fail-closed behaviour
# --------------------------------------------------------------------------- #

def test_endpoint_http_error_names_the_case_and_writes_nothing():
    server = StubServer(status=503, content=None, body=b'{"error": "busy"}')
    try:
        with pytest.raises(DatasetError) as exc:
            evaluate_module.generate_via_endpoint(_requests(), endpoint=server.url)
        assert "HTTP 503" in str(exc.value)
        assert "while generating" in str(exc.value)
    finally:
        server.close()


def test_endpoint_bad_shape_or_empty_content_fails():
    for body, match in (
        (b'{"choices": []}', "unusable body"),
        (b'{"nope": true}', "unusable body"),
        (b"not json at all", "unusable body"),
        (b'{"choices": [{"message": {"content": "   "}}]}', "empty content"),
    ):
        server = StubServer(body=body)
        try:
            with pytest.raises(DatasetError, match=match):
                evaluate_module.generate_via_endpoint(_requests(), endpoint=server.url)
        finally:
            server.close()


def test_endpoint_unreachable_and_unset_fail():
    with pytest.raises(DatasetError, match="needs an endpoint"):
        evaluate_module.generate_via_endpoint(_requests(), endpoint="  ")
    with pytest.raises(DatasetError, match="no requests"):
        evaluate_module.generate_via_endpoint([], endpoint="http://127.0.0.1:1/x")
    with pytest.raises(DatasetError, match="unreachable"):
        evaluate_module.generate_via_endpoint(
            _requests(limit=1), endpoint="http://127.0.0.1:1/v1/chat/completions", timeout_s=2
        )


# --------------------------------------------------------------------------- #
# CLI + integration with run_eval (outputsMeta)
# --------------------------------------------------------------------------- #

def test_cli_endpoint_mode_end_to_end(stub: StubServer, tmp_path: Path, monkeypatch):
    out = tmp_path / "endpoint-outputs.jsonl"
    monkeypatch.delenv("CUSTOM_MODEL_ID", raising=False)
    code = evaluate_module.main(
        ["--endpoint", stub.url, "--out", str(out), "--golden", str(GOLDEN)]
    )
    assert code == 0
    rows = [json.loads(line) for line in out.read_text(encoding="utf-8").splitlines()]
    assert len(rows) == 52

    # run_eval carries the provenance through as outputsMeta (never a score)
    report = run_eval.run(GOLDEN, out)
    assert report["outputsProvided"] == 52
    assert report["outputsMeta"]["endpoint"] == [stub.url]
    assert report["outputsMeta"]["templateVersion"] == [evaluate_module.TEMPLATE_VERSION]


def test_cli_refuses_generate_and_endpoint_together(stub: StubServer, capsys):
    assert evaluate_module.main(["--generate", "--endpoint", stub.url, "--out", "x.jsonl"]) == 1
    assert "not both" in capsys.readouterr().err


def test_cli_endpoint_requires_out(stub: StubServer, capsys):
    assert evaluate_module.main(["--endpoint", stub.url]) == 1
    assert "--out" in capsys.readouterr().err


def test_cli_endpoint_failure_leaves_no_output_file(tmp_path: Path, capsys):
    server = StubServer(status=500, body=b'{"error": true}')
    try:
        out = tmp_path / "should-not-exist.jsonl"
        code = evaluate_module.main(["--endpoint", server.url, "--out", str(out)])
        assert code == 1
        assert not out.exists()
        assert "HTTP 500" in capsys.readouterr().err
    finally:
        server.close()


def test_default_action_still_writes_requests(tmp_path: Path, monkeypatch, capsys):
    monkeypatch.delenv("CUSTOM_MODEL_ENDPOINT", raising=False)
    target = tmp_path / "requests.jsonl"
    code = evaluate_module.main(["--requests", str(target)])
    assert code == 0
    rows = [json.loads(line) for line in target.read_text(encoding="utf-8").splitlines()]
    assert len(rows) == 52
    assert "--endpoint" in capsys.readouterr().out
