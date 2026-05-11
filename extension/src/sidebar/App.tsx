import { useEffect, useState, type CSSProperties } from "react";
import type { CitationStyle, EvidenceCard as EvidenceCardType, RecencyPreference } from "../../../shared/types";
import { EvidenceCard } from "../components/EvidenceCard";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { ToastStack } from "../components/ToastStack";
import { useToasts } from "../hooks/useToasts";
import { API_BASE_URL, BackendRequestError, findEvidence, getHealth } from "../services/api";
import type { ScanDocumentRuntimeResponse } from "../types/messages";
import type { ScannedDocument } from "../content/documentScanner";

interface Props {
  onInsertCitation: (citation: string) => Promise<boolean>;
}

type LanguageSelection = "auto" | "en" | "ja" | "es" | "zh";
type ThemeMode = "dark" | "light";
type ThemeStyle = CSSProperties & Record<`--${string}`, string>;

interface EvidenceSearchQuery {
  text: string;
}

const EXTENSION_CONTEXT_MESSAGE = "Please refresh the Google Docs page and try again.";

function SunIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20.2 15.6A8.1 8.1 0 0 1 8.4 3.8 8.9 8.9 0 1 0 20.2 15.6Z" />
    </svg>
  );
}

function themeVariables(theme: ThemeMode): ThemeStyle {
  const dark = theme === "dark";
  return {
    "--bg-primary": dark ? "#0a0a0a" : "#fdf6f0",
    "--bg-card": dark ? "#141414" : "#ffffff",
    "--bg-input": dark ? "#1e1e1e" : "#fef3e8",
    "--border": dark ? "#2a2a2a" : "#f0d9c8",
    "--text-primary": dark ? "#f8fafc" : "#1c1009",
    "--text-secondary": dark ? "#64748b" : "#8b6347",
    "--text-muted": dark ? "#374151" : "#c4a882",
    "--accent": dark ? "#6ee7b7" : "#d4622a",
    "--accent-hover": dark ? "#34d399" : "#b8501f",
    "--btn-primary-bg": dark ? "#6ee7b7" : "#d4622a",
    "--btn-primary-text": dark ? "#000000" : "#ffffff",
    "--danger": "#f87171",
    "--chip-text": dark ? "#f8fafc" : "#7c4a1e",
    "--usage-empty": dark ? "#374151" : "#f0d9c8",
    "--copy-bg": "#ffffff",
    "--copy-text": "#000000",
    background: "var(--bg-primary)",
    borderColor: "var(--border)",
    color: "var(--text-primary)",
  };
}

function cardSurfaceStyle(theme: ThemeMode): CSSProperties {
  return {
    background: "var(--bg-card)",
    borderColor: "var(--border)",
    boxShadow: theme === "light" ? "0 1px 3px rgba(180, 100, 40, 0.08)" : "none",
  };
}

function ThemeToggle({ theme, onToggle }: { theme: ThemeMode; onToggle: () => void }) {
  const isLight = theme === "light";
  return (
    <button
      aria-label={`Switch to ${isLight ? "dark" : "light"} mode`}
      className="flex h-8 w-8 items-center justify-center rounded-full border transition"
      onClick={onToggle}
      style={{
        background: isLight ? "#ffedd5" : "var(--bg-input)",
        borderColor: isLight ? "#fed7aa" : "#333",
        color: isLight ? "#ea580c" : "var(--text-secondary)",
      }}
      type="button"
    >
      {isLight ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function UsageCounter({ theme }: { theme: ThemeMode }) {
  const used = 5;
  const total = 10;
  return (
    <section className="rounded-2xl border p-4" style={cardSurfaceStyle(theme)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold tracking-[0.08em]">
          {Array.from({ length: total }, (_, index) => (
            <span key={index} style={{ color: index < used ? "var(--accent)" : "var(--usage-empty)" }}>{"\u25CF"}</span>
          ))}
        </p>
        <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>5/10 searches used today</p>
      </div>
      <button className="mt-2 text-xs font-semibold hover:opacity-80" style={{ color: "var(--accent)" }} type="button">Upgrade for unlimited</button>
    </section>
  );
}

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
    try {
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
    } catch (error) {
      reject(error);
    }
  });
}

function isExtensionContextError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return normalized.includes("context invalidated") || normalized.includes("extension context");
}

