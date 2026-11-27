"""MinHash near-duplicate detection.

Signatures are deterministic across processes: Python randomises ``hash()``
per process, so using it would make dedup silently stop working between runs.
``blake2b`` with a per-permutation personalisation avoids that.

Standard library only.
"""

from __future__ import annotations

import hashlib
from typing import Iterable, List, Tuple

__all__ = ["minhash_signature", "jaccard", "is_duplicate"]




def _shingles(text: str, n: int = 3) -> set:
    """Character n-grams. Character-level so tokenisation differences between
    languages do not change the signature."""
    compact = " ".join(text.lower().split())
    if len(compact) < n:
        return {compact} if compact else set()
    return {compact[i : i + n] for i in range(len(compact) - n + 1)}


def minhash_signature(
    text: str, *, num_perm: int = 128, seed: int = 1795487332
) -> List[int]:
    """Deterministic MinHash signature.

    Uses ``blake2b`` with a per-permutation personalisation instead of
    ``hashlib.sha1`` + Python's per-process ``hash()``: Python randomises
    string hashing per process, which would make signatures differ between
    runs and silently break dedup.
    """
    if num_perm <= 0:
        raise ValueError("num_perm must be positive")

    shingle_set = _shingles(text)
    if not shingle_set:
        return [0] * num_perm

    signature: List[int] = []
    for i in range(num_perm):
        best = None
        for shingle in shingle_set:
            digest = hashlib.blake2b(
                shingle.encode("utf-8"),
                digest_size=8,
                person=f"minhash-{seed}-{i}".encode("utf-8")[:16],
            ).digest()
            value = int.from_bytes(digest, "big")
            if best is None or value < best:
                best = value
        signature.append(best if best is not None else 0)
    return signature


def jaccard(a: Iterable[int], b: Iterable[int]) -> float:
    """Estimated Jaccard similarity from two MinHash signatures."""
    a_list, b_list = list(a), list(b)
    if not a_list or len(a_list) != len(b_list):
        return 0.0
    matches = sum(1 for x, y in zip(a_list, b_list) if x == y)
    return matches / len(a_list)


def is_duplicate(
    text: str,
    known_signatures: List[List[int]],
    *,
    threshold: float = 0.9,
    num_perm: int = 128,
) -> Tuple[bool, float]:
    """Compare ``text`` against known signatures.

    Returns ``(is_duplicate, best_similarity)``. ``threshold`` defaults to
    0.9: near-identical pages are duplicates, legitimately different pages are
    not. The similarity is reported rather than only the boolean so a caller
    can log borderline cases instead of silently dropping them.
    """
    signature = minhash_signature(text, num_perm=num_perm)
    best = 0.0
    for known in known_signatures:
        score = jaccard(signature, known)
        if score > best:
            best = score
    return best >= threshold, best
