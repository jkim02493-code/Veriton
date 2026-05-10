import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "../sidebar/App";
import sidebarStyles from "../sidebar/styles.css?inline";
import type { InsertCitationMessage, SelectionChangedMessage, SelectionRequestedMessage, SelectionResponseMessage, SelectionSnapshot } from "../types/messages";
import { clipboardCopyFallback } from "../utils/clipboardFallback";
import { cleanSelectedText, isReasonableSelectedText } from "../utils/selectionValidation";

const HOST_ID = "academic-citation-copilot-shadow-host";
const EXTENSION_ROOT_ATTR = "data-veriton-extension-root";
const RECENT_SELECTION_MS = 5_000;
let cachedSelection: SelectionSnapshot = emptySnapshot("Waiting for Google Docs selection.");
let pendingSelection: SelectionSnapshot | null = null;
let lastDocumentUrl = currentDocumentUrl();

type ExtractionResult = {
  text: string;
  method: string;
  detail: string;
};

const EXTENSION_UI_PHRASES = [
  "find credible evidence",
  "selected google docs text only",
  "find evidence",
  "no strong evidence found",
];

function isDevBuild(): boolean {
  return import.meta.env.DEV;
}

function devLog(message: string, value?: unknown): void {
  if (isDevBuild()) {
    console.info(`[ACC content] ${message}`, value ?? "");
  }
}

function currentDocumentUrl(): string {
  return window.location.href.split("#")[0];
}

function normalizedSelectionText(text: string): string {
  return cleanSelectedText(text).toLowerCase();
}

function selectionFingerprint(text: string, documentUrl: string, capturedAt: number | null): string {
  return `${normalizedSelectionText(text)}|${documentUrl}|${capturedAt ?? "none"}`;
}

function clearCachedSelection(reason: string): SelectionSnapshot {
  cachedSelection = emptySnapshot(reason);
  pendingSelection = null;
  devLog("selectedText cache cleared", reason);
  return cachedSelection;
}

function nodeBelongsToSidebar(node: Node | null): boolean {
  if (!node) {
    return false;
  }
  const root = node.getRootNode();
  if (root instanceof ShadowRoot && root.host instanceof Element && (root.host.id === HOST_ID || root.host.getAttribute(EXTENSION_ROOT_ATTR) === "true")) {
    return true;
  }
  if (node instanceof Element) {
    return Boolean(node.closest(`[${EXTENSION_ROOT_ATTR}="true"], #${HOST_ID}`));
  }
  return Boolean(node.parentElement?.closest(`[${EXTENSION_ROOT_ATTR}="true"], #${HOST_ID}`));
}

function eventBelongsToSidebar(event: Event): boolean {
  return event.composedPath().some((node) => node instanceof Element && node.id === HOST_ID);
}

function sidebarHasFocusOrSelection(): boolean {
  const selection = window.getSelection();
  return nodeBelongsToSidebar(document.activeElement) || nodeBelongsToSidebar(selection?.anchorNode ?? null) || nodeBelongsToSidebar(selection?.focusNode ?? null);
}

function nodeBelongsToGoogleDocsEditor(node: Node | null): boolean {
  if (!node || nodeBelongsToSidebar(node)) {
    return false;
  }
  const element = node instanceof Element ? node : node.parentElement;
  return Boolean(element?.closest(".kix-appview-editor, .docs-texteventtarget-iframe, .docs-texteventtarget, .kix-page, .kix-canvas-tile-content, .kix-lineview"));
}

function currentSelectionHasGoogleDocsBoundary(): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return false;
  }
  if (nodeBelongsToSidebar(selection.anchorNode) || nodeBelongsToSidebar(selection.focusNode)) {
    devLog("discarded selection from extension sidebar", selection.toString());
    return false;
  }
  return nodeBelongsToGoogleDocsEditor(selection.anchorNode) && nodeBelongsToGoogleDocsEditor(selection.focusNode);
}

function containsExtensionUiPhrase(text: string): boolean {
  const normalized = normalizedSelectionText(text);
  return EXTENSION_UI_PHRASES.some((phrase) => normalized.includes(phrase));
}

function emptySnapshot(emptyReason: string, method = "none"): SelectionSnapshot {
  const documentUrl = currentDocumentUrl();
  return {
    text: "",
    normalizedText: "",
    method,
    emptyReason,
    capturedAt: null,
    documentUrl,
    source: "none",
    fingerprint: selectionFingerprint("", documentUrl, null),
    extractionAttempts: [],
  };
}

