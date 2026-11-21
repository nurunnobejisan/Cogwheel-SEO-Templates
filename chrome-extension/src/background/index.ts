// Background Service Worker for Cogwheel Chrome Extension

chrome.runtime.onInstalled.addListener(() => {
  // Allow Side Panel to open upon clicking the action if desired
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: false }) // Popup on click, with button to open sidepanel
      .catch((err) => console.log("Sidepanel behavior error:", err));
  }

  // Create Context Menus
  chrome.contextMenus.create({
    id: "open-cogwheel-sidepanel",
    title: "Open Cogwheel SEO Side Panel",
    contexts: ["page", "selection"],
  });

  chrome.contextMenus.create({
    id: "toggle-heading-badges",
    title: "Highlight On-Page Heading Badges",
    contexts: ["page"],
  });

  chrome.contextMenus.create({
    id: "toggle-missing-alts",
    title: "Highlight Images Missing ALT Text",
    contexts: ["page"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;

  if (info.menuItemId === "open-cogwheel-sidepanel") {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ tabId: tab.id });
    }
  } else if (info.menuItemId === "toggle-heading-badges") {
    chrome.tabs.sendMessage(tab.id, {
      type: "TOGGLE_OVERLAY",
      overlayType: "headings",
      enabled: true,
    });
  } else if (info.menuItemId === "toggle-missing-alts") {
    chrome.tabs.sendMessage(tab.id, {
      type: "TOGGLE_OVERLAY",
      overlayType: "missingAlts",
      enabled: true,
    });
  }
});

// Update Badge with Live Score
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
      chrome.sidePanel.open({ tabId: request.tabId }).then(() => {
        sendResponse({ success: true });
      }).catch((e) => {
        sendResponse({ success: false, error: String(e) });
      });
      return true;
    }
  }
});
