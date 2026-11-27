/**
 * SEO Studio — Chrome extension entry point for the shared training vault.
 *
 * The vault itself lives in `shared/ts/training-vault.ts` (the single source
 * used by both the Next.js app and this extension). This wrapper only adds the
 * extension's capture-permission gate — consent plus the allow/block lists in
 * `utils/extensionOptions` — so no pair is persisted unless the user has
 * permitted the URL. Everything else is re-exported unchanged from shared.
 *
 * Importing this module registers the gate; extension code must import the
 * vault through this path, never directly from `shared/ts/`.
 */
import { setTrainingPersistGate } from "../../../shared/ts/training-vault";
import { loadExtensionOptions, shouldCaptureUrl } from "../utils/extensionOptions";

setTrainingPersistGate(async (canonicalUrl) => {
  const options = await loadExtensionOptions();
  const permission = shouldCaptureUrl(canonicalUrl, options);
  if (!permission.canCapture) {
    throw new Error(permission.reason || "Training capture is not permitted.");
  }
});

export * from "../../../shared/ts/training-vault";
