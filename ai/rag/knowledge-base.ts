/**
 * RAG Vector Knowledge Base (Phase 2)
 *
 * In-memory vector index with cosine similarity, tag filtering and a
 * document chunker for ingestion. The public interface matches what a Pinecone
 * or Qdrant adapter would expose, so the store can be swapped at the edge.
 */

import type {
  Embedder,
  KnowledgeBase,
  KnowledgeBaseSearchOptions,
  RagChunk,
  ScoredChunk,
} from "../types.ts";

interface IndexedChunk {
  chunk: RagChunk;
  vector: number[];
}

function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface KnowledgeBaseHandle extends KnowledgeBase {
  remove(id: string): void;
  all(): RagChunk[];
}

export function createKnowledgeBase(embedder: Embedder): KnowledgeBaseHandle {
  const index = new Map<string, IndexedChunk>();

  return {
    upsert(chunks: RagChunk[]): void {
      for (const chunk of chunks) {
        index.set(chunk.id, { chunk, vector: embedder.embed(`${chunk.title}. ${chunk.text}`) });
      }
    },
    remove(id: string): void {
      index.delete(id);
    },
    search(query: string, options: KnowledgeBaseSearchOptions = {}): ScoredChunk[] {
      const { topK = 4, tags, minScore = 0 } = options;
      const queryVector = embedder.embed(query);
      const scored: ScoredChunk[] = [];

      for (const { chunk, vector } of index.values()) {
        if (tags && tags.length > 0 && !chunk.tags.some((tag) => tags.includes(tag))) {
          continue;
        }
        const score = Number(cosineSimilarity(queryVector, vector).toFixed(6));
        if (score < minScore) {
          continue;
        }
        scored.push({ ...chunk, score });
      }

      return scored.sort((a, b) => b.score - a.score).slice(0, topK);
    },
    size(): number {
      return index.size;
    },
    all(): RagChunk[] {
      return [...index.values()].map((entry) => entry.chunk);
    },
  };
}

export interface ChunkDocumentInput {
  id: string;
  title: string;
  text: string;
  source: string;
  url?: string;
  tags?: string[];
  /** Soft target size per chunk. */
  maxChars?: number;
}

/**
 * Split a long document into overlapping, paragraph-aware chunks for ingestion.
 */
export function chunkDocument(input: ChunkDocumentInput): RagChunk[] {
  const { id, title, text, source, url, tags = [], maxChars = 700 } = input;
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  const chunks: RagChunk[] = [];
  let buffer = "";
  let part = 1;

  const flush = (): void => {
    if (!buffer.trim()) {
      return;
    }
    chunks.push({
      id: `${id}#${part}`,
      title,
      text: buffer.trim(),
      source,
      url,
      tags,
    });
    part += 1;
    buffer = "";
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars && buffer.length === 0) {
      for (let i = 0; i < paragraph.length; i += maxChars) {
        buffer = paragraph.slice(i, i + maxChars);
        flush();
      }
      continue;
    }
    if ((buffer + "\n\n" + paragraph).length > maxChars) {
      flush();
    }
    buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
  }
  flush();

  if (chunks.length === 0) {
    chunks.push({ id: `${id}#1`, title, text, source, url, tags });
  }
  return chunks;
}
