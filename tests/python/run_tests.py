#!/usr/bin/env python3
"""Master test runner for Python layer (pytest compatible)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import test_content_engine
import test_fine_tune_pipeline
import test_hotel_engine
import test_hotel_seo
import test_pydantic_models
import test_schema_validation


def run_all():
    print("=" * 80)
    print(" SEO STUDIO SEO STUDIO - PYTHON TEST RUNNER")
    print("=" * 80)

    print("\n> Running test_hotel_engine...")
    test_hotel_engine.test_hotel_extractor_json_ld_and_facts()
    test_hotel_engine.test_geo_scorer_evaluates_citation_readiness()
    test_hotel_engine.test_template_processor_renders_all_templates()
    test_hotel_engine.test_process_property_pipeline()
    print("[PASS] All Hotel Extractor, GEO Scorer & Template Processor tests passed.")

    print("\n> Running test_hotel_seo...")
    test_hotel_seo.test_property_audit_valid()
    test_hotel_seo.test_property_audit_forbids_extra_fields()
    test_hotel_seo.test_property_audit_rejects_negative_word_count()
    test_hotel_seo.test_geo_signals_valid()
    test_hotel_seo.test_geo_signals_score_boundaries()
    test_hotel_seo.test_template_payload_valid()
    test_hotel_seo.test_hotel_seo_audit_aggregate()
    print("[PASS] All Hotel SEO Single Source of Truth model tests passed.")

    print("\n> Running test_pydantic_models...")
    test_pydantic_models.test_destination_guide_model_defaults()
    test_pydantic_models.test_room_showcase_model()
    test_pydantic_models.test_hotel_faq_model()
    test_pydantic_models.test_page_metadata_model()
    print("[PASS] All Pydantic model tests passed.")

    print("\n> Running test_content_engine...")
    test_content_engine.test_clean_text_and_count()
    test_content_engine.test_jaccard_similarity_calculation()
    test_content_engine.test_batch_similarity_audit_blocks_duplicates()
    test_content_engine.test_internal_link_graph_generation()
    print("[PASS] All Content Engine & Similarity tests passed.")

    print("\n> Running test_schema_validation...")
    test_schema_validation.test_keyword_strategy_matrix_validation()
    test_schema_validation.test_ota_config_validation()
    test_schema_validation.test_brand_guardrail_model()
    print("[PASS] All Schema Validation tests passed.")

    print("\n> Running test_fine_tune_pipeline...")
    test_fine_tune_pipeline.test_gemini_line_validation()
    test_fine_tune_pipeline.test_chatml_line_validation()
    test_fine_tune_pipeline.test_invalid_line_rejection()
    test_fine_tune_pipeline.test_dataset_split_and_config_generation()
    test_fine_tune_pipeline.test_evaluation_summary_table()
    print("[PASS] All Fine-Tune Pipeline tests passed.")

    print("\n" + "-" * 80)
    print("[PASS] ALL PYTHON LAYER TESTS PASSED (27/27)")
    print("=" * 80)

if __name__ == "__main__":
    run_all()
