#!/usr/bin/env python3
"""Master test runner for Python layer (pytest compatible)."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import test_pydantic_models
import test_content_engine

def run_all():
    print("=" * 80)
    print(" COGWHEEL SEO STUDIO — PYTHON TEST RUNNER")
    print("=" * 80)

    print("\n▶ Running test_pydantic_models...")
    test_pydantic_models.test_destination_guide_model_defaults()
    test_pydantic_models.test_room_showcase_model()
    test_pydantic_models.test_hotel_faq_model()
    test_pydantic_models.test_page_metadata_model()
    print("✔ All Pydantic model tests passed.")

    print("\n▶ Running test_content_engine...")
    test_content_engine.test_clean_text_and_count()
    test_content_engine.test_jaccard_similarity_calculation()
    test_content_engine.test_batch_similarity_audit_blocks_duplicates()
    test_content_engine.test_internal_link_graph_generation()
    print("✔ All Content Engine & Similarity tests passed.")

    print("\n" + "-" * 80)
    print("✔ ALL PYTHON LAYER TESTS PASSED (8/8)")
    print("=" * 80)

if __name__ == "__main__":
    run_all()
