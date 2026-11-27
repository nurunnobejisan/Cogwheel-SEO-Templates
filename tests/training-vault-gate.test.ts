/**
 * Phase B — the extension's capture-permission gate, now layered on the
 * shared vault.
 *
 * `shared/ts/training-vault.ts` calls an optional `TrainingPersistGate`
 * before anything is persisted; only
 * `chrome-extension/src/storage/training-vault.ts` (the wrapper) registers
 * one, wiring it to consent plus the allow/block lists from
 * `utils/extensionOptions`. The app leaves the gate unset.
 *
 * These tests import the wrapper so the gate is active, and prove that:
 *
 *   1. without consent (a fresh install's default) every write is rejected
 *      before anything reaches the vault;
 *   2. blocklisted domains stay blocked even with consent;
 *   3. once the gate allows the URL the shared save path persists normally.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../chrome-extension/src/utils/extensionOptions", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../chrome-extension/src/utils/extensionOptions")>();
  return { ...actual, loadExtensionOptions: vi.fn() };
});

import { DEFAULT_OPTIONS, loadExtensionOptions } from "../chrome-extension/src/utils/extensionOptions";
import {
  getTrainingPairByUrl,
  saveTrainingPair,
  type RawWebInput,
  type TargetOptimizedOutput,
} from "../chrome-extension/src/storage/training-vault";

const rawInput: RawWebInput = {
  url: "https://example.com/rooms",
  canonicalUrl: "https://example.com/rooms",
  domain: "example.com",
  rawTitle: "Example Rooms",
  rawMetaDesc: "A plain page used by the Phase B gate tests.",
  rawH1: ["Example Rooms"],
  rawH2: ["Details"],
  rawBodyText: "A plain page used by the Phase B gate tests.",
  detectedSchemas: [],
  wordCount: 12,
};

const targetOutput: TargetOptimizedOutput = {
  optimizedTitle: "Example Rooms",
  optimizedMetaDesc: "A plain page used by the Phase B gate tests.",
  optimizedH1: "Example Rooms",
  jsonLdSchema: { "@context": "https://schema.org", "@type": "WebPage" },
  geoEntityBlock: "",
  brandGuardrail: "Example",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Phase B — extension persistence gate", () => {
  it("rejects the write when training consent is not granted", async () => {
    vi.mocked(loadExtensionOptions).mockResolvedValue(DEFAULT_OPTIONS); // consent: false

    await expect(saveTrainingPair({ rawInput, targetOutput })).rejects.toThrow(/consent/i);
    // nothing reached the vault
    expect(await getTrainingPairByUrl(rawInput.canonicalUrl)).toBeNull();
  });

  it("rejects a blocklisted domain even when consent is granted", async () => {
    vi.mocked(loadExtensionOptions).mockResolvedValue({ ...DEFAULT_OPTIONS, consent: true });

    const blocked: RawWebInput = {
      ...rawInput,
      url: "https://mail.google.com/inbox",
      canonicalUrl: "https://mail.google.com/inbox",
      domain: "mail.google.com",
    };

    await expect(saveTrainingPair({ rawInput: blocked, targetOutput })).rejects.toThrow(
      /blocklist/i,
    );
    expect(await getTrainingPairByUrl(blocked.canonicalUrl)).toBeNull();
  });

  it("persists through the shared save path once the gate allows the URL", async () => {
    vi.mocked(loadExtensionOptions).mockResolvedValue({ ...DEFAULT_OPTIONS, consent: true });

    const record = await saveTrainingPair({ rawInput, targetOutput });
    expect(record.canonicalUrl).toBe(rawInput.canonicalUrl);

    const stored = await getTrainingPairByUrl(rawInput.canonicalUrl);
    expect(stored?.id).toBe(record.id);
    expect(stored?.pageType).toBe(record.pageType);
  });
});
