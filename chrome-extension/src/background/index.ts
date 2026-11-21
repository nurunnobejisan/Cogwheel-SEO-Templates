// Background Service Worker for Cogwheel Chrome Extension
import { isRestrictedUrl } from "../utils/urlSecurity";
import { initAutoUpdater } from "./auto-updater";

// Initialize GitHub Auto-Update & Silent OTA Live Sync Engine
initAutoUpdater();

chrome.runtime.onInstalled.addListener(() => {
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

// Handle Context Menu Clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;

  if (info.menuItemId === "cogwheel-audit-page") {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
    }
  } else if (info.menuItemId === "cogwheel-generate-schema") {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ tabId: tab.id }).then(() => {
        setTimeout(() => {
          chrome.runtime.sendMessage({
            type: "NAVIGATE_TAB",
            tab: "studio",
            templateId: "schema-hotel-graph",
          }, () => {
            if (chrome.runtime.lastError) {}
          });
        }, 500);
      }).catch(() => {});
    }
  } else if (info.menuItemId === "cogwheel-template-selection") {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ tabId: tab.id }).then(() => {
        setTimeout(() => {
          chrome.runtime.sendMessage({
            type: "SELECTION_RECEIVED",
            text: info.selectionText || "",
          }, () => {
            if (chrome.runtime.lastError) {}
          });
        }, 500);
      }).catch(() => {});
    }
  }
});

// Auto-Update Badge & Auto-Inform Side Panel on Tab Switch
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError || !tab || !tab.url || isRestrictedUrl(tab.url)) {
      return;
    }
    chrome.tabs.sendMessage(activeInfo.tabId, { type: "EXTRACT_PAGE_DATA" }, (res) => {
      if (chrome.runtime.lastError) return;
      if (res && res.data) {
        chrome.runtime.sendMessage({
          type: "AUTO_PAGE_CONTEXT_UPDATED",
          tabId: activeInfo.tabId,
          data: res.data,
        }, () => {
          if (chrome.runtime.lastError) {}
        });
      }
    });
  });
});

// Auto-Extract when page finishes loading
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab && tab.url && !isRestrictedUrl(tab.url)) {
    chrome.tabs.sendMessage(tabId, { type: "EXTRACT_PAGE_DATA" }, (res) => {
      if (chrome.runtime.lastError) return;
      if (res && res.data) {
        chrome.runtime.sendMessage({
          type: "AUTO_PAGE_CONTEXT_UPDATED",
          tabId,
          data: res.data,
        }, () => {
          if (chrome.runtime.lastError) {}
        });
      }
    });
  }
});

// Message Hub
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
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

  if (request.type === "OPEN_SIDEPANEL") {
    if (chrome.sidePanel && chrome.sidePanel.open && request.tabId) {
      chrome.sidePanel.open({ tabId: request.tabId })
        .then(() => sendResponse({ success: true }))
        .catch((e) => sendResponse({ success: false, error: String(e) }));
      return true;
    }
  }
});
