import assert from "node:assert/strict";
import test from "node:test";

import configProperties from "../../src/config/properties.json";
import trainedProperties from "../../src/data/trained-properties.json";

type Row = Record<string, unknown>;

const CONFIG_COUNT = 161;
const TRAINED_COUNT = 310;

function asRows(value: unknown): Row[] {
  assert.ok(Array.isArray(value), "dataset must be an array");
  return value as Row[];
}

function checkIdentity(row: Row, key: string, pattern: RegExp, optional = false): void {
  if (!(key in row)) return;
  const value = row[key];
  assert.equal(typeof value, "string", `${key} must be a string`);
  if (optional && value === "") return;
  assert.match(value as string, pattern, `${key} must be synthetic`);
}

const NAME = /^Demo (Config|Trained) Property \d{3}$/;
const URL = /^https:\/\/demo-(config|trained)-\d{3}\.example\.com\/$/;
const GROUP = /^Demo Management Group \d{2}$/;
const CITY = /^Demo City \d{2}$/;
const STATE = /^[ZY][A-Z]$/;
const ASSIGNEE = /^Demo Assignee \d{2}$/;
const SLIDES = /^https:\/\/synthetic\.example\.com\/config\/(slides|backlinks)-\d{3}$/;
const NOTE = /^Synthetic demo note for trained property \d{3}\.$/;

test("config dataset keeps its shape with synthetic identities", () => {
  const rows = asRows(configProperties);
  assert.equal(rows.length, CONFIG_COUNT);

  for (const row of rows) {
    checkIdentity(row, "name", NAME);
    checkIdentity(row, "url", URL);
    checkIdentity(row, "managementGroup", GROUP);
    checkIdentity(row, "city", CITY);
    checkIdentity(row, "state", STATE);
    checkIdentity(row, "seoAssignee", ASSIGNEE);
    checkIdentity(row, "slidesUrl", SLIDES);
    checkIdentity(row, "backlinkSlidesUrl", SLIDES);
  }

  assert.equal(new Set(rows.map((row) => row.name)).size, CONFIG_COUNT);
});

test("trained dataset keeps its shape with synthetic identities", () => {
  const rows = asRows(trainedProperties);
  assert.equal(rows.length, TRAINED_COUNT);

  for (const row of rows) {
    checkIdentity(row, "name", NAME);
    checkIdentity(row, "url", URL, true);
    checkIdentity(row, "managementGroup", GROUP);
    checkIdentity(row, "city", CITY, true);
    checkIdentity(row, "state", STATE, true);
    checkIdentity(row, "notes", NOTE);
  }

  assert.equal(new Set(rows.map((row) => row.name)).size, TRAINED_COUNT);
});
