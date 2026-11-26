import { describe, expect, it } from "vitest";
import { createRagPipeline, GEO_KNOWLEDGE } from "../ai/rag";
import type { RagChunk } from "../ai/types";

interface RecallCase {
  question: string;
  expected: string[];
}

/**
 * 40 hand-written questions over the curated seed + GEO corpus.
 * Recall@6 counts a hit when any expected chunk id is retrieved.
 * This is a retrieval test, not a model-quality test.
 */
const CASES: RecallCase[] = [
  { question: "What did the GEO paper find improves generative engine visibility?", expected: ["geo-paper-visibility"] },
  { question: "Which optimization methods did the KDD 2024 GEO paper test?", expected: ["geo-paper-methods"] },
  { question: "How many queries are in GEO-bench and where do they come from?", expected: ["geo-bench-queries"] },
  { question: "What structure should an llms.txt file have?", expected: ["geo-playbook-llms-txt"] },
  { question: "Which AI crawlers should robots.txt allow?", expected: ["geo-playbook-ai-crawlers"] },
  { question: "How is the citability score calculated from its components?", expected: ["geo-playbook-citability"] },
  { question: "What citability drop fails the drift CI threshold?", expected: ["geo-playbook-drift"] },
  { question: "How do you measure brand mentions and citations in AI answers?", expected: ["geo-playbook-visibility-tracking"] },
  { question: "Which environment variables enable the ChatGPT and Claude adapters?", expected: ["geo-playbook-provider-keys"] },
  { question: "What is a good answer block length under a question heading?", expected: ["geo-playbook-answer-blocks"] },
  { question: "How do entity signals help AI engines recognize a brand?", expected: ["geo-playbook-entity-signals"] },
  { question: "What do measured, estimated and unavailable mean?", expected: ["geo-playbook-measurement-policy"] },
  { question: "When can reviewed training triples be exported for LoRA?", expected: ["geo-playbook-training-data"] },
  { question: "What can we reuse from the Elmo AI visibility project?", expected: ["geo-tool-review-elmo"] },
  { question: "Which GeoReady checks did we adapt and what did we skip?", expected: ["geo-tool-review-geoready"] },
  { question: "How does Limelit classify citations without an LLM judge?", expected: ["geo-tool-review-limelit"] },
  { question: "What is the right title tag length?", expected: ["kc-title-tag"] },
  { question: "What should a meta description contain?", expected: ["kc-meta-description"] },
  { question: "How should heading structure be organized?", expected: ["kc-heading-structure"] },
  { question: "When should a canonical tag be self-referencing?", expected: ["kc-canonical"] },
  { question: "What makes a page indexable or noindex?", expected: ["kc-indexability"] },
  { question: "Which Core Web Vitals thresholds matter?", expected: ["kc-core-web-vitals"] },
  { question: "How should image alt text be written?", expected: ["kc-image-alt"] },
  { question: "What internal link structure helps crawlers?", expected: ["kc-links"] },
  { question: "What does LodgingBusiness schema need?", expected: ["kc-lodgingbusiness-schema"] },
  { question: "How do you mark up a product with schema?", expected: ["kc-product-schema"] },
  { question: "What belongs in Organization schema?", expected: ["kc-organization-schema"] },
  { question: "When should FAQPage schema be used?", expected: ["kc-faq-schema"] },
  { question: "What are E-E-A-T signals?", expected: ["kc-eeat"] },
  { question: "How does AI search change SEO?", expected: ["kc-geo-ai-search"] },
  { question: "What social meta tags should a page have?", expected: ["kc-social-meta"] },
  { question: "What are the four GEO method families from the paper?", expected: ["geo-paper-methods"] },
  { question: "What checks make an llms.txt invalid?", expected: ["geo-playbook-llms-txt"] },
  {
    question: "How is a prompt classified as a gap versus unmeasured?",
    expected: ["geo-playbook-visibility-tracking", "geo-tool-review-limelit"],
  },
  { question: "What is the citability formula weight for citations?", expected: ["geo-playbook-citability"] },
  { question: "Does Google offer an AI Overviews API?", expected: ["geo-playbook-provider-keys"] },
  { question: "What is the default daily visibility cost cap?", expected: ["geo-playbook-provider-keys"] },
  { question: "Which license does limelit-co/open use?", expected: ["geo-tool-review-limelit"] },
  { question: "Which repo was rejected because of GPL?", expected: ["geo-tool-review-geoready"] },
  { question: "How do we snapshot GEO metrics for CI?", expected: ["geo-playbook-drift"] },
];

describe("RAG recall@6", () => {
  it("retrieves an expected source for at least 85% of 40 questions", () => {
    const pipeline = createRagPipeline();
    let hits = 0;
    const misses: string[] = [];

    for (const testCase of CASES) {
      const results = pipeline.knowledgeBase.search(testCase.question, { topK: 6 });
      const ids = results.map((chunk) => chunk.id);
      const hit = testCase.expected.some((id) => ids.includes(id));
      if (hit) hits += 1;
      else misses.push(`${testCase.question} → got ${ids.join(", ")}`);
    }

    const recall = hits / CASES.length;
    console.log(`RAG recall@6: ${hits}/${CASES.length} = ${(recall * 100).toFixed(1)}%`);
    if (misses.length > 0) console.log(`Misses:\n${misses.join("\n")}`);

    expect(CASES.length).toBeGreaterThanOrEqual(30);
    expect(recall).toBeGreaterThanOrEqual(0.85);
  });

  it("deduplicates identical corpus text", () => {
    const base = createRagPipeline();
    const duplicate: RagChunk = { ...GEO_KNOWLEDGE[0]!, id: "geo-duplicate-copy" };
    const withDuplicate = createRagPipeline({ extraChunks: [duplicate] });
    expect(withDuplicate.size()).toBe(base.size());
  });
});
