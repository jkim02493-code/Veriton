import { useEffect, useRef, useState } from "react";
import type { CitationStyle, EvidenceCard as EvidenceCardType, RecencyPreference } from "../../../shared/types";
import { EvidenceCard } from "../components/EvidenceCard";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { ToastStack } from "../components/ToastStack";
import { useToasts } from "../hooks/useToasts";
import { API_BASE_URL, BackendRequestError, findEvidence, getHealth } from "../services/api";
import type { SelectionChangedMessage, SelectionRequestedMessage, SelectionResponseMessage, SelectionSnapshot } from "../types/messages";
import { isReasonableSelectedText } from "../utils/selectionValidation";

interface Props {
  initialSelection: SelectionSnapshot;
  onInsertCitation: (citation: string) => Promise<boolean>;
}

const emptySelection: SelectionSnapshot = {
  text: "",
  normalizedText: "",
  method: "not loaded",
  emptyReason: "Waiting for content script.",
  capturedAt: null,
  documentUrl: "",
  source: "none",
  fingerprint: "",
  extractionAttempts: [],
};

const SELECTION_FRESHNESS_MS = 5_000;
const BLOCKED_SELECTED_TEXT_PHRASES = [
  "academic citation copilot",
  "find credible evidence",
  "selected google docs text only",
  "find evidence",
  "no strong evidence found",
];

function devLog(message: string, value?: unknown): void {
  if (import.meta.env.DEV) {
    console.info(`[ACC sidebar] ${message}`, value ?? "");
  }
}

function isUsableGoogleDocsSelection(selection: SelectionSnapshot): boolean {
  return (
    selection.source === "google-docs" &&
    Boolean(selection.capturedAt) &&
    Date.now() - Number(selection.capturedAt) <= SELECTION_FRESHNESS_MS &&
    selection.normalizedText === normalizeSelectedText(selection.text) &&
    isReasonableSelectedText(selection.text)
  );
}

function normalizeSelectedText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function containsBlockedSelectedTextPhrase(text: string): boolean {
  const normalized = normalizeSelectedText(text);
  return BLOCKED_SELECTED_TEXT_PHRASES.some((phrase) => normalized.includes(phrase));
}

