// Background Service Worker for SEO Studio Extension
import { checkPageRestriction, isRestrictedUrl } from "../utils/urlSecurity";
import { initAutoUpdater } from "./auto-updater";
import { calculateSeoScores } from "../data/seoStudioTemplates";
import { PageAuditData } from "../types/extension";

// Initialize GitHub Auto-Update & Silent OTA Live Sync Engine
initAutoUpdater();

// Cached live page audit data by tabId for zero-latency retrieval
const latestTabAuditData = new Map<number, PageAuditData>();

/**
 * Universal broadcast to all open extension views (Side Panel, Popup, Options).
 * Automatically delivers updates to active views without artificial gates or deadlocks.
 */
function broadcastPageUpdate(tabId: number, message: unknown): void {
  chrome.runtime.sendMessage(message, () => {
    if (chrome.runtime.lastError) {
      // Ignored if no receiver view is open
    }
  });
}

/**
 * Universal content script pinger & auto-injector.
 * Pings the tab; if unresponsive, injects via chrome.scripting.executeScript into main frame and retries once.
 */
async function ensureContentScriptInjected(tabId: number): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, { type: "PING" }, (res) => {
        if (!chrome.runtime.lastError && res && res.status === "PONG") {
          resolve(true);
          return;
        }

        // Script not active or not injected; inject dynamically into main frame
        if (chrome.scripting && chrome.scripting.executeScript) {
          chrome.scripting
            .executeScript({
              target: { tabId },
              files: ["content.js"],
            })
            .then(() => {
              // Retry ping once after injection with slight delay for listener setup
              setTimeout(() => {
                chrome.tabs.sendMessage(tabId, { type: "PING" }, (retryRes) => {
                  if (!chrome.runtime.lastError && retryRes && retryRes.status === "PONG") {
                    resolve(true);
                  } else {
                    resolve(false);
                  }
                });
              }, 100);
            })
            .catch(() => resolve(false));
        } else {
          resolve(false);
        }
      });
    } catch {
      resolve(false);
    }
  });
}

/**
 * Injects content.js into all matching open tabs so that existing tabs
 * become instantly inspectable without requiring a manual refresh.
 */
async function injectContentScriptIntoAllTabs(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
    for (const tab of tabs) {
      if (tab.id && !isRestrictedUrl(tab.url)) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"],
          });
        } catch {
          // Tab may not be ready or allowed; safely ignore
        }
      }
    }
  } catch {
    // Ignore
  }
}

// Ensure open tabs are immediately scriptable upon background worker start
injectContentScriptIntoAllTabs();

/**
 * Common extraction dispatcher for a tab.
 */
async function triggerPageDataExtraction(tabId: number, url?: string): Promise<void> {
  const restriction = checkPageRestriction(url);
  if (restriction.isRestricted) {
    broadcastPageUpdate(tabId, {
      type: "PAGE_RESTRICTION_STATUS",
      tabId,
      status: restriction.status,
      reason: restriction.reason,
    });
    return;
  }

  const ok = await ensureContentScriptInjected(tabId);
  if (!ok) return;

  chrome.tabs.sendMessage(tabId, { type: "EXTRACT_PAGE_DATA" }, (res) => {
    if (!chrome.runtime.lastError && res && res.data) {
      latestTabAuditData.set(tabId, res.data);

      try {
        const scores = calculateSeoScores(res.data);
        if (scores && typeof scores.overall === "number") {
          chrome.action.setBadgeText({ tabId, text: `${scores.overall}` });
          const color =
            scores.overall >= 90
              ? "#10B981"
              : scores.overall >= 75
                ? "#0284C7"
                : scores.overall >= 60
                  ? "#F59E0B"
                  : "#EF4444";
          chrome.action.setBadgeBackgroundColor({ tabId, color });
        }
      } catch {}

      broadcastPageUpdate(tabId, {
        type: "AUTO_PAGE_CONTEXT_UPDATED",
        tabId,
        data: res.data,
      });
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  // Inject content script into all currently open tabs upon extension install or update
  injectContentScriptIntoAllTabs();

  // Allow Side Panel to open upon clicking the action if supported
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: false })
      .catch(() => {
        // Handled silently
      });
  }

  // Create Right-Click Context Menus
  chrome.contextMenus.create({
    id: "seo-studio-audit-page",
    title: "SEO: Audit This Page",
    contexts: ["page", "link"],
  });

  chrome.contextMenus.create({
    id: "seo-studio-generate-schema",
    title: "SEO: Generate Schema for Page",
    contexts: ["page"],
  });

  chrome.contextMenus.create({
    id: "seo-studio-template-selection",
    title: "SEO: Run Template on Selection",
    contexts: ["selection"],
  });
});

