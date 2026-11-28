import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  MetadataGenerationAnswerSchema,
  SchemaGenerationAnswerSchema,
} from "../schemas/ml-v1-outputs";

describe("WP7 — exported ML constrained decoding schemas match Zod contracts", () => {
  it("keeps schemas/ml-schema-generation.schema.json in sync with Zod", () => {
    const filePath = path.resolve(__dirname, "../schemas/ml-schema-generation.schema.json");
    const onDisk = JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
    const expected = {
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "MlSchemaGenerationOutput",
      description: "Constrained decoding schema for v1 schema_generation JSON-LD outputs.",
      ...zodToJsonSchema(SchemaGenerationAnswerSchema, {
        target: "jsonSchema7",
        $refStrategy: "none",
      }),
    };
    expect(onDisk).toEqual(expected);
  });

  it("keeps schemas/ml-metadata-generation.schema.json in sync with Zod", () => {
    const filePath = path.resolve(__dirname, "../schemas/ml-metadata-generation.schema.json");
    const onDisk = JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
    const expected = {
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "MlMetadataGenerationOutput",
      description: "Constrained decoding schema for v1 metadata_generation SERP metadata outputs.",
      ...zodToJsonSchema(MetadataGenerationAnswerSchema, {
        target: "jsonSchema7",
        $refStrategy: "none",
      }),
    };
    expect(onDisk).toEqual(expected);
  });
});
