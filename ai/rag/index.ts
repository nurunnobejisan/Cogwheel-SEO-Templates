/**
 * RAG Pipeline — public entry (Phase 2)
 *
 * Wires the hashing embedder, the in-memory vector index and the curated seed
 * knowledge base into a ready-to-query pipeline. Swap the embedder/index for a
 * Pinecone or Qdrant adapter by keeping the same `KnowledgeBase` interface.
 */

import type { KnowledgeBase, RagChunk } from "../types.ts";
import { createHashingEmbedder } from "./embedder.ts";
import { createKnowledgeBase, chunkDocument, type KnowledgeBaseHandle } from "./knowledge-base.ts";
import { SEED_KNOWLEDGE } from "./seed-knowledge.ts";
import { GEO_KNOWLEDGE } from "./geo-knowledge.ts";

export * from "./embedder.ts";
export * from "./knowledge-base.ts";
export * from "./seed-knowledge.ts";
export * from "./geo-knowledge.ts";

export interface RagPipelineOptions {
  /** Additional domain-specific knowledge to ingest alongside the seed corpus. */
  extraChunks?: RagChunk[];
  /** Vector dimensions for the default hashing embedder. */
  dimensions?: number;
}

export interface RagPipeline {
  knowledgeBase: KnowledgeBaseHandle;
  ingest(chunks: RagChunk[]): void;
  /** Convenience: chunk + ingest a long document. */
  ingestDocument(input: Parameters<typeof chunkDocument>[0]): RagChunk[];
  size(): number;
}

/**
 * Build the default RAG pipeline with the curated SEO knowledge base loaded.
 */
export function createRagPipeline(options: RagPipelineOptions = {}): RagPipeline {
  const embedder = createHashingEmbedder(options.dimensions ?? 256);
  const knowledgeBase = createKnowledgeBase(embedder);
  const fingerprints = new Set<string>();

  const fingerprint = (text: string): string => text.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 240);

  const ingest = (chunks: RagChunk[]): void => {
    const fresh = chunks.filter((chunk) => {
      const key = fingerprint(chunk.text);
      if (!key || fingerprints.has(key)) return false;
      fingerprints.add(key);
      return true;
    });
    knowledgeBase.upsert(fresh);
  };

  const ingestDocument: RagPipeline["ingestDocument"] = (input) => {
    const chunks = chunkDocument(input);
    ingest(chunks);
    return chunks;
  };

  ingest(SEED_KNOWLEDGE);
  ingest(GEO_KNOWLEDGE);
  if (options.extraChunks?.length) {
    ingest(options.extraChunks);
  }

  return {
    knowledgeBase,
    ingest,
    ingestDocument,
    size: () => knowledgeBase.size(),
  };
}

/** Knowledge base backed by the default embedder, without the seed corpus. */
export function createEmptyKnowledgeBase(dimensions = 256): KnowledgeBase {
  return createKnowledgeBase(createHashingEmbedder(dimensions));
}
