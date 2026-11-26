/// <reference types="chrome" />
import {
  ExtensionUpdateState,
  OtaConfigPayload,
  RemoteManifest,
} from "../types/updater.types";

export * from "../types/updater.types";

const REPO_OWNER = "nurunnobejisan";
const REPO_NAME = "SEO-Studio";
const RAW_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main`;
const RELEASE_ZIP_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest/download/cogwheel-seo-studio.zip`;
const RELEASES_PAGE_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
const ALARM_NAME = "cogwheel_auto_update_check";

/**
 * Compares two SemVer strings (e.g., "2.7.0" vs "2.6.1").
 * Returns true if remoteVersion is strictly newer than localVersion.
 */
export function isNewerVersion(localVersion: string, remoteVersion: string): boolean {
  const localParts = localVersion.replace(/^v/, "").split(".").map(Number);
  const remoteParts = remoteVersion.replace(/^v/, "").split(".").map(Number);
  const maxLen = Math.max(localParts.length, remoteParts.length);

  for (let i = 0; i < maxLen; i++) {
    const localNum = localParts[i] ?? 0;
    const remoteNum = remoteParts[i] ?? 0;
    if (remoteNum > localNum) return true;
    if (remoteNum < localNum) return false;
  }
  return false;
}

/**
 * Runs both OTA data sync (silent live rules/templates update)
 * and extension binary version check against GitHub main.
 */
export async function runAutoUpdateCheck(): Promise<ExtensionUpdateState> {
  const currentVersion =
    typeof chrome !== "undefined" && chrome.runtime?.getManifest
      ? chrome.runtime.getManifest().version
      : "2.7.0";
  const nowIso = new Date().toISOString();

  let latestVersion = currentVersion;
  let updateAvailable = false;
  let otaDataVersion = "local-default";

  try {
    // 1. Check remote manifest.json for UI / Extension code updates
    const manifestRes = await fetch(
      `${RAW_BASE}/chrome-extension/public/manifest.json?t=${Date.now()}`,
      {
        cache: "no-store",
      }
    );
    if (manifestRes.ok) {
      const remoteManifest = (await manifestRes.json()) as RemoteManifest;
      latestVersion = remoteManifest.version;
      updateAvailable = isNewerVersion(currentVersion, latestVersion);
    }

    // 2. Silently sync latest SEO/GEO rules, pixel limits & keyword matrix (OTA)
    const otaRes = await fetch(`${RAW_BASE}/data/ota-config.json?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (otaRes.ok) {
      const otaConfig = (await otaRes.json()) as OtaConfigPayload;
      otaDataVersion = otaConfig.schemaVersion;
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        await chrome.storage.local.set({
          cogwheel_ota_config: otaConfig,
        });
      }
    }
  } catch (error) {
    console.warn("[SEO Studio Auto-Updater] Offline or rate-limited:", error);
  }

  const updateState: ExtensionUpdateState = {
    currentVersion,
    latestVersion,
    updateAvailable,
    releaseDownloadUrl: RELEASE_ZIP_URL,
    releaseNotesUrl: RELEASES_PAGE_URL,
    lastCheckedAt: nowIso,
    otaDataVersion,
    otaSyncedAt: nowIso,
  };

  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    await chrome.storage.local.set({ cogwheel_update_state: updateState });
  }

  // Highlight extension toolbar icon when a new build is ready
  if (typeof chrome !== "undefined" && chrome.action?.setBadgeText) {
    if (updateAvailable) {
      await chrome.action.setBadgeText({ text: "NEW" });
      await chrome.action.setBadgeBackgroundColor({ color: "#10B981" });
    } else {
      await chrome.action.setBadgeText({ text: "" });
    }
  }

  return updateState;
}

export function initAutoUpdater(): void {
  if (typeof chrome === "undefined" || !chrome.runtime) return;

  // Register periodic 6-hour background check
  chrome.runtime.onInstalled?.addListener(() => {
    chrome.alarms?.create(ALARM_NAME, { periodInMinutes: 360 });
    void runAutoUpdateCheck();
  });

  chrome.runtime.onStartup?.addListener(() => {
    void runAutoUpdateCheck();
  });

  chrome.alarms?.onAlarm?.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      void runAutoUpdateCheck();
    }
  });

  // Allow manual "Check for Updates" trigger from the Inspector UI
  chrome.runtime.onMessage?.addListener((message: { type?: string }, _sender, sendResponse) => {
    if (message.type === "SEO_STUDIO_CHECK_UPDATES" || message.type === "SYNC_RULES_NOW") {
      void runAutoUpdateCheck().then((state) => sendResponse(state));
      return true;
    }
    if (message.type === "GET_UPDATE_METADATA") {
      void chrome.storage.local.get(["cogwheel_update_state"], (res) => {
        const state = res["cogwheel_update_state"] as ExtensionUpdateState | undefined;
        sendResponse({ success: true, metadata: state });
      });
      return true;
    }
    return false;
  });
}
