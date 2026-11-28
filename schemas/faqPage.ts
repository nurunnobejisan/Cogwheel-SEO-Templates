/**
 * SEO Studio Templates — FAQPage Schema Builder
 */

export interface FAQItem {
  question: string;
  answer: string;
}

export interface FAQPageInput {
  url?: string;
  items: FAQItem[];
  id?: string;
}

export function buildFAQPageSchema(input: FAQPageInput): Record<string, any> {
  if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("FAQPage schema requires at least one question & answer item.");
  }

  const validItems = input.items.filter((i) => i.question && i.answer);
  if (validItems.length === 0) {
    throw new Error("FAQPage schema items must have both question and answer.");
  }

  const schemaId = input.id || (input.url ? `${input.url}#faq` : undefined);

  return {
    "@type": "FAQPage",
    ...(schemaId ? { "@id": schemaId } : {}),
    "mainEntity": validItems.map((item) => ({
      "@type": "Question",
      "name": item.question.trim(),
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.answer.trim()
      }
    }))
  };
}
