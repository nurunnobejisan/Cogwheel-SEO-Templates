/**
 * Phase F — `chrome-extension/src/utils/secureStorage.ts` is a thin wrapper
 * over the single shared implementation in `shared/ts/secureStorage.ts`.
 * Function identity is asserted so the extension copy can never diverge
 * again (same pattern as the Phase B shared-type parity tests).
 */
import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
} from "../shared/ts/secureStorage";
import {
  decryptSecret as extDecryptSecret,
  encryptSecret as extEncryptSecret,
} from "../chrome-extension/src/utils/secureStorage";

describe("secureStorage single source", () => {
  it("extension wrapper re-exports the identical shared functions", () => {
    expect(extEncryptSecret).toBe(encryptSecret);
    expect(extDecryptSecret).toBe(decryptSecret);
  });

  it("round-trips a secret with the enc:v1 prefix", async () => {
    const stored = await encryptSecret("my-api-key");
    expect(stored).not.toBe("my-api-key");
    expect(stored.startsWith("enc:v1:")).toBe(true);
    await expect(decryptSecret(stored)).resolves.toBe("my-api-key");
  });

  it("passes legacy plaintext values through unchanged", async () => {
    await expect(decryptSecret("legacy-plaintext-key")).resolves.toBe("legacy-plaintext-key");
  });
});
