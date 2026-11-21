/**
 * Cogwheel SEO Studio - Free GitHub-Hosted Auto-Update Engine (Manifest V3)
 * 
 * Layer A: Silent Over-the-Air (OTA) Live Sync for templates, keyword matrices, and brand rules
 * Layer B: Extension Binary / UI SemVer Checker & Action Badge Notifier
 */

export interface RemoteManifest {
  name: string;
  version: string;
  description?: string;
}

export interface UpdateMetadata {
  hasUpdate: boolean;
  currentVersion: string;
  remoteVersion: string;
  releaseUrl: string;
  downloadUrl: string;
  changelog: string;
  lastChecked: number;
}

export interface LiveSyncData {
  lastSynced: number;
  keywordCount: number;
  matrixSha: string;
  status: "success" | "error" | "cached";
  message: string;
}

const GITHUB_REPO_OWNER = "jisan-razibmarketing";
const GITHUB_REPO_NAME = "Cogwheel-SEO-Templates";
const GITHUB_BRANCH = "main";

const RAW_GITHUB_BASE = `https://raw.githubusercontent.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/${GITHUB_BRANCH}`;
const REMOTE_MANIFEST_URL = `${RAW_GITHUB_BASE}/chrome-extension/public/manifest.json`;
const REMOTE_KEYWORD_MATRIX_URL = `${RAW_GITHUB_BASE}/data/78-keyword-strategy-matrix.json`;

const STORAGE_KEY_UPDATE = "cogwheel_extension_update";
const STORAGE_KEY_OTA_KEYWORDS = "cogwheel_ota_keyword_matrix";
const STORAGE_KEY_OTA_METADATA = "cogwheel_ota_sync_metadata";

const ALARM_NAME_SYNC = "cogwheel-ota-sync";
const ALARM_INTERVAL_MINUTES = 360; // Every 6 hours

/**
 * SemVer comparison utility (v1 > v2 => 1, v1 < v2 => -1, v1 == v2 => 0)
 */
