(window as any).process = { env: { NODE_ENV: 'production' } };
(globalThis as any).process = { env: { NODE_ENV: 'production' } };

import "../utils/languageDetector";
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "../sidebar/App";
import sidebarStyles from "../sidebar/styles.css?inline";
import type { ContextMenuSelectionMessage, InsertCitationMessage, ScanDocumentRequestedMessage } from "../types/messages";
import { scanDocument } from "./documentScanner";

const HOST_ID = "academic-citation-copilot-shadow-host";
const EXTENSION_ROOT_ATTR = "data-veriton-extension-root";

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

function mountSidebar(): void {
  if (document.getElementById(HOST_ID)) {
    return;
  }

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute(EXTENSION_ROOT_ATTR, "true");
  const shadowRoot = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = sidebarStyles;
  shadowRoot.appendChild(style);

  const mountNode = document.createElement("div");
  mountNode.setAttribute(EXTENSION_ROOT_ATTR, "true");
  shadowRoot.appendChild(mountNode);
  document.documentElement.appendChild(host);

  createRoot(mountNode).render(<App onInsertCitation={attemptInsertCitation} />);
}

chrome.runtime.onMessage.addListener((message: InsertCitationMessage | ContextMenuSelectionMessage | ScanDocumentRequestedMessage, _sender, sendResponse) => {
  if (message.type === "CONTEXT_MENU_SELECTION" && message.text) {
    window.dispatchEvent(new CustomEvent("acc-context-menu-selection", { detail: { text: message.text } }));
    return false;
  }

  if (message.type === "SCAN_DOCUMENT_REQUESTED") {
    scanDocument()
      .then((result) => sendResponse({ ok: true, payload: result }))
      .catch((error: unknown) => sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    return true;
  }

  if (message.type === "INSERT_CITATION") {
    attemptInsertCitation(message.citation).then((inserted) => sendResponse({ inserted })).catch(() => sendResponse({ inserted: false }));
    return true;
  }

  return false;
});

if (window.self === window.top) {
  mountSidebar();
}