// Handle Context Menu Clicks with Handshake-Backed Queue
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;
  const tabId = tab.id;

  if (info.menuItemId === "seo-studio-audit-page") {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ tabId }).catch(() => {});
    }
  } else if (info.menuItemId === "seo-studio-generate-schema") {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ tabId }).then(() => {
        broadcastPageUpdate(tabId, {
          type: "NAVIGATE_TAB",
          tab: "studio",
          templateId: "schema-hotel-graph",
        });
      }).catch(() => {});
    }
  } else if (info.menuItemId === "seo-studio-template-selection") {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ tabId }).then(() => {
        broadcastPageUpdate(tabId, {
          type: "SELECTION_RECEIVED",
          text: info.selectionText || "",
        });
      }).catch(() => {});
    }
  }
});

// Auto-Update Badge & Auto-Inform Side Panel on Tab Switch
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError || !tab) return;
    triggerPageDataExtraction(activeInfo.tabId, tab.url);
  });
});

// Auto-Extract when page finishes loading
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab && tab.url) {
    triggerPageDataExtraction(tabId, tab.url);
  }
});

// Listen to SPA History Changes and Committed Navigations via webNavigation
if (chrome.webNavigation) {
  const onNavEvent = (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => {
    // Only handle top-level frame transitions
    if (details.frameId === 0 && details.url) {
      triggerPageDataExtraction(details.tabId, details.url);
    }
  };

  chrome.webNavigation.onHistoryStateUpdated.addListener(onNavEvent);
  chrome.webNavigation.onCommitted.addListener(onNavEvent);
}

// Message Hub
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handshake from Side Panel & Active Data Request
  if (request.type === "SIDE_PANEL_READY" || request.type === "GET_ACTIVE_TAB_DATA") {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab && tab.id) {
        const cached = latestTabAuditData.get(tab.id);
        if (cached) {
          broadcastPageUpdate(tab.id, {
            type: "AUTO_PAGE_CONTEXT_UPDATED",
            tabId: tab.id,
            data: cached,
          });
        }
        if (tab.url) {
          triggerPageDataExtraction(tab.id, tab.url);
        }
      }
    }).catch(() => {});
    sendResponse({ status: "ACK" });
    return true;
  }

  // Ping handler
  if (request.type === "PING_BACKGROUND") {
    sendResponse({ status: "PONG" });
    return true;
  }

  // Check Restriction status
  if (request.type === "CHECK_RESTRICTION") {
    const check = checkPageRestriction(request.url);
    sendResponse(check);
    return true;
  }

  // Update Badge
  if (request.type === "UPDATE_BADGE") {
    const { score, tabId } = request;
    if (tabId !== undefined && score !== undefined) {
      chrome.action.setBadgeText({ tabId, text: `${score}` });
      const color =
        score >= 90
          ? "#10B981"
          : score >= 75
            ? "#0284C7"
            : score >= 60
              ? "#F59E0B"
              : "#EF4444";
      chrome.action.setBadgeBackgroundColor({ tabId, color });
    }
    sendResponse({ success: true });
    return true;
  }

  // Auto-capture Recording Badge Indicator
  if (request.type === "SET_RECORDING_BADGE") {
    const { isRecording, tabId } = request;
    if (tabId !== undefined) {
      if (isRecording) {
        chrome.action.setBadgeText({ tabId, text: "REC" });
        chrome.action.setBadgeBackgroundColor({ tabId, color: "#EF4444" });
      } else {
        chrome.action.setBadgeText({ tabId, text: "" });
      }
    }
    sendResponse({ success: true });
    return true;
  }

  if (request.type === "OPEN_SIDEPANEL") {
    if (chrome.sidePanel && chrome.sidePanel.open && request.tabId) {
      chrome.sidePanel
        .open({ tabId: request.tabId })
        .then(() => sendResponse({ success: true }))
        .catch((e) => sendResponse({ success: false, error: String(e) }));
      return true;
    }
  }
});
