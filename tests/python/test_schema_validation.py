"""Tests for Single Source of Truth schema validation in Python."""

import json
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

from python.scripts.models import (
    BrandRule,
    KeywordStrategyMatrix,
    OtaConfig,
)
from python.scripts.validate_schemas import validate_keyword_matrix, validate_ota_config


def test_keyword_strategy_matrix_validation():
    """Verify the hotel pack matrix loads and parses cleanly into KeywordStrategyMatrix model."""
    matrix_path = ROOT_DIR / "src" / "packs" / "hotel" / "keywords.json"
    assert matrix_path.exists(), "Matrix file must exist"
    assert validate_keyword_matrix(matrix_path) is True

    with open(matrix_path, encoding="utf-8") as f:
        data = json.load(f)

    matrix = KeywordStrategyMatrix(**data)
    assert matrix.metadata.totalKeywords == 78
    assert len(matrix.keywords) == 78
    assert len(matrix.categories) == 6
    # Task 4.1: every CPC figure is explicitly labelled illustrative.
    assert all(kw.cpcEstimate.source == "illustrative" for kw in matrix.keywords)
    assert matrix.metadata.notes and "not measured search data" in matrix.metadata.notes


def test_ota_config_validation():
    """Verify live OTA configuration parses cleanly into OtaConfig model."""
    ota_path = ROOT_DIR / "data" / "ota-config.json"
    assert ota_path.exists(), "OTA config file must exist"
    assert validate_ota_config(ota_path) is True

    with open(ota_path, encoding="utf-8") as f:
        data = json.load(f)

    config = OtaConfig(**data)
    assert config.schemaVersion == "2.7.0"
    assert config.pixelLimits.titleMaxPx == 580
    assert config.pixelLimits.descriptionMaxPx == 920
    assert config.scoringWeights.onPage == 0.35


def test_brand_guardrail_model():
    """Verify BrandRule instantiation and forbidden term rules."""
    rule = BrandRule(
        name="Marriott",
        loyaltyProgram="Marriott Bonvoy",
        maxTitleChars=60,
        maxMetaChars=155,
        maxH1Chars=70,
        brandPillColor="#b91c1c",
        forbiddenTerms=[
            {
                "term": "free breakfast",
                "reason": "Marriott brand standards require 'Complimentary hot breakfast'",
                "replacement": "Complimentary hot breakfast",
            }
        ],
    )
    assert rule.name == "Marriott"
    assert rule.maxTitleChars == 60
    assert len(rule.forbiddenTerms) == 1


if __name__ == "__main__":
    test_keyword_strategy_matrix_validation()
    test_ota_config_validation()
    test_brand_guardrail_model()
    print("All Python schema validation tests passed successfully!")
