/**
 * Deterministic hashing embedder (Phase 2)
 *
 * Dependency-free, offline embedding so the RAG pipeline works in CI, the
 * backend, and the extension without an external API key. The hashing-trick
 * bigram/trigram model captures lexical-semantic overlap well enough for
 * retrieving the small, curated SEO knowledge base.
 *
 * Swap in a provider embedder (Voyage/OpenAI/Gemini) by implementing Embedder.
 */

import type { Embedder } from "../types.ts";

const TOKEN_PATTERN = /[a-z0-9]+/g;
const UNIGRAM_WEIGHT = 1;
const BIGRAM_WEIGHT = 0.6;

/** FNV-1a 32-bit hash. */
function hashToken(token: string, seed: number): number {
  let hash = (seed ^ 0x811c9dc5) >>> 0;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(TOKEN_PATTERN) ?? [];
}

function accumulate(vector: number[], token: string, weight: number, dimensions: number): void {
  const index = hashToken(token, 0) % dimensions;
  const sign = (hashToken(token, 0x9e3779b1) & 1) === 0 ? 1 : -1;
  vector[index] = (vector[index] ?? 0) + sign * weight;
}

function l2Normalize(vector: number[]): number[] {
  let norm = 0;
  for (const value of vector) {
    norm += value * value;
  }
  if (norm === 0) {
    return vector;
  }
  const scale = 1 / Math.sqrt(norm);
  return vector.map((value) => value * scale);
}

export function createHashingEmbedder(dimensions = 256): Embedder {
  const embed = (text: string): number[] => {
    const vector = new Array<number>(dimensions).fill(0);
    const tokens = tokenize(text);
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i]!;
      accumulate(vector, token, UNIGRAM_WEIGHT, dimensions);
      if (i > 0) {
        accumulate(vector, `${tokens[i - 1]} ${token}`, BIGRAM_WEIGHT, dimensions);
      }
    }
    return l2Normalize(vector);
  };

  return {
    id: `hashing-${dimensions}`,
    dimensions,
    embed,
    embedBatch(texts: string[]) {
      return texts.map(embed);
    },
  };
}
