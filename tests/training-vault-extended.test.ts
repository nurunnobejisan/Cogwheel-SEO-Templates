import { describe, it, expect, beforeEach } from "vitest";
import {
  saveTrainingPair,
  updateTrainingPairStatus,
  updateTrainingPairTarget,
  deleteTrainingPair,
  getTrainingVaultStats,
  getTrainingPairById,
  clearTrainingVault,
  RawWebInput,
  TargetOptimizedOutput,
} from "../src/storage/training-vault";

describe("Training Vault - Extended Management & Status Capabilities", () => {
  beforeEach(async () => {
    await clearTrainingVault();
  });

  const mockRaw: RawWebInput = {
    url: "https://www.marriott.com/hotels/travel/mia-marriott/",
    canonicalUrl: "https://www.marriott.com/hotels/travel/mia-marriott/",
    domain: "www.marriott.com",
    rawTitle: "Miami Marriott Airport Hotel & Convention Center",
    rawMetaDesc: "Stay near MIA airport with free shuttle, pool, and dining.",
    rawH1: ["Miami Marriott Airport"],
    rawH2: ["Airport Shuttle", "Accommodations"],
    rawBodyText: "Comfortable Miami airport hotel with free shuttle service, modern rooms, on-site restaurant, and event spaces.",
    detectedSchemas: ["Hotel"],
    wordCount: 350,
  };

  const mockTarget: TargetOptimizedOutput = {
    optimizedTitle: "Miami Airport Hotel & Convention Center | Marriott",
    optimizedMetaDesc: "Book direct at Miami Marriott Airport for free airport shuttle, outdoor pool, on-site dining, and lowest rate guarantee near MIA airport.",
    optimizedH1: "Miami Marriott Airport Hotel",
    jsonLdSchema: {
      "@context": "https://schema.org",
      "@type": "Hotel",
      name: "Miami Marriott Airport",
    },
    geoEntityBlock: "Miami Marriott Airport Hotel is located near Miami International Airport featuring 300 guest rooms, free 24-hour airport shuttle, on-site dining, and meeting facilities.",
    brandGuardrail: "Marriott",
  };

  it("initializes record with pending status by default", async () => {
    const record = await saveTrainingPair({
      rawInput: mockRaw,
      targetOutput: mockTarget,
      brand: "Marriott",
    });

    expect(record.status).toBe("pending");
  });

  it("updates approval status (approve / reject / pending)", async () => {
    const record = await saveTrainingPair({
      rawInput: mockRaw,
      targetOutput: mockTarget,
      brand: "Marriott",
    });

    const approved = await updateTrainingPairStatus(record.id, "approved");
    expect(approved.status).toBe("approved");

    const rejected = await updateTrainingPairStatus(record.id, "rejected");
    expect(rejected.status).toBe("rejected");
  });

  it("updates target output and recalculates quality score dynamically", async () => {
    const initial = await saveTrainingPair({
      rawInput: mockRaw,
      targetOutput: mockTarget,
      brand: "Marriott",
    });

    const initialScore = initial.qualityScore;

    const modifiedTarget: TargetOptimizedOutput = {
      ...mockTarget,
      optimizedTitle: "Short", // will reduce optimizationDelta
      optimizedMetaDesc: "Too short",
    };

    const updated = await updateTrainingPairTarget(initial.id, modifiedTarget);

    expect(updated.id).toBe(initial.id);
    expect(updated.targetOutput.optimizedTitle).toBe("Short");
    expect(updated.qualityScore).toBeLessThan(initialScore);
  });

  it("deletes a record by ID", async () => {
    const record = await saveTrainingPair({
      rawInput: mockRaw,
      targetOutput: mockTarget,
      brand: "Marriott",
    });

    const deleted = await deleteTrainingPair(record.id);
    expect(deleted).toBe(true);

    const check = await getTrainingPairById(record.id);
    expect(check).toBeNull();
  });

  it("computes vault aggregate statistics correctly", async () => {
    const r1 = await saveTrainingPair({
      rawInput: mockRaw,
      targetOutput: mockTarget,
      brand: "Marriott",
      status: "approved",
    });

    const r2Raw: RawWebInput = {
      ...mockRaw,
      canonicalUrl: "https://www.hilton.com/hotel/denver/",
      url: "https://www.hilton.com/hotel/denver/",
      domain: "www.hilton.com",
    };
    await saveTrainingPair({
      rawInput: r2Raw,
      targetOutput: mockTarget,
      brand: "Hilton",
      status: "pending",
    });

    const r3Raw: RawWebInput = {
      ...mockRaw,
      canonicalUrl: "https://www.ihg.com/hotel/chicago/",
      url: "https://www.ihg.com/hotel/chicago/",
      domain: "www.ihg.com",
    };
    await saveTrainingPair({
      rawInput: r3Raw,
      targetOutput: mockTarget,
      brand: "IHG",
      status: "rejected",
    });

    const stats = await getTrainingVaultStats();

    expect(stats.total).toBe(3);
    expect(stats.approved).toBe(1);
    expect(stats.pending).toBe(1);
    expect(stats.rejected).toBe(1);
    expect(stats.avgQualityScore).toBeGreaterThan(0);
  });
});
