// Background service worker for Cogwheel SEO Studio Extension
chrome.runtime.onInstalled.addListener(() => {
  console.log("Cogwheel SEO & GEO Studio Inspector installed successfully.");
});

// Update badge when message received from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "UPDATE_BADGE") {
    const score = request.score;
    const tabId = request.tabId;
    if (tabId && score !== undefined) {
      chrome.action.setBadgeText({ tabId, text: `${score}` });
      const color = score >= 90 ? "#10B981" : score >= 75 ? "#0284C7" : score >= 60 ? "#F59E0B" : "#EF4444";
      chrome.action.setBadgeBackgroundColor({ tabId, color });
    }
    sendResponse({ success: true });
  }
});
