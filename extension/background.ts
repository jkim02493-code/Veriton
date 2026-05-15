chrome.runtime.onInstalled.addListener(() => {
  console.log("Veriton installed and ready.");
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.url?.includes("docs.google.com/document")) {
    chrome.action.openPopup();
  }
});
