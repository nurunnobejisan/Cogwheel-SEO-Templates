#!/usr/bin/env python3
"""Unit tests for scripts/python/fine_tune_pipeline.py."""

import json
import shutil
import tempfile
from pathlib import Path
import sys

# Ensure repository root is on path
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT))

from scripts.python.fine_tune_pipeline import (
    validate_and_parse_line,
    validate_dataset_file,
    split_dataset,
    generate_lora_training_config,
    launch_vertex_ai_job,
    compute_evaluation_benchmark,
    render_evaluation_summary_table,
)

SAMPLE_TARGET_OUTPUT = {
    "optimizedTitle": "Panama City Beach Resort & Suites | SpringHill Suites",
    "optimizedMetaDesc": "Book direct at SpringHill Suites Panama City Beach for oceanfront suites, lazy river pool, and best rate guarantee on the Gulf Coast.",
    "optimizedH1": "SpringHill Suites Panama City Beachfront",
    "jsonLdSchema": {
        "@context": "https://schema.org",
        "@type": "Hotel",
        "name": "SpringHill Suites Panama City Beachfront",
    },
    "geoEntityBlock": "SpringHill Suites Panama City Beachfront is an oceanfront hotel located in Florida featuring 200 guest suites, pool amenities, and daily hot breakfast.",
    "brandGuardrail": "Marriott",
}

SAMPLE_GEMINI_LINE = {
    "systemInstruction": {
        "parts": [
            {
                "text": "You are an expert hospitality SEO and GEO AI assistant specializing in Marriott franchise standards."
            }
        ]
    },
    "contents": [
        {
            "role": "user",
            "parts": [
                {
                    "text": "Optimize the following hotel page:\nDomain: www.marriott.com\nTitle: Beachfront Hotels Panama City Beach"
                }
            ],
        },
        {
            "role": "model",
            "parts": [
                {
                    "text": json.dumps(SAMPLE_TARGET_OUTPUT)
                }
            ],
        },
    ],
}

SAMPLE_CHATML_LINE = {
    "messages": [
        {
            "role": "system",
            "content": "You are an expert hospitality SEO assistant specializing in Hilton brand guidelines.",
        },
        {
            "role": "user",
            "content": "Optimize the hotel page for Hilton Denver Downtown.",
        },
        {
            "role": "assistant",
            "content": json.dumps({
                **SAMPLE_TARGET_OUTPUT,
                "optimizedTitle": "Downtown Denver Hotel & Suites | Hilton",
                "brandGuardrail": "Hilton",
            }),
        },
    ],
    "metadata": {
        "canonicalUrl": "https://www.hilton.com/hotel/denver/",
        "qualityScore": 94,
    },
}


def test_gemini_line_validation():
    raw_line = json.dumps(SAMPLE_GEMINI_LINE)
    res = validate_and_parse_line(raw_line, 1)

    assert res.is_valid, f"Validation errors: {res.errors}"
    assert res.format_type == "gemini"
    assert res.brand == "Marriott"
    assert res.token_count > 30


def test_chatml_line_validation():
    raw_line = json.dumps(SAMPLE_CHATML_LINE)
    res = validate_and_parse_line(raw_line, 1)

    assert res.is_valid, f"Validation errors: {res.errors}"
    assert res.format_type == "chatml"
    assert res.brand == "Hilton"
    assert res.token_count > 30


def test_invalid_line_rejection():
    # Invalid JSON
    res_bad_json = validate_and_parse_line("{invalid json}", 1)
    assert not res_bad_json.is_valid

    # Missing target schema fields
    bad_schema_line = {
        "messages": [
            {"role": "user", "content": "hi"},
            {"role": "assistant", "content": json.dumps({"incomplete": True})},
        ]
    }
    res_bad_schema = validate_and_parse_line(json.dumps(bad_schema_line), 2)
    assert not res_bad_schema.is_valid


def test_dataset_split_and_config_generation():
    temp_dir = Path(tempfile.mkdtemp())
    try:
        input_file = temp_dir / "samples.jsonl"
        with input_file.open("w", encoding="utf-8") as f:
            for _ in range(10):
                f.write(json.dumps(SAMPLE_GEMINI_LINE) + "\n")

        summary, valid_lines = validate_dataset_file(input_file)
        assert summary.total_lines == 10
        assert summary.valid_lines == 10
        assert summary.invalid_lines == 0
        assert summary.format_detected == "gemini"

        # Test 90/10 Split
        out_dir = temp_dir / "splits"
        train_p, val_p, train_c, val_c = split_dataset(valid_lines, out_dir, train_ratio=0.9, seed=42)
        assert train_p.exists()
        assert val_p.exists()
        assert train_c == 9
        assert val_c == 1

        # Test LoRA config generation
        lora_cfg = generate_lora_training_config(train_p, val_p, out_dir)
        assert lora_cfg.exists()
        with lora_cfg.open() as f:
            data = json.load(f)
            assert data["lora_parameters"]["r"] == 16
            assert data["training_arguments"]["learning_rate"] == 0.0002

        # Test Vertex AI Job Spec
        vertex_res = launch_vertex_ai_job(train_p, val_p, dry_run=True)
        assert vertex_res["status"] == "DRY_RUN_READY"
        assert vertex_res["hyperparameters"]["epoch_count"] == 3

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_evaluation_summary_table():
    benchmarks = compute_evaluation_benchmark()
    assert "Base Model (Zero-Shot)" in benchmarks
    assert "Cogwheel Tuned Model (SFT)" in benchmarks

    table = render_evaluation_summary_table(benchmarks)
    assert "COGWHEEL SEO STUDIO - FINE-TUNING EVALUATION SUMMARY BENCHMARK" in table
    assert "Title SERP Width Budget" in table
    assert "Brand Guardrail Compliance" in table
    assert "OVERALL COGWHEEL SCORE" in table


if __name__ == "__main__":
    test_gemini_line_validation()
    test_chatml_line_validation()
    test_invalid_line_rejection()
    test_dataset_split_and_config_generation()
    test_evaluation_summary_table()
    print("[PASS] All fine_tune_pipeline tests passed successfully.")
