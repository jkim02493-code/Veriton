import { useEffect, useState } from "react";
import type { CitationStyle, EvidenceCard as EvidenceCardType, RecencyPreference } from "../../../shared/types";
import { EvidenceCard } from "../components/EvidenceCard";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { ToastStack } from "../components/ToastStack";
import { useToasts } from "../hooks/useToasts";
import { API_BASE_URL, BackendRequestError, findEvidence, getHealth } from "../services/api";
import type { ScanDocumentRuntimeResponse } from "../types/messages";
import type { ScannedDocument } from "../content/documentScanner";
import "../utils/queryTranslator";

interface Props {
  onInsertCitation: (citation: string) => Promise<boolean>;
}

type LanguageSelection = "auto" | "en" | "ja" | "es" | "zh";

function cardIdentity(card: EvidenceCardType): string {
  return (card.doi || card.url || card.title || card.id).trim().toLowerCase();
}

function rankEvidenceCards(cards: EvidenceCardType[]): EvidenceCardType[] {
  const tierScore = { high: 3, medium: 2, low: 1 };
  return [...cards].sort((a, b) => {
    const tierDelta = tierScore[b.sourceTier] - tierScore[a.sourceTier];
    if (tierDelta !== 0) {
      return tierDelta;
    }
    const yearDelta = Number(b.year ?? 0) - Number(a.year ?? 0);
    if (yearDelta !== 0) {
      return yearDelta;
    }
    return a.title.localeCompare(b.title);
  });
}

function dedupeEvidenceCards(cards: EvidenceCardType[]): EvidenceCardType[] {
  const seen = new Set<string>();
  const deduped: EvidenceCardType[] = [];
  for (const card of cards) {
    const identity = cardIdentity(card);
    if (identity && seen.has(identity)) {
      continue;
    }
    if (identity) {
      seen.add(identity);
    }
    deduped.push(card);
  }
  return rankEvidenceCards(deduped);
}

function scanActiveDocument(): Promise<ScannedDocument> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "SCAN_DOCUMENT_REQUESTED" }, (response: ScanDocumentRuntimeResponse | undefined) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message ?? "Document scan failed."));
        return;
      }
      if (!response?.ok || !response.payload) {
        reject(new Error(response?.error ?? "Document scan failed."));
        return;
      }
      resolve(response.payload);
    });
  });
}

