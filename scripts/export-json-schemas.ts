import fs from "fs";
import path from "path";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  KeywordStrategyMatrixSchema,
  AllBrandGuardrailsSchema,
  AuditPayloadSchema,
  PageAuditDataSchema,
  OtaConfigSchema,
} from "../src/schemas/validation.ts";
import { MlExampleSchema, MlGoldenCaseSchema } from "../schemas/ml-example.ts";
import {
  MetadataGenerationAnswerSchema,
  SchemaGenerationAnswerSchema,
} from "../schemas/ml-v1-outputs.ts";

const SCHEMAS_DIR = path.resolve(process.cwd(), "schemas");

if (!fs.existsSync(SCHEMAS_DIR)) {
  fs.mkdirSync(SCHEMAS_DIR, { recursive: true });
}

interface SchemaExportTarget {
  fileName: string;
  schema: Parameters<typeof zodToJsonSchema>[0];
  name: string;
  description: string;
  inlineRefs?: boolean;
}

const EXPORT_TARGETS: SchemaExportTarget[] = [
  {
    fileName: "keyword-matrix.schema.json",
    schema: KeywordStrategyMatrixSchema,
    name: "KeywordStrategyMatrix",
    description: "Standard JSON Schema for the SEO Studio 78-keyword hospitality strategy matrix.",
  },
  {
    fileName: "brand-guardrails.schema.json",
    schema: AllBrandGuardrailsSchema,
    name: "BrandGuardrails",
    description: "Standard JSON Schema for multi-brand hospitality SEO character caps and prohibited terminology.",
  },
  {
    fileName: "audit-payload.schema.json",
    schema: AuditPayloadSchema,
    name: "AuditPayload",
    description: "Standard JSON Schema for comprehensive page audit data, KPI radial scores, and detected issues.",
  },
  {
    fileName: "page-audit-data.schema.json",
    schema: PageAuditDataSchema,
    name: "PageAuditData",
    description: "Standard JSON Schema for live DOM extracted hospitality metadata and structural elements.",
  },
  {
    fileName: "ota-config.schema.json",
    schema: OtaConfigSchema,
    name: "OtaConfig",
    description: "Standard JSON Schema for Over-the-Air (OTA) live sync rules, pixel thresholds, and scoring weights.",
  },
  {
    fileName: "ml-example.schema.json",
    schema: MlExampleSchema,
    name: "MlExample",
    description: "Unified ML training/eval example record (task, input, measured provenance, licence, split) used by ml/build and ml/eval.",
  },
  {
    fileName: "ml-golden-case.schema.json",
    schema: MlGoldenCaseSchema,
    name: "MlGoldenCase",
    description: "Hand-checked golden evaluation case: an MlExample with the section-9 checks to apply and an operator note.",
  },
  {
    fileName: "ml-schema-generation.schema.json",
    schema: SchemaGenerationAnswerSchema,
    name: "MlSchemaGenerationOutput",
    description: "Constrained decoding schema for v1 schema_generation JSON-LD outputs.",
    inlineRefs: true,
  },
  {
    fileName: "ml-metadata-generation.schema.json",
    schema: MetadataGenerationAnswerSchema,
    name: "MlMetadataGenerationOutput",
    description: "Constrained decoding schema for v1 metadata_generation SERP metadata outputs.",
    inlineRefs: true,
  },
];

console.log("Generating standard JSON Schema files from Zod Single Source of Truth...");

EXPORT_TARGETS.forEach(({ fileName, schema, name, description, inlineRefs }) => {
  const jsonSchema = zodToJsonSchema(
    schema,
    inlineRefs
      ? { target: "jsonSchema7", $refStrategy: "none" }
      : { name, target: "jsonSchema7", definitions: {} },
  );

  const fullSchema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: name,
    description,
    ...jsonSchema,
  };

  const outputPath = path.join(SCHEMAS_DIR, fileName);
  fs.writeFileSync(outputPath, JSON.stringify(fullSchema, null, 2), "utf8");
  console.log(`Exported: schemas/${fileName}`);
});

console.log("All JSON Schema definitions successfully exported to schemas/");