function errorMessageForDisplay(error: unknown, fallbackPrefix: string): string {
  if (isExtensionContextError(error)) {
    return EXTENSION_CONTEXT_MESSAGE;
  }
  return `${fallbackPrefix}: ${error instanceof Error ? error.message : String(error)}`;
}

export function App({ onInsertCitation }: Props) {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [citationStyle, setCitationStyle] = useState<CitationStyle>("APA");
  const [recencyPreference, setRecencyPreference] = useState<RecencyPreference>("balanced");
  const [scannedDocument, setScannedDocument] = useState<ScannedDocument | null>(null);
  const [manualLanguage, setManualLanguage] = useState<LanguageSelection>("auto");
  const [customKeywordInput, setCustomKeywordInput] = useState("");
  const [customKeywords, setCustomKeywords] = useState<string[]>([]);
  const [excludedQueries, setExcludedQueries] = useState<string[]>([]);
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

  useEffect(() => {
    const storedTheme = localStorage.getItem("veriton-theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
    }
    setThemeLoaded(true);
  }, []);

  useEffect(() => {
    if (themeLoaded) {
      localStorage.setItem("veriton-theme", theme);
    }
  }, [theme, themeLoaded]);

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

  function generatedQueriesFor(document = scannedDocument): string[] {
    if (!document) {
      return [];
    }
    return document.keyPhrases;
  }

  function visibleGeneratedQueriesFor(document = scannedDocument, exclusions = excludedQueries): string[] {
    const excludedKeys = new Set(exclusions.map((query) => normalizeSearchQuery(query).toLowerCase()));
    return generatedQueriesFor(document).filter((query) => !excludedKeys.has(normalizeSearchQuery(query).toLowerCase()));
  }

  function allSearchQueriesFor(document = scannedDocument, exclusions = excludedQueries): string[] {
    const excludedKeys = new Set(exclusions.map((query) => normalizeSearchQuery(query).toLowerCase()));
    return mergeSearchQueries(
      visibleGeneratedQueriesFor(document, exclusions),
      customKeywords.filter((keyword) => !excludedKeys.has(normalizeSearchQuery(keyword).toLowerCase()))
    );
  }

  function evidenceQueriesFor(document = scannedDocument, exclusions = excludedQueries): EvidenceSearchQuery[] {
    const excludedKeys = new Set(exclusions.map((query) => normalizeSearchQuery(query).toLowerCase()));
    const queries: EvidenceSearchQuery[] = visibleGeneratedQueriesFor(document, exclusions).map((query) => ({
      text: normalizeSearchQuery(query),
    }));
    for (const keyword of customKeywords) {
      queries.push({
        text: normalizeSearchQuery(keyword),
      });
    }

    const seen = new Set<string>();
    return queries.filter((query) => {
      const text = normalizeSearchQuery(query.text);
      const key = text.toLowerCase();
      if (!text || excludedKeys.has(text.toLowerCase()) || seen.has(key)) {
        return false;
      }
      seen.add(key);
      query.text = text;
      return true;
    });
  }

  function languageBadge(language: string | undefined): string {
    if (language === "ja") {
      return "\u{1F1EF}\u{1F1F5} Japanese";
    }
    if (language === "es") {
      return "\u{1F1EA}\u{1F1F8} Spanish";
    }
    if (language === "zh") {
      return "\u{1F1E8}\u{1F1F3} Chinese";
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

  function removeGeneratedQuery(query: string) {
    setExcludedQueries((current) => current.includes(query) ? current : [...current, query]);
  }

  async function searchPhrases(searchQueries: EvidenceSearchQuery[], sourceLabel: string, preference = recencyPreference, demoMode = false, searchLanguage = effectiveLanguageFor()) {
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
      const backendSearchLanguage = (searchLanguage === "ja" || searchLanguage === "es" || searchLanguage === "zh") ? searchLanguage : "en";
      const responses = await Promise.all(searchQueries.map((query) => findEvidence({
        text: query.text,
        searchLanguage: backendSearchLanguage,
        citationStyle,
        recencyPreference: preference,
        demoMode,
      })));
      const combinedCards = dedupeEvidenceCards(responses.flatMap((response) => response.cards));
      const combinedWarnings = Array.from(new Set(responses.flatMap((response) => response.warnings))).filter((warning) => !warning.toLowerCase().includes("ambiguous"));
      const firstSearchFocus = responses.find((response) => response.searchFocus)?.searchFocus ?? null;

      setApiRequestStatus("Evidence request OK");
      setCards(combinedCards);
      setWarnings(combinedWarnings);
      setSearchFocus(firstSearchFocus);
      setCanShowDemoSources(responses.some((response) => response.error === "live_providers_unavailable" && response.retry === true));
      setDemoSourcesActive(responses.some((response) => response.demoMode === true));
      addDebugMessage(`Evidence response received: ${combinedCards.length} deduplicated cards from ${searchQueries.length} search queries`);

      if (combinedCards.length === 0) {
        showToast("No strong evidence found. Try rephrasing your claim.", "info");
      } else {
        showToast("Evidence ready.", "success");
      }
    } catch (technicalError) {
      console.error("Evidence request failed", technicalError);
      setApiRequestStatus(`Evidence request failed: ${technicalError instanceof Error ? technicalError.message : String(technicalError)}`);
      addDebugMessage(`Evidence fetch failed: ${technicalError instanceof Error ? technicalError.message : String(technicalError)}`);
      if (isExtensionContextError(technicalError)) {
        setError(EXTENSION_CONTEXT_MESSAGE);
        showToast(EXTENSION_CONTEXT_MESSAGE, "error");
        return;
      }
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

  async function runFreshScan() {
    setIsLoading(true);
    setLoadingMessage("Scanning document...");
    setExcludedQueries([]);
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
      const searchQueries = evidenceQueriesFor(scanResult, []);
      addDebugMessage(`Document scanned: ${scanResult.wordCount} words, ${searchQueries.length} search queries`);
      setIsLoading(false);
      await searchPhrases(searchQueries, "document scan", recencyPreference, false, effectiveLanguageFor(scanResult));
    } catch (scanError) {
      const displayMessage = errorMessageForDisplay(scanError, "Document scan failed");
      setError(displayMessage);
      setApiRequestStatus("Document scan failed");
      addDebugMessage(`Document scan failed: ${scanError instanceof Error ? scanError.message : String(scanError)}`);
      showToast(displayMessage, "error");
      setIsLoading(false);
      setLoadingMessage("");
    }
  }

  async function searchCurrentQueries() {
    if (!scannedDocument) {
      await runFreshScan();
      return;
    }

    const searchQueries = evidenceQueriesFor(scannedDocument);
    addDebugMessage(`Searching current filtered queries: ${searchQueries.length} search queries`);
    await searchPhrases(searchQueries, "current queries", recencyPreference, false, effectiveLanguageFor(scannedDocument));
  }

  async function handleFindEvidence() {
    if (scannedDocument) {
      await searchCurrentQueries();
      return;
    }
    await runFreshScan();
  }

  async function showDemoSources() {
    const fallbackQueries = scannedDocument ? evidenceQueriesFor(scannedDocument) : customKeywords.map((keyword) => ({ text: keyword }));
    if (fallbackQueries.length === 0) {
      return;
    }
    await searchPhrases(fallbackQueries, "demo fallback", recencyPreference, true);
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
        wordCount: text.split(/\s+/).filter(Boolean).length,
        detectedLanguage: "unknown",
      };
      setScannedDocument(fallbackScan);
      void searchPhrases(evidenceQueriesFor(fallbackScan), "context-menu selection", recencyPreference, false, effectiveLanguageFor(fallbackScan));
    };
    window.addEventListener("acc-context-menu-selection", listener);
    return () => window.removeEventListener("acc-context-menu-selection", listener);
  }, [citationStyle, recencyPreference]);

  const scanSummary = scannedDocument
    ? `Document scanned: ${scannedDocument.wordCount} words, ${allSearchQueriesFor(scannedDocument).length} search queries ready`
    : "Click Find Evidence to automatically scan your document and retrieve academic sources.";
  const detectedLanguageBadge = languageBadge(scannedDocument?.detectedLanguage);
  const generatedQueries = generatedQueriesFor();
  const visibleGeneratedQueries = visibleGeneratedQueriesFor();
  const primaryButtonLabel = scannedDocument ? "Search with current queries" : "Find Evidence";
  const queryCount = allSearchQueriesFor(scannedDocument).length;
  const scanStats = scannedDocument
    ? [`\u{1F4C4} ${scannedDocument.wordCount} words`, `\u{1F50D} ${queryCount} queries`, detectedLanguageBadge].filter(Boolean)
    : ["\u{1F4C4} Ready to scan", "\u{1F50D} 0 queries"];
  const rootStyle = themeVariables(theme);
  const panelStyle = cardSurfaceStyle(theme);
  const secondaryTextStyle: CSSProperties = { color: "var(--text-secondary)" };
  const mutedTextStyle: CSSProperties = { color: "var(--text-muted)" };
  const primaryTextStyle: CSSProperties = { color: "var(--text-primary)" };
  const accentTextStyle: CSSProperties = { color: "var(--accent)" };
  const inputStyle: CSSProperties = {
    background: theme === "light" ? "#fff8f3" : "var(--bg-input)",
    borderColor: "var(--border)",
    color: "var(--text-primary)",
  };
  const pillStyle: CSSProperties = {
    background: "var(--bg-input)",
    borderColor: "var(--border)",
    color: theme === "light" ? "#7c4a1e" : "var(--text-primary)",
  };
  const emptyPanelStyle: CSSProperties = {
    background: "var(--bg-card)",
    borderColor: theme === "light" ? "var(--border)" : "#333",
    color: "var(--text-secondary)",
  };

  return (
    <div className="acc-root fixed right-4 top-20 z-[2147483646] h-[calc(100vh-6rem)] w-[420px] overflow-hidden rounded-3xl border shadow-2xl backdrop-blur" style={rootStyle}>
      <ToastStack toasts={toasts} />
      <div className="flex h-full flex-col">
        <header
          className="px-5 pb-3 pt-5"
          style={{
            background: theme === "light" ? "linear-gradient(135deg, #fff8f3, #fef0e4)" : "var(--bg-primary)",
            borderBottom: theme === "light" ? "1px solid var(--border)" : "0",
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em]" style={accentTextStyle}>VERITON</p>
              <h1 className="mt-1 text-2xl font-bold" style={primaryTextStyle}>Find Evidence</h1>
              <p className="mt-1 text-xs leading-5" style={secondaryTextStyle}>Scan this Google Doc and retrieve academic sources.</p>
            </div>
            <ThemeToggle theme={theme} onToggle={() => setTheme((current) => current === "dark" ? "light" : "dark")} />
          </div>
        </header>
        <main className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <UsageCounter theme={theme} />
          <section className="rounded-2xl border p-4" style={panelStyle}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold" style={primaryTextStyle}>Document scan</h2>
              <div className="flex flex-wrap justify-end gap-2">
                <select className="rounded-lg border px-2 py-1 text-xs font-semibold outline-none focus:border-[var(--accent)]" style={inputStyle} value={recencyPreference} onChange={(event) => {
                  const nextPreference = event.target.value as RecencyPreference;
                  setRecencyPreference(nextPreference);
                  if (scannedDocument?.keyPhrases.length) {
                    void searchPhrases(evidenceQueriesFor(scannedDocument), "recency filter", nextPreference, false, effectiveLanguageFor(scannedDocument));
                  }
                }}>
                  <option value="balanced">Balanced</option>
                  <option value="recent">Recent</option>
                  <option value="foundational">Foundational</option>
                </select>
                <select className="rounded-lg border px-2 py-1 text-xs font-semibold outline-none focus:border-[var(--accent)]" style={inputStyle} value={manualLanguage} onChange={(event) => setManualLanguage(event.target.value as LanguageSelection)}>
                  <option value="auto">Auto-detect</option>
                  <option value="en">English</option>
                  <option value="ja">Japanese</option>
                  <option value="es">Spanish</option>
                  <option value="zh">Chinese</option>
                </select>
                <select className="rounded-lg border px-2 py-1 text-xs font-semibold outline-none focus:border-[var(--accent)]" style={inputStyle} value={citationStyle} onChange={(event) => setCitationStyle(event.target.value as CitationStyle)}>
                  <option value="APA">APA</option>
                  <option value="MLA">MLA</option>
                </select>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {scanStats.map((stat) => (
                <span key={stat} className="rounded-full border px-3 py-1 text-xs font-semibold" style={pillStyle}>{stat}</span>
              ))}
            </div>
            {!scannedDocument ? <p className="mt-3 text-xs leading-5" style={secondaryTextStyle}>{scanSummary}</p> : null}
            {(scannedDocument?.keyPhrases.length || customKeywords.length) ? (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={secondaryTextStyle}>Search queries</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {visibleGeneratedQueries.map((query) => (
                    <span key={query} className="flex max-w-full flex-col rounded-full border px-3 py-1 text-xs font-semibold" style={pillStyle}>
                      <span className="flex items-center gap-1">
                        <span>{query}</span>
                        <button className="text-[var(--text-secondary)] hover:text-[var(--danger)]" type="button" onClick={() => removeGeneratedQuery(query)} aria-label={`Remove ${query}`}>x</button>
                      </span>
                    </span>
                  ))}
                  {customKeywords.map((keyword) => (
                    <span key={keyword} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold" style={pillStyle}>
                      {keyword}
                      <button className="text-[var(--text-secondary)] hover:text-[var(--danger)]" type="button" onClick={() => removeCustomKeyword(keyword)} aria-label={`Remove ${keyword}`}>x</button>
                    </span>
                  ))}
                </div>
                {generatedQueries.length >= 3 ? <p className="mt-2 text-xs" style={mutedTextStyle}>Remove irrelevant queries to improve results</p> : null}
              </div>
            ) : null}
            {scannedDocument ? (
              <button className="mt-3 rounded-lg border px-3 py-2 text-xs font-semibold hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed" style={{ background: "transparent", borderColor: "var(--border)", color: "var(--text-secondary)" }} type="button" onClick={runFreshScan} disabled={isLoading}>Re-scan document</button>
            ) : null}
            <div className="mt-3 flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-xs outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
                style={inputStyle}
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
              <button className="rounded-lg border px-3 py-2 text-xs font-semibold hover:opacity-80 disabled:cursor-not-allowed" style={{ background: "transparent", borderColor: "var(--accent)", color: "var(--accent)" }} type="button" onClick={addCustomKeyword} disabled={!customKeywordInput.trim()}>Add</button>
            </div>
            <button className="mt-4 w-full rounded-xl px-4 py-3 text-sm font-bold hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60" style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }} onClick={handleFindEvidence} disabled={isLoading}>{primaryButtonLabel}</button>
          </section>
          {error ? <div className="rounded-2xl border p-4 text-sm" style={{ background: "rgba(239, 68, 68, 0.10)", borderColor: "rgba(239, 68, 68, 0.30)", color: "#fca5a5" }}>{error}</div> : null}
          {warnings.map((warning) => <div key={warning} className="rounded-2xl border p-4 text-sm" style={{ background: "rgba(245, 158, 11, 0.10)", borderColor: "rgba(245, 158, 11, 0.30)", color: "#fcd34d" }}>{warning}</div>)}
          {canShowDemoSources ? (
            <button className="w-full rounded-xl border px-4 py-3 text-sm font-semibold hover:border-[var(--accent)] hover:text-[var(--accent)]" style={{ background: "transparent", borderColor: "var(--border)", color: "var(--text-primary)" }} type="button" onClick={showDemoSources} disabled={isLoading}>Show demo sources instead</button>
          ) : null}
          {demoSourcesActive ? <div className="rounded-2xl border p-4 text-sm font-semibold" style={{ background: "rgba(245, 158, 11, 0.10)", borderColor: "rgba(245, 158, 11, 0.30)", color: "#fcd34d" }}>Demo sources - not live results.</div> : null}
          {searchFocus && cards.length > 0 ? <div className="rounded-2xl border p-3 text-sm" style={{ ...panelStyle, color: "var(--text-secondary)" }}><span className="font-semibold" style={primaryTextStyle}>Search focus:</span> {searchFocus}</div> : null}
          {isLoading ? (
            <div>
              <div className="rounded-2xl border p-4 text-sm font-semibold" style={{ ...panelStyle, color: "var(--text-primary)" }}>{loadingMessage || "Loading..."}</div>
              <LoadingSkeleton />
            </div>
          ) : null}
          {!isLoading && !error && cards.length === 0 ? <div className="rounded-2xl border border-dashed p-6 text-center text-sm" style={emptyPanelStyle}>Click Find Evidence to automatically scan your document and retrieve academic sources.</div> : null}
          {!isLoading && cards.length > 0 ? <section className="space-y-4">{cards.map((card) => <EvidenceCard key={card.id} card={card} citationStyle={citationStyle} documentLanguage={effectiveLanguageFor()} onCopy={copyCitation} onInsert={insertCitation} theme={theme} />)}</section> : null}
          <section className="rounded-2xl border p-4 text-xs" style={{ ...panelStyle, color: "var(--text-secondary)" }}>
            <button className="flex w-full items-center justify-between text-left text-sm font-semibold" style={{ color: "var(--text-primary)" }} onClick={() => setShowDebugDetails((current) => !current)} type="button">
              <span>Debug details</span>
              <span style={mutedTextStyle}>{showDebugDetails ? "Hide" : "Show"}</span>
            </button>
            {showDebugDetails ? (
              <>
                <div className="mt-3 space-y-1 rounded-xl border p-3" style={{ background: "var(--bg-primary)", borderColor: "var(--border)" }}>
                  <p><span className="font-semibold" style={primaryTextStyle}>Document ID:</span> {scannedDocument?.documentId ?? "none"}</p>
                  <p><span className="font-semibold" style={primaryTextStyle}>Word count:</span> {scannedDocument?.wordCount ?? 0}</p>
                  <p><span className="font-semibold" style={primaryTextStyle}>Detected language:</span> {scannedDocument?.detectedLanguage ?? "none"}</p>
                  <p><span className="font-semibold" style={primaryTextStyle}>Language override:</span> {manualLanguage}</p>
                  <p><span className="font-semibold" style={primaryTextStyle}>Search queries:</span> {allSearchQueriesFor().join(", ") || "none"}</p>
                  <p><span className="font-semibold" style={primaryTextStyle}>Current request method:</span> {currentRequestExtractionMethod}</p>
                  <p><span className="font-semibold" style={primaryTextStyle}>Backend health result:</span> {backendHealthResult}</p>
                  <p><span className="font-semibold" style={primaryTextStyle}>API request status:</span> {apiRequestStatus}</p>
                  <p><span className="font-semibold" style={primaryTextStyle}>Actual backend URL called:</span> {actualBackendUrl}</p>
                  <p><span className="font-semibold" style={primaryTextStyle}>HTTP status or fetch exception:</span> {lastHttpStatus}</p>
                  <p><span className="font-semibold" style={primaryTextStyle}>Request payload text:</span> {lastSelectedTextPayload === "No request yet" ? lastSelectedTextPayload : lastSelectedTextPayload.slice(0, 120)}</p>
                  <p><span className="font-semibold" style={primaryTextStyle}>Request body:</span> {lastRequestBody === "No request yet" ? lastRequestBody : lastRequestBody.slice(0, 240)}</p>
                  <p><span className="font-semibold" style={primaryTextStyle}>Response body or exception:</span> {lastResponseBody === "No request yet" ? lastResponseBody : lastResponseBody.slice(0, 240)}</p>
                </div>
                <div className="mt-3 max-h-32 space-y-2 overflow-y-auto rounded-xl border p-3" style={{ background: "var(--bg-primary)", borderColor: "var(--border)" }}>
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