export function App({ onInsertCitation }: Props) {
  const [citationStyle, setCitationStyle] = useState<CitationStyle>("APA");
  const [recencyPreference, setRecencyPreference] = useState<RecencyPreference>("balanced");
  const [scannedDocument, setScannedDocument] = useState<ScannedDocument | null>(null);
  const [manualLanguage, setManualLanguage] = useState<LanguageSelection>("auto");
  const [customKeywordInput, setCustomKeywordInput] = useState("");
  const [customKeywords, setCustomKeywords] = useState<string[]>([]);
  const [cards, setCards] = useState<EvidenceCardType[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [searchFocus, setSearchFocus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
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
  const [canShowDemoSources, setCanShowDemoSources] = useState(false);
  const [demoSourcesActive, setDemoSourcesActive] = useState(false);
  const [currentRequestExtractionMethod, setCurrentRequestExtractionMethod] = useState("No request yet");
  const { toasts, showToast } = useToasts();

  function addDebugMessage(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    setDebugMessages((current) => [`${timestamp} ${message}`, ...current].slice(0, 8));
  }

  function normalizeSearchQuery(query: string): string {
    return query.trim().replace(/\s+/g, " ");
  }

  function mergeSearchQueries(autoQueries: string[], extraQueries = customKeywords): string[] {
    const seen = new Set<string>();
    const merged: string[] = [];
    for (const query of [...autoQueries, ...extraQueries]) {
      const normalized = normalizeSearchQuery(query);
      const key = normalized.toLowerCase();
      if (!normalized || seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push(normalized);
    }
    return merged;
  }

  function effectiveLanguageFor(document = scannedDocument): string {
    return manualLanguage === "auto" ? document?.detectedLanguage ?? "en" : manualLanguage;
  }

  function originalQueriesFor(document = scannedDocument): string[] {
    if (!document) {
      return [];
    }
    return document.originalKeyPhrases?.length ? document.originalKeyPhrases : document.keyPhrases;
  }

  function translatedQueriesFor(document = scannedDocument): string[] {
    return translateQueriesToEnglish(originalQueriesFor(document), effectiveLanguageFor(document));
  }

  function queryPairsFor(document = scannedDocument): Array<{ original: string; translated: string }> {
    const originals = originalQueriesFor(document);
    const translated = translateQueriesToEnglish(originals, effectiveLanguageFor(document));
    return originals.map((original, index) => ({
      original,
      translated: translated[index] ?? original,
    }));
  }

  function allSearchQueriesFor(document = scannedDocument): string[] {
    return mergeSearchQueries(translatedQueriesFor(document));
  }

  function languageBadge(language: string | undefined): string {
    if (language === "ja") {
      return "🇯🇵 Japanese detected";
    }
    if (language === "es") {
      return "🇪🇸 Spanish detected";
    }
    if (language === "zh") {
      return "🇨🇳 Chinese detected";
    }
    return "";
  }

  function addCustomKeyword() {
    const nextKeyword = normalizeSearchQuery(customKeywordInput);
    if (!nextKeyword) {
      return;
    }
    setCustomKeywords((current) => mergeSearchQueries(current, [nextKeyword]));
    setCustomKeywordInput("");
  }

  function removeCustomKeyword(keyword: string) {
    setCustomKeywords((current) => current.filter((item) => item !== keyword));
  }

  async function searchPhrases(keyPhrases: string[], sourceLabel: string, preference = recencyPreference, demoMode = false) {
    setIsLoading(true);
    setLoadingMessage(sourceLabel === "document scan" ? "Scanning document..." : "Finding evidence...");
    setError(null);
    setWarnings([]);
    setCards([]);
    setSearchFocus(null);
    setCanShowDemoSources(false);
    setDemoSourcesActive(false);
    setCurrentRequestExtractionMethod(sourceLabel);

    try {
      setApiRequestStatus("Evidence request in progress");
      const responses = await Promise.all(keyPhrases.map((phrase) => findEvidence({ text: phrase, citationStyle, recencyPreference: preference, demoMode })));
      const combinedCards = dedupeEvidenceCards(responses.flatMap((response) => response.cards));
      const combinedWarnings = Array.from(new Set(responses.flatMap((response) => response.warnings))).filter((warning) => !warning.toLowerCase().includes("ambiguous"));
      const firstSearchFocus = responses.find((response) => response.searchFocus)?.searchFocus ?? null;

      setApiRequestStatus("Evidence request OK");
      setCards(combinedCards);
      setWarnings(combinedWarnings);
      setSearchFocus(firstSearchFocus);
      setCanShowDemoSources(responses.some((response) => response.error === "live_providers_unavailable" && response.retry === true));
      setDemoSourcesActive(responses.some((response) => response.demoMode === true));
      addDebugMessage(`Evidence response received: ${combinedCards.length} deduplicated cards from ${keyPhrases.length} search queries`);

      if (combinedCards.length === 0) {
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
      setLoadingMessage("");
    }
  }

  async function handleFindEvidence() {
    setIsLoading(true);
    setLoadingMessage("Scanning document...");
    setCards([]);
    setWarnings([]);
    setSearchFocus(null);
    setCanShowDemoSources(false);
    setDemoSourcesActive(false);
    setError(null);
    setApiRequestStatus("Scanning document");

    try {
      const scanResult = await scanActiveDocument();
      setScannedDocument(scanResult);
      const searchQueries = allSearchQueriesFor(scanResult);
      addDebugMessage(`Document scanned: ${scanResult.wordCount} words, ${searchQueries.length} search queries`);
      setIsLoading(false);
      await searchPhrases(searchQueries, "document scan");
    } catch (scanError) {
      setError(`Document scan failed: ${scanError instanceof Error ? scanError.message : String(scanError)}`);
      setApiRequestStatus("Document scan failed");
      addDebugMessage(`Document scan failed: ${scanError instanceof Error ? scanError.message : String(scanError)}`);
      showToast("Document scan failed.", "error");
      setIsLoading(false);
      setLoadingMessage("");
    }
  }

  async function showDemoSources() {
    const fallbackPhrases = scannedDocument ? allSearchQueriesFor(scannedDocument) : customKeywords;
    if (fallbackPhrases.length === 0) {
      return;
    }
    await searchPhrases(fallbackPhrases, "demo fallback", recencyPreference, true);
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
      const customEvent = event as CustomEvent<{ text?: string }>;
      const text = customEvent.detail.text?.trim();
      if (!text) {
        return;
      }
      const fallbackScan: ScannedDocument = {
        documentId: "context-menu-selection",
        fullText: text,
        keyPhrases: [text],
        originalKeyPhrases: [text],
        wordCount: text.split(/\s+/).filter(Boolean).length,
        detectedLanguage: "unknown",
      };
      setScannedDocument(fallbackScan);
      void searchPhrases(allSearchQueriesFor(fallbackScan), "context-menu selection");
    };
    window.addEventListener("acc-context-menu-selection", listener);
    return () => window.removeEventListener("acc-context-menu-selection", listener);
  }, [citationStyle, recencyPreference]);

  const scanSummary = scannedDocument
    ? `Document scanned: ${scannedDocument.wordCount} words, ${allSearchQueriesFor(scannedDocument).length} search queries ready`
    : "Click Find Evidence to automatically scan your document and retrieve academic sources.";
  const detectedLanguageBadge = languageBadge(scannedDocument?.detectedLanguage);
  const queryPairs = queryPairsFor();

  return (
    <div className="acc-root fixed right-4 top-20 z-[2147483646] h-[calc(100vh-6rem)] w-[420px] overflow-hidden rounded-3xl border border-slate-200 bg-slate-100/95 text-slate-950 shadow-2xl backdrop-blur">
      <ToastStack toasts={toasts} />
      <div className="flex h-full flex-col">
        <header className="border-b border-slate-200 bg-white px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Academic Citation Copilot</p>
          <h1 className="mt-1 text-lg font-semibold text-slate-950">Find credible evidence</h1>
          <p className="mt-1 text-xs leading-5 text-slate-600">Scan this Google Doc and retrieve academic sources.</p>
        </header>
        <main className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">Document scan</h2>
              <div className="flex gap-2">
                <select className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800" value={recencyPreference} onChange={(event) => {
                  const nextPreference = event.target.value as RecencyPreference;
                  setRecencyPreference(nextPreference);
                  if (scannedDocument?.keyPhrases.length) {
                    void searchPhrases(allSearchQueriesFor(scannedDocument), "recency filter", nextPreference);
                  }
                }}>
                  <option value="balanced">Balanced</option>
                  <option value="recent">Recent</option>
                  <option value="foundational">Foundational</option>
                </select>
                <select className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800" value={manualLanguage} onChange={(event) => setManualLanguage(event.target.value as LanguageSelection)}>
                  <option value="auto">Auto-detect</option>
                  <option value="en">English</option>
                  <option value="ja">Japanese</option>
                  <option value="es">Spanish</option>
                  <option value="zh">Chinese</option>
                </select>
                <select className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800" value={citationStyle} onChange={(event) => setCitationStyle(event.target.value as CitationStyle)}>
                  <option value="APA">APA</option>
                  <option value="MLA">MLA</option>
                </select>
              </div>
            </div>
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-5 text-slate-700">
              <span>{scanSummary}</span>
              {detectedLanguageBadge ? <span className="ml-2 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">{detectedLanguageBadge}</span> : null}
            </div>
            {(scannedDocument?.keyPhrases.length || customKeywords.length) ? (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Search queries</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {queryPairs.map(({ original, translated }) => (
                    <span key={`${original}-${translated}`} className="flex max-w-full flex-col rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                      <span>{translated}</span>
                      {translated.toLowerCase() !== original.toLowerCase() ? <span className="text-[10px] font-medium text-slate-400">{original}</span> : null}
                    </span>
                  ))}
                  {customKeywords.map((keyword) => (
                    <span key={keyword} className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      {keyword}
                      <button className="text-slate-400 hover:text-slate-900" type="button" onClick={() => removeCustomKeyword(keyword)} aria-label={`Remove ${keyword}`}>x</button>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mt-3 flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500"
                placeholder="Add a keyword..."
                value={customKeywordInput}
                onChange={(event) => setCustomKeywordInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustomKeyword();
                  }
                }}
              />
              <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400" type="button" onClick={addCustomKeyword} disabled={!customKeywordInput.trim()}>Add</button>
            </div>
            <button className="mt-4 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400" onClick={handleFindEvidence} disabled={isLoading}>Find Evidence</button>
          </section>
          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
          {warnings.map((warning) => <div key={warning} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{warning}</div>)}
          {canShowDemoSources ? (
            <button className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50" type="button" onClick={showDemoSources} disabled={isLoading}>Show demo sources instead</button>
          ) : null}
          {demoSourcesActive ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Demo sources - not live results.</div> : null}
          {searchFocus && cards.length > 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700"><span className="font-semibold text-slate-900">Search focus:</span> {searchFocus}</div> : null}
          {isLoading ? (
            <div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">{loadingMessage || "Loading..."}</div>
              <LoadingSkeleton />
            </div>
          ) : null}
          {!isLoading && !error && cards.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">Click Find Evidence to automatically scan your document and retrieve academic sources.</div> : null}
          {!isLoading && cards.length > 0 ? <section className="space-y-4">{cards.map((card) => <EvidenceCard key={card.id} card={card} citationStyle={citationStyle} onCopy={copyCitation} onInsert={insertCitation} />)}</section> : null}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-700 shadow-sm">
            <button className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-900" onClick={() => setShowDebugDetails((current) => !current)} type="button">
              <span>Debug details</span>
              <span>{showDebugDetails ? "Hide" : "Show"}</span>
            </button>
            {showDebugDetails ? (
              <>
                <div className="mt-3 space-y-1 rounded-xl bg-slate-50 p-3">
                  <p><span className="font-semibold">Document ID:</span> {scannedDocument?.documentId ?? "none"}</p>
                  <p><span className="font-semibold">Word count:</span> {scannedDocument?.wordCount ?? 0}</p>
                  <p><span className="font-semibold">Detected language:</span> {scannedDocument?.detectedLanguage ?? "none"}</p>
                  <p><span className="font-semibold">Language override:</span> {manualLanguage}</p>
                  <p><span className="font-semibold">Search queries:</span> {allSearchQueriesFor().join(", ") || "none"}</p>
                  <p><span className="font-semibold">Current request method:</span> {currentRequestExtractionMethod}</p>
                  <p><span className="font-semibold">Backend health result:</span> {backendHealthResult}</p>
                  <p><span className="font-semibold">API request status:</span> {apiRequestStatus}</p>
                  <p><span className="font-semibold">Actual backend URL called:</span> {actualBackendUrl}</p>
                  <p><span className="font-semibold">HTTP status or fetch exception:</span> {lastHttpStatus}</p>
                  <p><span className="font-semibold">Request payload text:</span> {lastSelectedTextPayload === "No request yet" ? lastSelectedTextPayload : lastSelectedTextPayload.slice(0, 120)}</p>
                  <p><span className="font-semibold">Request body:</span> {lastRequestBody === "No request yet" ? lastRequestBody : lastRequestBody.slice(0, 240)}</p>
                  <p><span className="font-semibold">Response body or exception:</span> {lastResponseBody === "No request yet" ? lastResponseBody : lastResponseBody.slice(0, 240)}</p>
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
