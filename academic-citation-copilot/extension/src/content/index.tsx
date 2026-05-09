import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "../sidebar/App";
import sidebarStyles from "../sidebar/styles.css?inline";
import type { InsertCitationMessage, SelectionChangedMessage } from "../types/messages";

const HOST_ID = "academic-citation-copilot-shadow-host";

function getSelectedText(): string {
  return window.getSelection()?.toString().trim() ?? "";
}

async function attemptInsertCitation(citation: string): Promise<boolean> {
  try {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return false;
    }
    const range = selection.getRangeAt(0);
    range.collapse(false);
    range.insertNode(document.createTextNode(` (${citation})`));
    selection.removeAllRanges();
    return true;
  } catch (error) {
    console.warn("Google Docs insertion failed; falling back to clipboard.", error);
    return false;
  }
}

function dispatchSelectionChanged(text: string): void {
  const message: SelectionChangedMessage = { type: "SELECTION_CHANGED", text };
  window.dispatchEvent(new CustomEvent("acc-selection-changed", { detail: message }));
}

function mountSidebar(): void {
  if (document.getElementById(HOST_ID)) {
    return;
  }

  const host = document.createElement("div");
  host.id = HOST_ID;
  const shadowRoot = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = sidebarStyles;
  shadowRoot.appendChild(style);

  const mountNode = document.createElement("div");
  shadowRoot.appendChild(mountNode);
  document.documentElement.appendChild(host);

  createRoot(mountNode).render(<App initialSelectedText={getSelectedText()} onInsertCitation={attemptInsertCitation} />);
}

function watchSelection(): void {
  let lastSelection = getSelectedText();
  document.addEventListener("selectionchange", () => {
    const nextSelection = getSelectedText();
    if (nextSelection !== lastSelection) {
      lastSelection = nextSelection;
      dispatchSelectionChanged(nextSelection);
    }
  });
}

chrome.runtime.onMessage.addListener((message: InsertCitationMessage, _sender, sendResponse) => {
  if (message.type !== "INSERT_CITATION") {
    return false;
  }
  attemptInsertCitation(message.citation).then((inserted) => sendResponse({ inserted })).catch(() => sendResponse({ inserted: false }));
  return true;
});

mountSidebar();
watchSelection();