function filledSnapshot(text: string, method: string, extractionAttempts: string[] = []): SelectionSnapshot {
  const cleanedText = cleanSelectedText(text);
  const documentUrl = currentDocumentUrl();
  const capturedAt = Date.now();
  return {
    text: cleanedText,
    normalizedText: normalizedSelectionText(cleanedText),
    method,
    emptyReason: "",
    capturedAt,
    documentUrl,
    source: "google-docs",
    fingerprint: selectionFingerprint(cleanedText, documentUrl, capturedAt),
    extractionAttempts,
  };
}

function validateSnapshot(selectionSnapshot: SelectionSnapshot): SelectionSnapshot {
  if (!selectionSnapshot.text) {
    return selectionSnapshot;
  }
  if (containsExtensionUiPhrase(selectionSnapshot.text)) {
    devLog("discarded selectedText containing extension UI phrase", selectionSnapshot.text);
    return emptySnapshot("Selection came from the extension sidebar, not Google Docs.", selectionSnapshot.method);
  }
  if (selectionSnapshot.source !== "google-docs" || selectionSnapshot.documentUrl !== currentDocumentUrl()) {
    return emptySnapshot("Selected text did not come from the active Google Docs document.", selectionSnapshot.method);
  }
  if (!isReasonableSelectedText(selectionSnapshot.text)) {
    return emptySnapshot("Selection looked like a command or local file path, not Google Docs prose.", selectionSnapshot.method);
  }
  return selectionSnapshot;
}

function getWindowSelectionText(): string {
  const selection = window.getSelection();
  if (!currentSelectionHasGoogleDocsBoundary()) {
    return "";
  }
  return cleanSelectedText(selection?.toString());
}

