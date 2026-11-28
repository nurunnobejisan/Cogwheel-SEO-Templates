"""SEO Studio Templates — Content Engine & Similarity Scorer

Provides:
- Batch thin-content detection & TF-IDF / Jaccard similarity checking (>70% duplicate blocker)
- Semantic internal-link graph generator outputting clean JSON manifest for TypeScript compiler
"""

from __future__ import annotations

import math
import re
from collections import Counter
from typing import Any


def clean_text(text: str) -> str:
    """Strips HTML tags, non-alphanumeric characters, and returns normalized lowercase text."""
    if not text:
        return ""
    text_no_html = re.sub(r"<[^>]*>", " ", text)
    cleaned = re.sub(r"[^a-zA-Z0-9\s]", " ", text_no_html.lower())
    return re.sub(r"\s+", " ", cleaned).strip()


def count_words(text: str) -> int:
    """Returns non-empty word count."""
    return len(clean_text(text).split())


def get_ngrams(words: list[str], n: int = 3) -> set[str]:
    """Generates an n-gram set from word tokens."""
    if len(words) < n:
        return {" ".join(words)} if words else set()
    return {" ".join(words[i:i + n]) for i in range(len(words) - n + 1)}


def calculate_jaccard_similarity(text1: str, text2: str, n: int = 3) -> float:
    """Calculates Jaccard similarity coefficient: |A ∩ B| / |A ∪ B|."""
    words1 = clean_text(text1).split()
    words2 = clean_text(text2).split()
    set1 = get_ngrams(words1, n)
    set2 = get_ngrams(words2, n)

    if not set1 and not set2:
        return 1.0
    if not set1 or not set2:
        return 0.0

    intersection = len(set1.intersection(set2))
    union = len(set1.union(set2))
    return float(intersection) / float(union) if union > 0 else 0.0


def calculate_tfidf_similarity(documents: list[str]) -> list[list[float]]:
    """Calculates pairwise cosine similarity matrix using TF-IDF term weights."""
    tokenized_docs = [clean_text(doc).split() for doc in documents]
    num_docs = len(tokenized_docs)

    # Document Frequency (DF)
    df: dict[str, int] = Counter()
    for doc in tokenized_docs:
        unique_terms = set(doc)
        for term in unique_terms:
            df[term] += 1

    # TF-IDF vectors
    tfidf_vectors: list[dict[str, float]] = []
    for doc in tokenized_docs:
        tf = Counter(doc)
        doc_len = len(doc)
        vector: dict[str, float] = {}
        for term, count in tf.items():
            term_tf = count / doc_len if doc_len > 0 else 0
            term_idf = math.log((num_docs + 1) / (df[term] + 1)) + 1
            vector[term] = term_tf * term_idf
        tfidf_vectors.append(vector)

    # Cosine similarity matrix
    similarity_matrix = [[0.0] * num_docs for _ in range(num_docs)]
    for i in range(num_docs):
        similarity_matrix[i][i] = 1.0
        for j in range(i + 1, num_docs):
            vec1 = tfidf_vectors[i]
            vec2 = tfidf_vectors[j]
            dot_product = sum(vec1[k] * vec2.get(k, 0.0) for k in vec1)
            norm1 = math.sqrt(sum(v ** 2 for v in vec1.values()))
            norm2 = math.sqrt(sum(v ** 2 for v in vec2.values()))
            sim = dot_product / (norm1 * norm2) if (norm1 * norm2) > 0 else 0.0
            similarity_matrix[i][j] = float(sim)
            similarity_matrix[j][i] = float(sim)

    return similarity_matrix


def batch_similarity_audit(
    pages: list[dict[str, Any]],
    max_similarity: float = 0.70,
    min_words: int = 250
) -> dict[str, Any]:
    """Audits a batch of pages against thin-content and duplicate similarity ceilings.

    Pages exceeding max_similarity (default 0.70 / 70%) are flagged as duplicate blocks.
    """
    results = []
    all_passed = True
    num_pages = len(pages)
    contents = [p.get("content", "") for p in pages]

    # Calculate Jaccard and TF-IDF
    tfidf_matrix = calculate_tfidf_similarity(contents) if num_pages > 1 else [[1.0]]

    for i in range(num_pages):
        page = pages[i]
        word_count = count_words(page.get("content", ""))
        is_thin = word_count < min_words

        max_sim = 0.0
        most_similar_id = None

        for j in range(num_pages):
            if i != j:
                jaccard = calculate_jaccard_similarity(contents[i], contents[j])
                tfidf = tfidf_matrix[i][j]
                # Combined metric: max of Jaccard and TF-IDF
                metric = max(jaccard, tfidf)
                if metric > max_sim:
                    max_sim = metric
                    most_similar_id = pages[j].get("id")

        is_duplicate = max_sim > max_similarity
        passed = not is_thin and not is_duplicate
        if not passed:
            all_passed = False

        results.append({
            "id": page.get("id"),
            "url": page.get("url"),
            "word_count": word_count,
            "is_thin_content": is_thin,
            "highest_similarity": round(max_sim, 4),
            "most_similar_page_id": most_similar_id,
            "is_duplicate_blocked": is_duplicate,
            "passed": passed
        })

    return {
        "all_passed": all_passed,
        "results": results
    }


def generate_internal_link_graph(
    manifest_items: list[dict[str, Any]],
    max_links_per_page: int = 5
) -> dict[str, Any]:
    """Scores topical relationships between pages and outputs a clean JSON graph
    for consumption by the TypeScript template compiler.
    """
    link_graph: dict[str, list[dict[str, str]]] = {}

    for source in manifest_items:
        source_url = source.get("url")
        if not source_url:
            continue

        targets = []
        for target in manifest_items:
            target_url = target.get("url")
            if not target_url or target_url == source_url:
                continue

            score = 0
            rel = "topical"

            # Hub / Parent relationship
            if source.get("parentPage") == target_url:
                score += 50
                rel = "parent"
            elif target.get("parentPage") == source_url:
                score += 50
                rel = "child"
            elif source.get("parentPage") and source.get("parentPage") == target.get("parentPage"):
                score += 30
                rel = "sibling"

            # Tag & Category overlap
            s_tags = set(source.get("secondaryTags", []))
            t_tags = set(target.get("secondaryTags", []))
            score += len(s_tags.intersection(t_tags)) * 10

            s_cats = set(source.get("categoryHierarchy", []))
            t_cats = set(target.get("categoryHierarchy", []))
            score += len(s_cats.intersection(t_cats)) * 15

            if score > 0:
                anchors = [target.get("primaryKeyword")] + target.get("approvedAnchorVariations", [])
                targets.append({
                    "targetUrl": target_url,
                    "anchorText": anchors[0] if anchors else target.get("primaryKeyword", ""),
                    "relationship": rel,
                    "score": score
                })

        # Sort by score descending and take top limits
        targets.sort(key=lambda x: x["score"], reverse=True)
        link_graph[source_url] = [
            {"targetUrl": t["targetUrl"], "anchorText": t["anchorText"], "relationship": t["relationship"]}
            for t in targets[:max_links_per_page]
        ]

    return {
        "totalPages": len(manifest_items),
        "graph": link_graph
    }
