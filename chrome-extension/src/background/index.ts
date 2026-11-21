// Background Service Worker for Cogwheel Chrome Extension

chrome.runtime.onInstalled.addListener(() => {
  // Allow Side Panel to open upon clicking the action if supported
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: false })
      .catch((err) => console.log("Sidepanel behavior error:", err));
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
      chrome.sidePanel.open({ tabId: tab.id });
    }
  } else if (info.menuItemId === "cogwheel-generate-schema") {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ tabId: tab.id }).then(() => {
        // Send message to jump to schema
        setTimeout(() => {
          chrome.runtime.sendMessage({ type: "NAVIGATE_TAB", tab: "studio", templateId: "schema-hotel-graph" });
        }, 500);
      });
    }
  } else if (info.menuItemId === "cogwheel-template-selection") {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ tabId: tab.id }).then(() => {
        setTimeout(() => {
          chrome.runtime.sendMessage({
            type: "SELECTION_RECEIVED",
            text: info.selectionText || "",
          });
        }, 500);
      });
    }
  }
});

// Auto-Update Badge & Auto-Inform Side Panel on Tab Switch
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.sendMessage(activeInfo.tabId, { type: "EXTRACT_PAGE_DATA" }, (res) => {
    if (res && res.data) {
      chrome.runtime.sendMessage({
        type: "AUTO_PAGE_CONTEXT_UPDATED",
        tabId: activeInfo.tabId,
        data: res.data,
      });
    }
  });
});

// Auto-Extract when page finishes loading
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url && !tab.url.startsWith("chrome://")) {
    chrome.tabs.sendMessage(tabId, { type: "EXTRACT_PAGE_DATA" }, (res) => {
      if (res && res.data) {
        chrome.runtime.sendMessage({
          type: "AUTO_PAGE_CONTEXT_UPDATED",
          tabId,
          data: res.data,
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
