/**
 * SEO Studio — Chrome extension entry point for shared secret encryption.
 *
 * The implementation lives in `shared/ts/secureStorage.ts` — the single source
 * used by both the Next.js app and this extension. This wrapper only
 * re-exports so every existing extension import path keeps working; function
 * identity is asserted in `tests/secure-storage.test.ts`.
 */
export { encryptSecret, decryptSecret } from "../../../shared/ts/secureStorage";
