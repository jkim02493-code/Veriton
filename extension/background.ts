chrome.runtime.onInstalled.addListener(() => {
  console.log("Veriton installed and ready.");
});

// Open the side panel automatically when the user is on a Google Doc
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url?.includes("docs.google.com/document")
  ) {
    chrome.sidePanel.open({ tabId }).catch(() => {
      // Side panel may already be open - ignore error
    });
  }
});

// Also open when the extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab.id && tab.url?.includes("docs.google.com/document")) {
    chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  }
});