export function App({ initialSelection, onInsertCitation }: Props) {
  const [selection, setSelection] = useState<SelectionSnapshot>(initialSelection ?? emptySelection);
  const selectionRef = useRef<SelectionSnapshot>(initialSelection ?? emptySelection);
  const selectedText = selection.text;
  const [citationStyle, setCitationStyle] = useState<CitationStyle>("APA");
  const [recencyPreference, setRecencyPreference] = useState<RecencyPreference>("balanced");
  const [cards, setCards] = useState<EvidenceCardType[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [searchFocus, setSearchFocus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugMessages, setDebugMessages] = useState<string[]>([]);
  const [showDebugDetails, setShowDebugDetails] = useState(false);
  const [backendHealthResult, setBackendHealthResult] = useState("Not checked yet");
  const [apiRequestStatus, setApiRequestStatus] = useState("No request yet");
  const [actualBackendUrl, setActualBackendUrl] = useState("No request yet");
  const [lastHttpStatus, setLastHttpStatus] = useState("No request yet");
  const [lastSelectedTextPayload, setLastSelectedTextPayload] = useState("No request yet");
  const [lastRequestBody, setLastRequestBody] = useState("No request yet");
  const [lastResponseBody, setLastResponseBody] = useState("No request yet");
  const [showPasteFallback, setShowPasteFallback] = useState(false);
  const [manualSelectedText, setManualSelectedText] = useState("");
  const [lastRequestText, setLastRequestText] = useState("");
  const [refinedClaimText, setRefinedClaimText] = useState("");
  const [canShowDemoSources, setCanShowDemoSources] = useState(false);
  const [demoSourcesActive, setDemoSourcesActive] = useState(false);
  const [currentRequestExtractionMethod, setCurrentRequestExtractionMethod] = useState("No request yet");
  const sidebarFocusClearedSelection = "no";
  const { toasts, showToast } = useToasts();

  function addDebugMessage(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    setDebugMessages((current) => [`${timestamp} ${message}`, ...current].slice(0, 8));
  }

  useEffect(() => {
    addDebugMessage(`Initial selected text captured: ${initialSelection.text.length} characters via ${initialSelection.method}`);
  }, [initialSelection]);

  useEffect(() => {
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent<{ message: string; backendUrl?: string; httpStatus?: number | string; selectedTextPayload?: string; requestBody?: string; responseBody?: unknown }>;
      if (customEvent.detail.message.includes("health")) {
        setBackendHealthResult(customEvent.detail.message);
      }
      if (customEvent.detail.message.includes("Evidence request") || customEvent.detail.message.includes("API request")) {
        setApiRequestStatus(customEvent.detail.message);
      }
      if (customEvent.detail.backendUrl) {
        setActualBackendUrl(customEvent.detail.backendUrl);
      }
      if (customEvent.detail.httpStatus !== undefined) {
        setLastHttpStatus(String(customEvent.detail.httpStatus));
      }
      if (customEvent.detail.selectedTextPayload !== undefined) {
        setLastSelectedTextPayload(customEvent.detail.selectedTextPayload);
      }
      if (customEvent.detail.requestBody !== undefined) {
        setLastRequestBody(customEvent.detail.requestBody);
      }
      if (customEvent.detail.responseBody !== undefined) {
        setLastResponseBody(typeof customEvent.detail.responseBody === "string" ? customEvent.detail.responseBody : JSON.stringify(customEvent.detail.responseBody));
      }
      addDebugMessage(customEvent.detail.message);
    };
    window.addEventListener("acc-api-debug", listener);
    return () => window.removeEventListener("acc-api-debug", listener);
  }, []);

  useEffect(() => {
    addDebugMessage(`Checking backend at ${API_BASE_URL}/health`);
    getHealth()
      .then((response) => {
        setBackendHealthResult(`Backend health OK: ${response.status}`);
        addDebugMessage(`Backend connection success: ${response.status}`);
        showToast("Backend connection ready.", "success");
      })
      .catch((technicalError: unknown) => {
        setBackendHealthResult(`Backend health failed: ${technicalError instanceof Error ? technicalError.message : String(technicalError)}`);
        addDebugMessage(`Backend health fetch failed: ${technicalError instanceof Error ? technicalError.message : String(technicalError)}`);
      });
  }, [showToast]);

  useEffect(() => {
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent<SelectionChangedMessage>;
      if (customEvent.detail.type === "SELECTION_CHANGED") {
        const nextSelection = customEvent.detail.snapshot;
        const previousSelection = selectionRef.current;
        const previousNormalized = normalizeSelectedText(previousSelection.text);
        const nextNormalized = normalizeSelectedText(nextSelection.text);
        if (previousNormalized !== nextNormalized || !nextNormalized) {
          setCards([]);
          setWarnings([]);
          setSearchFocus(null);
          setCanShowDemoSources(false);
          setDemoSourcesActive(false);
          setError(null);
          setApiRequestStatus(nextNormalized ? "Selection changed; previous results cleared" : "Selection empty; previous results cleared");
          addDebugMessage(`Previous results cleared after selection change: "${previousSelection.text.slice(0, 80)}" -> "${nextSelection.text.slice(0, 80)}"`);
        }
        selectionRef.current = nextSelection;
        setSelection(nextSelection);
        devLog("selectedText received by sidebar", nextSelection.text);
        addDebugMessage(`Selected text captured: ${nextSelection.text.length} characters via ${nextSelection.method}`);
      }
    };
    window.addEventListener("acc-selection-changed", listener);
    return () => window.removeEventListener("acc-selection-changed", listener);
  }, []);

  function requestLatestSelection(): Promise<SelectionSnapshot> {
    return new Promise((resolve) => {
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const timeoutId = window.setTimeout(() => {
        window.removeEventListener("acc-selection-response", listener);
        devLog("selection request timed out; stale sidebar selection rejected", selection.text);
        resolve({ ...emptySelection, emptyReason: "Timed out while refreshing the active Google Docs selection.", method: "request timeout" });
      }, 700);
      const listener = (event: Event) => {
        const customEvent = event as CustomEvent<SelectionResponseMessage>;
        if (customEvent.detail.type !== "SELECTION_RESPONSE" || customEvent.detail.requestId !== requestId) {
          return;
        }

        window.clearTimeout(timeoutId);
        window.removeEventListener("acc-selection-response", listener);
        selectionRef.current = customEvent.detail.snapshot;
        setSelection(customEvent.detail.snapshot);
        resolve(customEvent.detail.snapshot);
      };

      const message: SelectionRequestedMessage = { type: "SELECTION_REQUESTED", requestId, allowCopyFallback: true, previousRequestText: lastRequestText };
      window.addEventListener("acc-selection-response", listener);
      window.dispatchEvent(new CustomEvent("acc-selection-requested", { detail: message }));
    });
  }

  async function submitEvidenceText(evidenceText: string, sourceLabel: string, preference = recencyPreference, demoMode = false) {
    const textForEvidence = evidenceText.trim();
    if (!isReasonableSelectedText(textForEvidence)) {
      addDebugMessage(`${sourceLabel} blocked: invalid selected text`);
      setShowPasteFallback(true);
      showToast("Paste the selected Google Docs text to continue.", "info");
      return;
    }
    if (containsBlockedSelectedTextPhrase(textForEvidence)) {
      addDebugMessage(`${sourceLabel} blocked: selectedText contained extension UI text`);
      setShowPasteFallback(true);
      showToast("Paste the selected Google Docs text to continue.", "info");
      return;
    }
    setIsLoading(true);
    setError(null);
    setWarnings([]);
    setCards([]);
    setSearchFocus(null);
    setCanShowDemoSources(false);
    setDemoSourcesActive(false);
    setShowPasteFallback(false);
    try {
      setApiRequestStatus("Evidence request in progress");
      setCurrentRequestExtractionMethod(sourceLabel);
      devLog("selectedText at request build", { selectedText: textForEvidence, sourceLabel });
      addDebugMessage(`Submitting evidence request from ${sourceLabel}: ${textForEvidence.length} characters`);
      setLastRequestText(textForEvidence);
      const response = await findEvidence({ text: textForEvidence, citationStyle, recencyPreference: preference, demoMode });
      setApiRequestStatus("Evidence request OK");
      devLog("resulting searchFocus", response.searchFocus ?? null);
      addDebugMessage(`Evidence response received: ${response.cards.length} cards`);
      setCards(response.cards);
      setWarnings(response.warnings);
      setSearchFocus(response.searchFocus ?? null);
      setCanShowDemoSources(response.error === "live_providers_unavailable" && response.retry === true);
      setDemoSourcesActive(response.demoMode === true);
      if (response.warnings.some((warning) => warning.includes("Your selection is ambiguous"))) {
        setRefinedClaimText(textForEvidence);
      }
      if (response.cards.length === 0) {
        showToast("No strong evidence found. Try rephrasing your claim.", "info");
      } else {
        showToast("Evidence ready.", "success");
      }
    } catch (technicalError) {
      console.error("Evidence request failed", technicalError);
      setApiRequestStatus(`Evidence request failed: ${technicalError instanceof Error ? technicalError.message : String(technicalError)}`);
      addDebugMessage(`Evidence fetch failed: ${technicalError instanceof Error ? technicalError.message : String(technicalError)}`);
      if (technicalError instanceof BackendRequestError) {
        if (technicalError.backendUrl) {
          setActualBackendUrl(technicalError.backendUrl);
        }
        if (technicalError.httpStatus !== undefined) {
          setLastHttpStatus(String(technicalError.httpStatus));
        }
        if (technicalError.requestBody) {
          setLastRequestBody(technicalError.requestBody);
        }
        if (technicalError.responseBody !== undefined) {
          setLastResponseBody(typeof technicalError.responseBody === "string" ? technicalError.responseBody : JSON.stringify(technicalError.responseBody));
        }
        setError(`Evidence request failed: ${technicalError.message}`);
      } else {
        setError(`Evidence request failed: ${technicalError instanceof Error ? technicalError.message : String(technicalError)}`);
      }
      showToast("Evidence request failed.", "error");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFindEvidence() {
    const previousSelectedText = selection.text;
    setCards([]);
    setWarnings([]);
    setSearchFocus(null);
    setCanShowDemoSources(false);
    setDemoSourcesActive(false);
    setError(null);
    setApiRequestStatus("Refreshing Google Docs selection");
    const latestSelection = await requestLatestSelection();
    const evidenceText = latestSelection.text.trim();
    devLog("fresh selection for Find Evidence", {
      previousSelectedText,
      selectedText: evidenceText,
      cacheDecision: latestSelection.method.includes("fallback") ? "cache rejected or automatic extraction failed" : "fresh extraction used",
      fingerprint: latestSelection.fingerprint,
    });
    addDebugMessage(`Request selection refreshed: previous ${previousSelectedText.length} chars, current ${evidenceText.length} chars`);

    if (!isUsableGoogleDocsSelection(latestSelection)) {
      addDebugMessage(`Automatic extraction blocked: ${latestSelection.emptyReason || "invalid selected text"}`);
      setShowPasteFallback(true);
      showToast("Paste the selected Google Docs text to continue.", "info");
      return;
    }

    setCurrentRequestExtractionMethod(latestSelection.method);
    await submitEvidenceText(evidenceText, latestSelection.method);
  }

  async function usePastedText() {
    const pastedText = manualSelectedText.trim();
    const capturedAt = Date.now();
    const manualSelection: SelectionSnapshot = {
      text: pastedText,
      method: "manual paste fallback",
      emptyReason: "",
      capturedAt,
      documentUrl: selection.documentUrl,
      source: "google-docs",
      normalizedText: normalizeSelectedText(pastedText),
      fingerprint: `${normalizeSelectedText(pastedText)}|${selection.documentUrl}|${capturedAt}`,
      extractionAttempts: [...selection.extractionAttempts, `manual paste fallback: ${pastedText ? `success (${pastedText.length} chars)` : "empty"}`],
    };
    selectionRef.current = manualSelection;
    setSelection(manualSelection);
    await submitEvidenceText(pastedText, "manual paste fallback");
  }

  async function showDemoSources() {
    const fallbackText = lastRequestText || selectedText || manualSelectedText;
    await submitEvidenceText(fallbackText, "demo fallback", recencyPreference, true);
  }

  async function copyCitation(citation: string) {
    await navigator.clipboard.writeText(citation);
    showToast("Citation copied.", "success");
  }

  async function insertCitation(citation: string) {
    const inserted = await onInsertCitation(citation);
    if (inserted) {
      showToast("Citation inserted.", "success");
      return;
    }
    await navigator.clipboard.writeText(citation);
    showToast("Citation copied. Paste into your document.", "info");
  }

  return (
    <div className="acc-root fixed right-4 top-20 z-[2147483646] h-[calc(100vh-6rem)] w-[420px] overflow-hidden rounded-3xl border border-slate-200 bg-slate-100/95 text-slate-950 shadow-2xl backdrop-blur">
      <ToastStack toasts={toasts} />
      <div className="flex h-full flex-col">
        <header className="border-b border-slate-200 bg-white px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Academic Citation Copilot</p>
          <h1 className="mt-1 text-lg font-semibold text-slate-950">Find credible evidence</h1>
          <p className="mt-1 text-xs leading-5 text-slate-600">Selected Google Docs text only. No whole-document scraping.</p>
        </header>
        <main className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">Selected text</h2>
              <div className="flex gap-2">
                <select className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800" value={recencyPreference} onChange={(event) => {
                  const nextPreference = event.target.value as RecencyPreference;
                  setRecencyPreference(nextPreference);
                  if (selectedText.trim()) {
                    void submitEvidenceText(selectedText, "recency filter", nextPreference);
                  }
                }}>
                  <option value="balanced">Balanced</option>
                  <option value="recent">Recent</option>
                  <option value="foundational">Foundational</option>
                </select>
                <select className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800" value={citationStyle} onChange={(event) => setCitationStyle(event.target.value as CitationStyle)}>
                  <option value="APA">APA</option>
                  <option value="MLA">MLA</option>
                </select>
              </div>
            </div>
            <p className="mt-3 max-h-28 overflow-y-auto rounded-xl bg-slate-50 p-3 text-sm leading-5 text-slate-700">{selectedText || "Highlight a claim in Google Docs, then click Find Evidence."}</p>
            <button className="mt-4 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400" onClick={handleFindEvidence} disabled={isLoading}>Find Evidence</button>
            {showPasteFallback ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <label className="text-xs font-semibold text-amber-950" htmlFor="acc-manual-selection">Google Docs blocked automatic selection reading. Paste the selected text here.</label>
                <textarea
                  id="acc-manual-selection"
                  className="mt-2 h-24 w-full resize-none rounded-lg border border-amber-200 bg-white p-2 text-sm text-slate-900 outline-none focus:border-amber-500"
                  value={manualSelectedText}
                  onChange={(event) => setManualSelectedText(event.target.value)}
                />
                <button className="mt-2 w-full rounded-lg bg-amber-950 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-900 disabled:cursor-not-allowed disabled:bg-amber-300" type="button" onClick={usePastedText} disabled={isLoading || manualSelectedText.trim().length === 0}>Use pasted text</button>
              </div>
            ) : null}
          </section>
          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
          {warnings.map((warning) => <div key={warning} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{warning}</div>)}
          {canShowDemoSources ? (
            <button className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50" type="button" onClick={showDemoSources} disabled={isLoading}>Show demo sources instead</button>
          ) : null}
          {demoSourcesActive ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Demo sources — not live results.</div> : null}
          {warnings.some((warning) => warning.includes("Your selection is ambiguous")) ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <label className="text-xs font-semibold text-amber-950" htmlFor="acc-refined-claim">Your selection is ambiguous. What is the main claim you want to support?</label>
              <textarea
                id="acc-refined-claim"
                className="mt-2 h-20 w-full resize-none rounded-lg border border-amber-200 bg-white p-2 text-sm text-slate-900 outline-none focus:border-amber-500"
                value={refinedClaimText}
                onChange={(event) => setRefinedClaimText(event.target.value)}
              />
              <button className="mt-2 w-full rounded-lg bg-amber-950 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-900 disabled:cursor-not-allowed disabled:bg-amber-300" type="button" onClick={() => submitEvidenceText(refinedClaimText, "refined claim")} disabled={isLoading || refinedClaimText.trim().length === 0}>Search refined claim</button>
            </section>
          ) : null}
          {searchFocus && cards.length > 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700"><span className="font-semibold text-slate-900">Search focus:</span> {searchFocus}</div> : null}
          {isLoading ? <LoadingSkeleton /> : null}
          {!isLoading && !error && cards.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">No strong evidence found. Try rephrasing your claim.</div> : null}
          {!isLoading && cards.length > 0 ? <section className="space-y-4">{cards.map((card) => <EvidenceCard key={card.id} card={card} citationStyle={citationStyle} onCopy={copyCitation} onInsert={insertCitation} />)}</section> : null}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-700 shadow-sm">
            <button className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-900" onClick={() => setShowDebugDetails((current) => !current)} type="button">
              <span>Debug details</span>
              <span>{showDebugDetails ? "Hide" : "Show"}</span>
            </button>
            {showDebugDetails ? (
              <>
                <div className="mt-3 space-y-1 rounded-xl bg-slate-50 p-3">
                  <p><span className="font-semibold">Selected text detected:</span> {selection.text ? "yes" : "no"}</p>
                  <p><span className="font-semibold">Selected text length:</span> {selection.text.length}</p>
                  <p><span className="font-semibold">Selected text preview:</span> {selection.text ? selection.text.slice(0, 80) : "none"}</p>
                  <p><span className="font-semibold">Latest cached selection preview:</span> {selection.text ? selection.text.slice(0, 80) : "none"}</p>
                  <p><span className="font-semibold">Age of cached selection:</span> {selection.capturedAt ? `${Math.max(0, (Date.now() - selection.capturedAt) / 1000).toFixed(1)}s` : "none"}</p>
                  <p><span className="font-semibold">Sidebar focus triggered selection clear:</span> {sidebarFocusClearedSelection}</p>
                  <p><span className="font-semibold">Current request extraction method:</span> {currentRequestExtractionMethod}</p>
                  <p><span className="font-semibold">Extraction method used:</span> {selection.method}</p>
                  <p><span className="font-semibold">Extraction attempt order:</span> {selection.extractionAttempts.length > 0 ? selection.extractionAttempts.join(" -> ") : "none yet"}</p>
                  <p><span className="font-semibold">Backend health result:</span> {backendHealthResult}</p>
                  <p><span className="font-semibold">API request status:</span> {apiRequestStatus}</p>
                  <p><span className="font-semibold">Actual backend URL called:</span> {actualBackendUrl}</p>
                  <p><span className="font-semibold">HTTP status or fetch exception:</span> {lastHttpStatus}</p>
                  <p><span className="font-semibold">Request payload selectedText:</span> {lastSelectedTextPayload === "No request yet" ? lastSelectedTextPayload : lastSelectedTextPayload.slice(0, 120)}</p>
                  <p><span className="font-semibold">Request body:</span> {lastRequestBody === "No request yet" ? lastRequestBody : lastRequestBody.slice(0, 240)}</p>
                  <p><span className="font-semibold">Response body or exception:</span> {lastResponseBody === "No request yet" ? lastResponseBody : lastResponseBody.slice(0, 240)}</p>
                  <p><span className="font-semibold">Last capture timestamp:</span> {selection.capturedAt ? new Date(selection.capturedAt).toLocaleTimeString() : "none"}</p>
                </div>
                <div className="mt-3 max-h-32 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3">
                  {debugMessages.length > 0 ? debugMessages.map((message, index) => <p key={`${message}-${index}`}>{message}</p>) : <p>No connection events yet.</p>}
                </div>
              </>
            ) : null}
          </section>
        </main>
      </div>
    </div>
  );
}
