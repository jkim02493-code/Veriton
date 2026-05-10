import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const content = readFileSync(resolve(root, "src/content/index.tsx"), "utf8");
const app = readFileSync(resolve(root, "src/sidebar/App.tsx"), "utf8");
const api = readFileSync(resolve(root, "src/services/api.ts"), "utf8");

const failures = [];

if (!content.includes("getCopyEventSelectionText")) {
  failures.push("content script must include the Google Docs copy-event selection fallback");
}

if (!content.includes("document.execCommand(\"copy\")")) {
  failures.push("content script must attempt controlled copy extraction when DOM selection is blocked");
}

if (content.includes("fetch(")) {
  failures.push("content script must not call fetch directly");
}

if (app.includes("Backend health check failed")) {
  failures.push("sidebar/content bundle must not console-log backend health failures");
}

if (!api.includes("chrome.runtime.sendMessage")) {
  failures.push("API client must communicate with the background service worker");
}

if (!content.includes('source: "google-docs"')) {
  failures.push("selection snapshots must carry Google Docs provenance");
}

if (!app.includes("const latestSelection = await requestLatestSelection();")) {
  failures.push("Find Evidence must request the current selection before sending a payload");
}

if (app.includes("selectedText.trim() ? selection : await requestLatestSelection()")) {
  failures.push("Find Evidence must not prefer existing sidebar state over a fresh selection request");
}

if (!app.includes("isUsableGoogleDocsSelection(latestSelection)")) {
  failures.push("Find Evidence must validate the current Google Docs selection before API submission");
}

if (!content.includes("const RECENT_SELECTION_MS = 5_000")) {
  failures.push("content selection cache must expire within 3-5 seconds");
}

if (!content.includes("const retryDelays = allowRecentCache ? [0, 150, 400] : [0]")) {
  failures.push("content selection requests must retry immediately, after 150ms, and after 400ms before copy/paste fallback");
}

if (!content.includes("getCopyEventSelectionText") || content.indexOf("getCopyEventSelectionText") > content.indexOf("emptyCopySnapshot")) {
  failures.push("copy-event extraction must run before the empty paste-fallback snapshot is returned");
}

if (!content.includes("selectionFingerprint")) {
  failures.push("content selection cache must use a normalized text/document/timestamp fingerprint");
}

if (content.includes('window.addEventListener("blur"') || content.includes("Google Docs tab lost focus.")) {
  failures.push("sidebar/browser focus changes must not clear the cached Google Docs selection");
}

if (content.indexOf("const cached = getCachedSelectionSnapshot") > content.indexOf("const retryDelays = allowRecentCache ? [0, 150, 400] : [0]")) {
  failures.push("Find Evidence must check the latest valid cached Google Docs selection before fresh extraction retries");
}

if (!content.includes('document.addEventListener("focus"') || !content.includes('document.addEventListener("visibilitychange"')) {
  failures.push("content script must capture selection on focus and visibilitychange events");
}

if (!content.includes("let pendingSelection: SelectionSnapshot | null = null") || !content.includes("capturePendingSelection") || !content.includes("pending Google Docs selection captured before sidebar focus can clear it")) {
  failures.push("content script must preserve a pending event-driven Google Docs selection before sidebar focus can erase window selection");
}

if (!content.includes("isValidRecentSelectionSnapshot(pendingSelection)") || !content.includes("selectedText request resolved from cached Google Docs selection after retry") || !content.includes("selectedText request resolved from cached Google Docs selection after copy fallback")) {
  failures.push("Find Evidence must retry the cached/pending selection before showing paste fallback");
}

if (!content.includes("sidebar input did not clear cached Google Docs selection") || !content.includes("sidebar beforeinput did not clear cached Google Docs selection")) {
  failures.push("sidebar interactions must not clear cached Google Docs selections");
}

if (!content.includes('const EXTENSION_ROOT_ATTR = "data-veriton-extension-root"') || !content.includes('host.setAttribute(EXTENSION_ROOT_ATTR, "true")')) {
  failures.push("content script must mark the injected sidebar with data-veriton-extension-root before extraction");
}

if (!content.includes("currentSelectionHasGoogleDocsBoundary") || !content.includes("nodeBelongsToGoogleDocsEditor")) {
  failures.push("content script must require selection anchors to be inside the Google Docs editor");
}

if (!content.includes("containsExtensionUiPhrase") || !content.includes("find credible evidence")) {
  failures.push("content script must discard selected text containing known extension UI phrases");
}

if (content.includes('"academic citation copilot"')) {
  failures.push("content extractor phrase guard must not reject the app brand title while rendering or extracting");
}

if (!app.includes('"academic citation copilot"')) {
  failures.push("sidebar request payload guard must reject Academic Citation Copilot only when it is selectedText/query payload");
}

if (!app.includes("Actual backend URL called") || !app.includes("Request payload selectedText") || !app.includes("HTTP status or fetch exception") || !app.includes("Request body") || !app.includes("Response body or exception")) {
  failures.push("debug panel must include backend URL, HTTP status/error, selectedText payload, request body, and response body/exception");
}

if (!app.includes("Latest cached selection preview") || !app.includes("Age of cached selection") || !app.includes("Sidebar focus triggered selection clear") || !app.includes("Current request extraction method")) {
  failures.push("debug panel must include persistent cached-selection diagnostics");
}

if (!api.includes("BackendRequestError")) {
  failures.push("API client must preserve backend /evidence validation details instead of throwing generic errors");
}

if (!app.includes("Show demo sources instead") || !app.includes("Demo sources — not live results.") || !app.includes('response.error === "live_providers_unavailable"')) {
  failures.push("sidebar must show an explicit demo fallback button and label only after all live providers fail");
}

if (!app.includes("demoMode = false") || !app.includes("demoMode: true") && !app.includes("demoMode }")) {
  failures.push("sidebar must opt into demo sources explicitly instead of loading them automatically");
}

if (!app.includes("setCards([])") || !app.includes("setSearchFocus(null)")) {
  failures.push("sidebar must clear stale cards and search focus when selection changes or a new request starts");
}

if (app.includes("resolve(selection);")) {
  failures.push("selection request timeout must not fall back to stale sidebar selection");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Selection payload guard passed");