function isVisibleElement(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function rectsOverlap(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function getTextInputSelectionText(): string {
  const activeElement = document.activeElement;
  if (nodeBelongsToSidebar(activeElement) || !nodeBelongsToGoogleDocsEditor(activeElement)) {
    return "";
  }
  if (!(activeElement instanceof HTMLTextAreaElement || activeElement instanceof HTMLInputElement)) {
    return "";
  }

  const start = activeElement.selectionStart ?? 0;
  const end = activeElement.selectionEnd ?? 0;
  return cleanSelectedText(activeElement.value.slice(start, end));
}

function getFocusedEditableProxyText(): string {
  const activeElement = document.activeElement;
  if (!activeElement || nodeBelongsToSidebar(activeElement) || !nodeBelongsToGoogleDocsEditor(activeElement)) {
    return "";
  }
  const text = cleanSelectedText(activeElement.textContent || activeElement.getAttribute("aria-label") || activeElement.getAttribute("data-tooltip"));
  if (text && (activeElement.matches("[contenteditable='true'], [role='textbox'], textarea, input") || activeElement.closest(".kix-appview-editor"))) {
    return text;
  }
  return "";
}

function getGoogleDocsEditorDomText(): string {
  const selectors = [
    ".kix-selection-overlay",
    ".kix-canvas-tile-content",
    ".kix-lineview",
    ".kix-wordhtmlgenerator-word-node",
    "textarea.docs-texteventtarget-iframe",
    "textarea.docs-texteventtarget",
    "textarea[aria-label*='Document']",
    "textarea[aria-label*='document']",
    "[aria-live]",
    "[contenteditable='true']",
    "[role='textbox']",
  ];

  for (const target of Array.from(document.querySelectorAll(selectors.join(",")))) {
    if (nodeBelongsToSidebar(target) || !nodeBelongsToGoogleDocsEditor(target)) {
      continue;
    }
    if (!isVisibleElement(target) && !(target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement)) {
      continue;
    }

    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
      const start = target.selectionStart ?? 0;
      const end = target.selectionEnd ?? 0;
      const selectedText = cleanSelectedText(target.value.slice(start, end));
      if (selectedText) {
        return selectedText;
      }
    }

    const selectedText = cleanSelectedText(target.getAttribute("aria-selected") === "true" ? target.textContent : "");
    if (selectedText) {
      return selectedText;
    }

    const textContent = cleanSelectedText(target.matches("[aria-selected='true'], .kix-wordhtmlgenerator-word-node") ? target.textContent : "");
    if (textContent) {
      return textContent;
    }
  }

  return "";
}

function getGoogleDocsSelectedLineText(): string {
  const overlays = Array.from(document.querySelectorAll(".kix-selection-overlay, .kix-selection-overlay-region"));
  if (overlays.length === 0) {
    return "";
  }

  const overlayRects = overlays.flatMap((overlay) => Array.from(overlay.getClientRects()));
  const lineCandidates = Array.from(document.querySelectorAll(".kix-lineview, .kix-lineview-content, .kix-wordhtmlgenerator-word-node"));
  const matchedText: string[] = [];

  for (const candidate of lineCandidates) {
    if (nodeBelongsToSidebar(candidate) || !nodeBelongsToGoogleDocsEditor(candidate)) {
      continue;
    }
    const candidateText = cleanSelectedText(candidate.textContent);
    if (!candidateText) {
      continue;
    }

    const candidateRects = Array.from(candidate.getClientRects());
    const overlapsSelection = candidateRects.some((candidateRect) => overlayRects.some((overlayRect) => rectsOverlap(candidateRect, overlayRect)));

    if (overlapsSelection) {
      matchedText.push(candidateText);
    }
  }

  return cleanSelectedText([...new Set(matchedText)].join(" "));
}

async function getCopyEventSelectionText(): Promise<ExtractionResult> {
  const attempts: string[] = [];
  let capturedText = "";
  let restoredClipboard = false;
  let clipboardRestoreNote = "clipboard restore not attempted";
  if (!currentSelectionHasGoogleDocsBoundary()) {
    return {
      text: "",
      method: "Google Docs copy-event fallback",
      detail: "copy-event skipped: active selection is not inside the Google Docs editor",
    };
  }

  const originalClipboard = await (navigator.clipboard?.readText?.().catch((error: unknown) => {
      clipboardRestoreNote = `clipboard save unavailable: ${error instanceof Error ? error.message : String(error)}`;
      return null;
    }) ?? Promise.resolve(null));

  const copyListener = (event: ClipboardEvent) => {
    capturedText = cleanSelectedText(event.clipboardData?.getData("text/plain") || event.clipboardData?.getData("text") || "");
    attempts.push(capturedText ? `copy-event: success (${capturedText.length} chars)` : "copy-event: no text in event clipboardData");
  };

  document.addEventListener("copy", copyListener);
  try {
    const executed = document.execCommand("copy");
    if (!executed) {
      attempts.push("execCommand('copy'): browser returned false");
    }
  } catch (error) {
    attempts.push(`execCommand('copy'): ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    document.removeEventListener("copy", copyListener);
  }

  if (!capturedText && navigator.clipboard?.readText) {
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 50));
      const copiedClipboardText = cleanSelectedText(await navigator.clipboard.readText());
      if (copiedClipboardText) {
        capturedText = copiedClipboardText;
        attempts.push(`clipboard read after copy: success (${capturedText.length} chars)`);
      } else {
        attempts.push("clipboard read after copy: empty");
      }
    } catch (error) {
      attempts.push(`clipboard read after copy unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (capturedText && originalClipboard !== null && capturedText === cleanSelectedText(originalClipboard)) {
    attempts.push("clipboard read after copy matched prior clipboard; rejected as stale clipboard text");
    capturedText = "";
  }
  if (containsExtensionUiPhrase(capturedText)) {
    devLog("discarded copy-event text containing extension UI phrase", capturedText);
    attempts.push("copy-event text rejected: extension UI phrase detected");
    capturedText = "";
  }
  if (originalClipboard !== null && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(originalClipboard);
      restoredClipboard = true;
      clipboardRestoreNote = "clipboard restored after copy extraction";
    } catch (error) {
      clipboardRestoreNote = `clipboard restore unavailable: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  devLog("copy extraction clipboard note", { restoredClipboard, clipboardRestoreNote });
  return {
    text: capturedText,
    method: "Google Docs copy-event fallback",
    detail: [...attempts, clipboardRestoreNote].join("; "),
  };
}

function getCurrentGoogleDocsSelectionSnapshot(extraAttempts: string[] = []): SelectionSnapshot {
  const attempts = [...extraAttempts];
  const steps: Array<() => ExtractionResult> = [
    () => ({ text: getWindowSelectionText(), method: "window.getSelection()", detail: "window.getSelection()" }),
    () => ({ text: getGoogleDocsSelectedLineText(), method: "Google Docs .kix-selection-overlay", detail: ".kix-selection-overlay + selected line/word rectangles" }),
    () => ({ text: getGoogleDocsEditorDomText(), method: "Google Docs DOM fallback", detail: ".kix-canvas-tile-content/.kix-lineview/.kix-wordhtmlgenerator-word-node/textarea/role textbox" }),
    () => ({ text: getTextInputSelectionText(), method: "Google Docs textarea/input", detail: "active textarea/input selection" }),
    () => ({ text: getFocusedEditableProxyText(), method: "Google Docs focused editable proxy", detail: "focused editable proxy element" }),
  ];

  for (const step of steps) {
    const result = step();
    const text = cleanSelectedText(result.text);
    attempts.push(`${result.detail}: ${text ? `success (${text.length} chars)` : "empty"}`);
    if (text) {
      return validateSnapshot(filledSnapshot(text, result.method, attempts));
    }
  }

  const snapshot = emptySnapshot("Google Docs blocked automatic selection reading. Paste the selected text here.", "Google Docs automatic extraction");
  snapshot.extractionAttempts = attempts;
  return snapshot;
}

function isValidRecentSelectionSnapshot(selectionSnapshot: SelectionSnapshot | null): selectionSnapshot is SelectionSnapshot {
  if (!selectionSnapshot?.text || !selectionSnapshot.capturedAt) {
    return false;
  }
  const cacheAge = Date.now() - selectionSnapshot.capturedAt;
  const expectedFingerprint = selectionFingerprint(selectionSnapshot.text, currentDocumentUrl(), selectionSnapshot.capturedAt);
  return (
    selectionSnapshot.source === "google-docs" &&
    selectionSnapshot.documentUrl === currentDocumentUrl() &&
    selectionSnapshot.normalizedText === normalizedSelectionText(selectionSnapshot.text) &&
    selectionSnapshot.fingerprint === expectedFingerprint &&
    cacheAge <= RECENT_SELECTION_MS &&
    isReasonableSelectedText(selectionSnapshot.text)
  );
}

function getCachedSelectionSnapshot(previousRequestText = ""): SelectionSnapshot {
  const candidates = [cachedSelection, pendingSelection]
    .filter(isValidRecentSelectionSnapshot)
    .sort((a, b) => (b.capturedAt ?? 0) - (a.capturedAt ?? 0));
  const freshestSelection = candidates[0];
  if (
    freshestSelection
  ) {
    cachedSelection = freshestSelection;
    pendingSelection = null;
    const cacheAge = cachedSelection.capturedAt ? Date.now() - cachedSelection.capturedAt : Number.POSITIVE_INFINITY;
    devLog("selectedText cache used", { text: cachedSelection.text, cacheAge, fingerprint: cachedSelection.fingerprint });
    return cachedSelection;
  }

  const cacheAge = cachedSelection.capturedAt ? Date.now() - cachedSelection.capturedAt : Number.POSITIVE_INFINITY;
  const expectedFingerprint = selectionFingerprint(cachedSelection.text, currentDocumentUrl(), cachedSelection.capturedAt);
  devLog("selectedText cache rejected", {
    previousSelectedText: cachedSelection.text,
    cacheAge,
    previousRequestText,
    reason: cachedSelection.documentUrl !== currentDocumentUrl() ? "document URL changed" : cachedSelection.fingerprint !== expectedFingerprint ? "fingerprint mismatch" : "cache expired or invalid",
  });
  return emptySnapshot("Google Docs blocked automatic selection reading. Paste the selected text here.", "Google Docs fallback");
}

function rememberSelection(selectionSnapshot: SelectionSnapshot): SelectionSnapshot {
  const validatedSnapshot = validateSnapshot(selectionSnapshot);
  if (validatedSnapshot.text) {
    cachedSelection = validatedSnapshot;
    devLog("selectedText captured in content script", { text: cachedSelection.text, method: cachedSelection.method, fingerprint: cachedSelection.fingerprint });
    return cachedSelection;
  }

  return validatedSnapshot;
}

async function getBestSelectionSnapshot(allowRecentCache: boolean, allowCopyFallback: boolean, previousRequestText = ""): Promise<SelectionSnapshot> {
  if (allowRecentCache) {
    const cached = getCachedSelectionSnapshot(previousRequestText);
    if (cached.text) {
      devLog("selectedText request resolved from cached Google Docs selection", { text: cached.text, method: cached.method });
      return cached;
    }
  }

  const retryDelays = allowRecentCache ? [0, 150, 400] : [0];
  let currentSelection = emptySnapshot("Google Docs automatic extraction has not run yet.", "Google Docs automatic extraction");
  for (const delay of retryDelays) {
    if (delay > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, delay));
    }
    currentSelection = rememberSelection(getCurrentGoogleDocsSelectionSnapshot(currentSelection.extractionAttempts));
    if (currentSelection.text) {
      return currentSelection;
    }
    const cachedAfterRetry = getCachedSelectionSnapshot(previousRequestText);
    if (cachedAfterRetry.text) {
      devLog("selectedText request resolved from cached Google Docs selection after retry", { text: cachedAfterRetry.text, method: cachedAfterRetry.method });
      return cachedAfterRetry;
    }
  }

  if (!allowRecentCache) {
    return currentSelection;
  }

  if (allowCopyFallback) {
    const copyResult = await clipboardCopyFallback();
    const copyAttempts = [...currentSelection.extractionAttempts, copyResult.detail];
    const copyText = cleanSelectedText(copyResult.text);
    if (copyText) {
      return rememberSelection(validateSnapshot(filledSnapshot(copyText, copyResult.method, copyAttempts)));
    }
    const cachedAfterCopy = getCachedSelectionSnapshot(previousRequestText);
    if (cachedAfterCopy.text) {
      devLog("selectedText request resolved from cached Google Docs selection after copy fallback", { text: cachedAfterCopy.text, method: cachedAfterCopy.method });
      return cachedAfterCopy;
    }
    const emptyCopySnapshot = emptySnapshot("Google Docs blocked automatic selection reading. Paste the selected text here.", copyResult.method);
    emptyCopySnapshot.extractionAttempts = copyAttempts;
    return emptyCopySnapshot;
  }

  return getCachedSelectionSnapshot(previousRequestText);
}

function getBestSelectionSnapshotSync(allowRecentCache: boolean): SelectionSnapshot {
  const currentSelection = rememberSelection(getCurrentGoogleDocsSelectionSnapshot());
  if (currentSelection.text || !allowRecentCache) {
    return currentSelection;
  }
  return getCachedSelectionSnapshot();
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

function dispatchSelectionChanged(selectionSnapshot: SelectionSnapshot): void {
  const message: SelectionChangedMessage = { type: "SELECTION_CHANGED", snapshot: selectionSnapshot };
  window.dispatchEvent(new CustomEvent("acc-selection-changed", { detail: message }));
}

function dispatchSelectionResponse(requestId: string, selectionSnapshot: SelectionSnapshot): void {
  const message: SelectionResponseMessage = { type: "SELECTION_RESPONSE", requestId, snapshot: selectionSnapshot };
  window.dispatchEvent(new CustomEvent("acc-selection-response", { detail: message }));
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

  createRoot(mountNode).render(<App initialSelection={getBestSelectionSnapshotSync(false)} onInsertCitation={attemptInsertCitation} />);
}

function watchSelection(): void {
  let lastSelection = getBestSelectionSnapshotSync(false);
  let selectionDebounceId: number | null = null;
  dispatchSelectionChanged(lastSelection);

  const capturePendingSelection = (trigger: string) => {
    const currentUrl = currentDocumentUrl();
    if (currentUrl !== lastDocumentUrl) {
      lastDocumentUrl = currentUrl;
      lastSelection = clearCachedSelection("Google Docs document URL changed.");
      dispatchSelectionChanged(lastSelection);
      return;
    }

    const candidate = validateSnapshot(getCurrentGoogleDocsSelectionSnapshot([`${trigger}: event-driven capture`]));
    if (candidate.text) {
      pendingSelection = candidate;
      devLog("pending Google Docs selection captured before sidebar focus can clear it", { text: candidate.text, method: candidate.method, trigger });
    }
  };

  const updateSelection = () => {
    if (isValidRecentSelectionSnapshot(pendingSelection)) {
      const nextSelection = rememberSelection(pendingSelection);
      pendingSelection = null;
      if (nextSelection.text !== lastSelection.text || nextSelection.method !== lastSelection.method || nextSelection.emptyReason !== lastSelection.emptyReason) {
        lastSelection = nextSelection;
        dispatchSelectionChanged(nextSelection);
      }
      return;
    }

    if (sidebarHasFocusOrSelection()) {
      devLog("sidebar focus did not clear cached Google Docs selection", cachedSelection.text ? "cached selection preserved" : "no cached selection");
      return;
    }

    const currentUrl = currentDocumentUrl();
    if (currentUrl !== lastDocumentUrl) {
      lastDocumentUrl = currentUrl;
      lastSelection = clearCachedSelection("Google Docs document URL changed.");
      dispatchSelectionChanged(lastSelection);
      return;
    }

    const nextSelection = getBestSelectionSnapshotSync(false);
    if (nextSelection.text !== lastSelection.text || nextSelection.method !== lastSelection.method || nextSelection.emptyReason !== lastSelection.emptyReason) {
      lastSelection = nextSelection;
      dispatchSelectionChanged(nextSelection);
    }
  };

  const debounceSelectionUpdate = (trigger: string, delay = 180) => {
    capturePendingSelection(trigger);
    if (selectionDebounceId !== null) {
      window.clearTimeout(selectionDebounceId);
    }
    selectionDebounceId = window.setTimeout(() => {
      selectionDebounceId = null;
      updateSelection();
    }, delay);
  };

  document.addEventListener("selectionchange", () => debounceSelectionUpdate("selectionchange", 180));
  document.addEventListener("mouseup", (event) => {
    if (!eventBelongsToSidebar(event)) {
      debounceSelectionUpdate("mouseup", 180);
    }
  });
  document.addEventListener("keyup", (event) => {
    if (!eventBelongsToSidebar(event)) {
      debounceSelectionUpdate("keyup", 180);
    }
  });
  document.addEventListener("focus", (event) => {
    if (!eventBelongsToSidebar(event)) {
      debounceSelectionUpdate("focus", 180);
    } else {
      devLog("sidebar focus did not clear cached Google Docs selection", cachedSelection.text ? "cached selection preserved" : "no cached selection");
    }
  }, true);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      debounceSelectionUpdate("visibilitychange", 180);
    }
  });
  document.addEventListener("input", (event) => {
    if (eventBelongsToSidebar(event)) {
      devLog("sidebar input did not clear cached Google Docs selection");
      return;
    }
    lastSelection = clearCachedSelection("Google Docs document content changed.");
    dispatchSelectionChanged(lastSelection);
  }, true);
  document.addEventListener("beforeinput", (event) => {
    if (eventBelongsToSidebar(event)) {
      devLog("sidebar beforeinput did not clear cached Google Docs selection");
      return;
    }
    lastSelection = clearCachedSelection("Google Docs document content is changing.");
    dispatchSelectionChanged(lastSelection);
  }, true);
  document.addEventListener("cut", (event) => {
    if (eventBelongsToSidebar(event)) {
      devLog("sidebar cut did not clear cached Google Docs selection");
      return;
    }
    lastSelection = clearCachedSelection("Google Docs document content was cut.");
    dispatchSelectionChanged(lastSelection);
  }, true);
  document.addEventListener("paste", (event) => {
    if (eventBelongsToSidebar(event)) {
      devLog("sidebar paste did not clear cached Google Docs selection");
      return;
    }
    lastSelection = clearCachedSelection("Google Docs document content was pasted.");
    dispatchSelectionChanged(lastSelection);
  }, true);
  document.addEventListener("keydown", (event) => {
    if (!eventBelongsToSidebar(event) && (event.key === "Backspace" || event.key === "Delete" || event.key.length === 1)) {
      lastSelection = clearCachedSelection("Google Docs document content may have changed.");
      dispatchSelectionChanged(lastSelection);
    }
  }, true);
  window.addEventListener("beforeunload", () => {
    clearCachedSelection("Google Docs document unloaded.");
  });
  window.setInterval(updateSelection, 1000);
}

chrome.runtime.onMessage.addListener((message: InsertCitationMessage, _sender, sendResponse) => {
  if (message.type !== "INSERT_CITATION") {
    return false;
  }
  attemptInsertCitation(message.citation).then((inserted) => sendResponse({ inserted })).catch(() => sendResponse({ inserted: false }));
  return true;
});

window.addEventListener("acc-selection-requested", (event: Event) => {
  const customEvent = event as CustomEvent<SelectionRequestedMessage>;
  if (customEvent.detail.type !== "SELECTION_REQUESTED") {
    return;
  }

  getBestSelectionSnapshot(true, Boolean(customEvent.detail.allowCopyFallback), customEvent.detail.previousRequestText ?? "").then((selectionSnapshot) => {
    dispatchSelectionChanged(selectionSnapshot);
    dispatchSelectionResponse(customEvent.detail.requestId, selectionSnapshot);
  });
});

mountSidebar();
watchSelection();
