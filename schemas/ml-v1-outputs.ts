/**
 * Canonical Zod contracts for v1 fine-tuned adapter JSON responses
 * (`schema_generation` and `metadata_generation`).
 *
 * Exported to `schemas/ml-schema-generation.schema.json` and
 * `schemas/ml-metadata-generation.schema.json` via `npm run export:json-schemas`,
 * then loaded directly by `ml/generate` for grammar-constrained decoding.
 */

import { z } from "zod";
import knownSchemaTypesJson from "./known-schema-types.json";
import { schemaMarkupItemSchema } from "../src/tasks/schema-markup/schema";

const KNOWN_TYPES = knownSchemaTypesJson as [string, ...string[]];

export const KnownSchemaTypeEnum = z.enum(KNOWN_TYPES);

export const JsonLdTypedNodeSchema = z
  .object({
    "@type": z.union([KnownSchemaTypeEnum, z.array(KnownSchemaTypeEnum).min(1)]),
  })
  .passthrough();

export const SchemaGenerationAnswerSchema = z.union([
  z
    .object({
      "@context": z.string().min(1),
      "@type": z.union([KnownSchemaTypeEnum, z.array(KnownSchemaTypeEnum).min(1)]),
    })
    .passthrough(),
  z
    .object({
      "@context": z.string().min(1),
      "@graph": z.array(JsonLdTypedNodeSchema).min(1),
    })
    .passthrough(),
  z.array(schemaMarkupItemSchema).min(1),
]);

export const MetadataGenerationAnswerSchema = z
  .object({
    title: z.string().min(1).max(60),
    metaDescription: z.string().min(1).max(160),
    h1: z.string().min(1).optional(),
    h2: z.array(z.string().min(1)).optional(),
  })
  .passthrough();

export type SchemaGenerationAnswer = z.infer<typeof SchemaGenerationAnswerSchema>;
export type MetadataGenerationAnswer = z.infer<typeof MetadataGenerationAnswerSchema>;
