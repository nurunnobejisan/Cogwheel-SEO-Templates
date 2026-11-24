// Background Service Worker for Cogwheel Chrome Extension
import { checkPageRestriction, isRestrictedUrl } from "../utils/urlSecurity";
import { initAutoUpdater } from "./auto-updater";

// Initialize GitHub Auto-Update & Silent OTA Live Sync Engine
initAutoUpdater();

// Side Panel Ready Handshake & Queue System
const sidePanelReadyTabs = new Set<number>();
const sidePanelMessageQueue = new Map<number, unknown[]>();

function sendOrQueueSidePanelMessage(tabId: number, message: unknown): void {
  if (sidePanelReadyTabs.has(tabId)) {
    chrome.runtime.sendMessage(message, () => {
      if (chrome.runtime.lastError) {
        // Side panel may have closed or navigated; remove ready state and re-queue if desired
        sidePanelReadyTabs.delete(tabId);
      }
    });
  } else {
    const queue = sidePanelMessageQueue.get(tabId) || [];
    queue.push(message);
    sidePanelMessageQueue.set(tabId, queue);
  }
}

function flushSidePanelQueue(tabId: number): void {
  sidePanelReadyTabs.add(tabId);
  const queue = sidePanelMessageQueue.get(tabId);
  if (queue && queue.length > 0) {
    while (queue.length > 0) {
      const msg = queue.shift();
      chrome.runtime.sendMessage(msg, () => {
        if (chrome.runtime.lastError) {
          // Handled silently
        }
      });
    }
  }
  sidePanelMessageQueue.delete(tabId);
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
    sendOrQueueSidePanelMessage(tabId, {
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
      sendOrQueueSidePanelMessage(tabId, {
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
    id: "cogwheel-audit-page",
    title: "Cogwheel SEO: Audit This Page",
    contexts: ["page", "link"],
  });

  chrome.contextMenus.create({
    id: "cogwheel-generate-schema",
    title: "Cogwheel SEO: Generate Schema for Page",
    contexts: ["page"],
  });

  chrome.contextMenus.create({
    id: "cogwheel-template-selection",
    title: "Cogwheel SEO: Run Template on Selection",
    contexts: ["selection"],
  });
});

// Handle Context Menu Clicks with Handshake-Backed Queue
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;
  const tabId = tab.id;

  if (info.menuItemId === "cogwheel-audit-page") {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ tabId }).catch(() => {});
    }
  } else if (info.menuItemId === "cogwheel-generate-schema") {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ tabId }).then(() => {
        sendOrQueueSidePanelMessage(tabId, {
          type: "NAVIGATE_TAB",
          tab: "studio",
          templateId: "schema-hotel-graph",
        });
      }).catch(() => {});
    }
  } else if (info.menuItemId === "cogwheel-template-selection") {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ tabId }).then(() => {
        sendOrQueueSidePanelMessage(tabId, {
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
  // Handshake from Side Panel
  if (request.type === "SIDE_PANEL_READY") {
    const tabId = request.tabId || (sender.tab && sender.tab.id);
    if (tabId) {
      flushSidePanelQueue(tabId);
    }
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
