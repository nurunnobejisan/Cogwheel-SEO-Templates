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

const SCHEMAS_DIR = path.resolve(process.cwd(), "schemas");

if (!fs.existsSync(SCHEMAS_DIR)) {
  fs.mkdirSync(SCHEMAS_DIR, { recursive: true });
}

interface SchemaExportTarget {
  fileName: string;
  schema: Parameters<typeof zodToJsonSchema>[0];
  name: string;
  description: string;
}

const EXPORT_TARGETS: SchemaExportTarget[] = [
  {
    fileName: "keyword-matrix.schema.json",
    schema: KeywordStrategyMatrixSchema,
    name: "KeywordStrategyMatrix",
    description: "Standard JSON Schema for the Cogwheel 78-keyword hospitality strategy matrix.",
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
];

console.log("Generating standard JSON Schema files from Zod Single Source of Truth...");

EXPORT_TARGETS.forEach(({ fileName, schema, name, description }) => {
  const jsonSchema = zodToJsonSchema(schema, {
    name,
    target: "jsonSchema7",
    definitions: {},
  });

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
