import { describe, expect, it } from "vitest";
import trainedProperties from "../src/data/trained-properties.json";
import { rosterToCsv, type RosterCsvRow } from "../src/lib/export";

type RosterRow = RosterCsvRow & Record<string, unknown>;

const rows = trainedProperties as RosterRow[];
const COLUMNS = [
  "name",
  "brand",
  "city",
  "state",
  "url",
  "propertyType",
  "category",
  "projectType",
  "status",
  "managementGroup",
  "platforms",
  "notes",
];

/** Minimal RFC4180 reader for asserting the exporter's exact output. */
function parseCsv(text: string): string[][] {
  const output: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      output.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field);
  output.push(row);
  return output;
}

describe("trained-property roster CSV export", () => {
  it("exports all 310 rows in original order without mutating the source", () => {
    const before = JSON.stringify(rows);
    const parsed = parseCsv(rosterToCsv(rows));

    expect(JSON.stringify(rows)).toBe(before);
    expect(parsed).toHaveLength(rows.length + 1);
    expect(parsed[0]).toEqual(COLUMNS);
    expect(parsed.slice(1).map((row) => row[0])).toEqual(rows.map((row) => row.name));
    expect(new Set(parsed.slice(1).map((row) => row[0])).size).toBe(rows.length);
  });

  it("preserves optional fields and platform arrays exactly", () => {
    const sample = rows.find((row) => Array.isArray(row.platforms) && row.platforms.length > 0);
    expect(sample).toBeDefined();

    const [header, values] = parseCsv(rosterToCsv([sample as RosterRow]));
    const record = Object.fromEntries(header.map((key, index) => [key, values[index]]));

    expect(record.platforms).toBe((sample as RosterRow).platforms?.join(" | "));
    expect(record.managementGroup).toBe((sample as RosterRow).managementGroup ?? "");
    expect(record.notes).toBe((sample as RosterRow).notes ?? "");
    expect(record.url).toBe((sample as RosterRow).url ?? "");
  });
});