export function compareSemVer(v1: string, v2: string): number {
  const clean1 = v1.replace(/^v/, "").trim();
  const clean2 = v2.replace(/^v/, "").trim();

  const parts1 = clean1.split(".").map((n) => parseInt(n, 10) || 0);
  const parts2 = clean2.split(".").map((n) => parseInt(n, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLen; i++) {
    const num1 = parts1[i] ?? 0;
    const num2 = parts2[i] ?? 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Layer A — Silent Over-the-Air (OTA) Live Sync
 * Fetches latest 78-keyword strategy matrix and brand rules from GitHub main
 */
export async function triggerLiveSync(): Promise<LiveSyncData> {
  try {
    const response = await fetch(REMOTE_KEYWORD_MATRIX_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch keyword matrix: HTTP ${response.status}`);
    }

    const jsonText = await response.text();
    const parsedData = JSON.parse(jsonText) as {
      metadata?: { totalKeywords?: number };
      keywords?: unknown[];
    };

    const keywordCount = parsedData.metadata?.totalKeywords ?? (Array.isArray(parsedData.keywords) ? parsedData.keywords.length : 78);

    // Compute simple checksum
    let hash = 0;
    for (let i = 0; i < jsonText.length; i++) {
      hash = (hash << 5) - hash + jsonText.charCodeAt(i);
      hash |= 0;
    }
    const matrixSha = `sha_${Math.abs(hash).toString(16)}`;

    // Cache in chrome.storage.local
    await new Promise<void>((resolve) => {
      chrome.storage.local.set(
        {
          [STORAGE_KEY_OTA_KEYWORDS]: jsonText,
          [STORAGE_KEY_OTA_METADATA]: {
            lastSynced: Date.now(),
            keywordCount,
            matrixSha,
          },
        },
        () => resolve()
      );
    });

    return {
      lastSynced: Date.now(),
      keywordCount,
      matrixSha,
      status: "success",
      message: `Synchronized ${keywordCount} hospitality SEO & GEO keywords and brand rules.`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown sync error";
    return {
      lastSynced: Date.now(),
      keywordCount: 78,
      matrixSha: "fallback",
      status: "error",
      message: msg,
    };
  }
}

/**
 * Layer B — Extension Binary / UI SemVer Version Checker
 * Compares current installed manifest against remote GitHub main manifest.json
 */
export async function checkForExtensionUpdate(): Promise<UpdateMetadata> {
  const currentVersion = chrome.runtime.getManifest().version;

  try {
    const response = await fetch(REMOTE_MANIFEST_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch remote manifest: HTTP ${response.status}`);
    }

    const remoteManifest = (await response.json()) as RemoteManifest;
    const remoteVersion = remoteManifest.version;

    const isNewer = compareSemVer(remoteVersion, currentVersion) > 0;
    const releaseUrl = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/tag/v${remoteVersion}`;
    const downloadUrl = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/download/v${remoteVersion}/cogwheel-seo-studio-v${remoteVersion}.zip`;

    const metadata: UpdateMetadata = {
      hasUpdate: isNewer,
      currentVersion,
      remoteVersion,
      releaseUrl,
      downloadUrl,
      changelog: isNewer
        ? `Cogwheel SEO Studio v${remoteVersion} is available with updated hospitality templates, live SERP width tools, and GEO AI rules.`
        : "Installed version is optimal and up to date with GitHub main.",
      lastChecked: Date.now(),
    };

    // Store in storage
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY_UPDATE]: metadata }, () => resolve());
    });

    // Update Action Badge
    if (chrome.action && chrome.action.setBadgeText) {
      if (isNewer) {
        chrome.action.setBadgeText({ text: "NEW" });
        chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
      } else {
        chrome.action.setBadgeText({ text: "" });
      }
    }

    return metadata;
  } catch (error) {
    const fallbackMetadata: UpdateMetadata = {
      hasUpdate: false,
      currentVersion,
      remoteVersion: currentVersion,
      releaseUrl: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`,
      downloadUrl: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`,
      changelog: "Offline or unable to connect to GitHub.",
      lastChecked: Date.now(),
    };

    return fallbackMetadata;
  }
}

/**
 * Retrieve cached update metadata
 */
export async function getStoredUpdateInfo(): Promise<UpdateMetadata | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY_UPDATE], (result) => {
      const info = result[STORAGE_KEY_UPDATE] as UpdateMetadata | undefined;
      resolve(info ?? null);
    });
  });
}

/**
 * Initialize 6-hour alarm schedule and startup listeners
 */
export function initAutoUpdater(): void {
  // 1. Setup recurring alarm (every 6 hours)
  if (chrome.alarms && chrome.alarms.create) {
    chrome.alarms.create(ALARM_NAME_SYNC, {
      periodInMinutes: ALARM_INTERVAL_MINUTES,
    });

    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === ALARM_NAME_SYNC) {
        void triggerLiveSync();
        void checkForExtensionUpdate();
      }
    });
  }

  // 2. Run initial check on install or startup
  void triggerLiveSync();
  void checkForExtensionUpdate();

  // 3. Listen for direct UI messages from SidePanel
  chrome.runtime.onMessage.addListener((message: { type?: string }, _sender, sendResponse) => {
    if (message.type === "CHECK_FOR_UPDATES") {
      checkForExtensionUpdate().then((res) => {
        sendResponse({ success: true, metadata: res });
      });
      return true;
    }

    if (message.type === "SYNC_RULES_NOW") {
      triggerLiveSync().then((res) => {
        sendResponse({ success: true, data: res });
      });
      return true;
    }

    if (message.type === "GET_UPDATE_METADATA") {
      getStoredUpdateInfo().then((res) => {
        sendResponse({ success: true, metadata: res });
      });
      return true;
    }
  });
}
