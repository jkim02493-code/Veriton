import type { EvidenceResponse, HealthResponse } from "../../../shared/types";
import type { BackendEvidenceMessage, BackendHealthMessage, ExtractTopicsMessage, FetchDocumentTextMessage, ScanDocumentRequestedMessage } from "../types/messages";
import "../utils/queryTranslator";

const API_BASE_URL = "http://127.0.0.1:8000";
const REQUEST_TIMEOUT_MS = 10_000;

interface BackendFetchResult<T> {
  payload: T;
  httpStatus: number;
  backendUrl: string;
  responseBody: unknown;
}

class BackendFetchError extends Error {
  constructor(
    message: string,
    readonly backendUrl: string,
    readonly httpStatus: number | null,
    readonly responseBody: unknown
  ) {
    super(message);
  }
}

interface GoogleDocsTextRun {
  content?: string;
}

interface GoogleDocsParagraphElement {
  textRun?: GoogleDocsTextRun;
}

interface GoogleDocsStructuralElement {
  paragraph?: {
    elements?: GoogleDocsParagraphElement[];
  };
}

interface GoogleDocsResponse {
  body?: {
    content?: GoogleDocsStructuralElement[];
  };
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "veriton-find-evidence",
    title: "Find Evidence with Veriton",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "veriton-find-evidence" && info.selectionText && tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: "CONTEXT_MENU_SELECTION",
      text: info.selectionText
    });
  }
});

function devLog(message: string, value?: unknown): void {
  if (import.meta.env.DEV) {
    console.info(`[ACC background] ${message}`, value ?? "");
  }
}

async function fetchWithTimeout<T>(path: string, options: RequestInit = {}): Promise<BackendFetchResult<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const url = `${API_BASE_URL}${path}`;
  try {
    const response = await fetch(url, {
      ...options,
      mode: "cors",
      credentials: "omit",
      signal: controller.signal,
    });
    devLog("backend response status", { path, status: response.status });
    const payload = (await response.json().catch(() => ({}))) as unknown;
    if (!response.ok) {
      throw new BackendFetchError(`Request failed with status ${response.status}: ${JSON.stringify(payload)}`, url, response.status, payload);
    }
    return { payload: payload as T, httpStatus: response.status, backendUrl: url, responseBody: payload };
  } catch (error) {
    if (error instanceof BackendFetchError) {
      throw error;
    }
    throw new BackendFetchError(error instanceof Error ? error.message : String(error), url, null, null);
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function getAuthToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError || !token) {
        reject(new Error(runtimeError?.message ?? "Google OAuth token is unavailable."));
        return;
      }
      resolve(token);
    });
  });
}

async function fetchDocumentText(documentId: string): Promise<string> {
  const token = await getAuthToken();
  const response = await fetch(`https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = (await response.json().catch(() => ({}))) as GoogleDocsResponse | { error?: { message?: string } };
  if (!response.ok) {
    const errorMessage = "error" in payload ? payload.error?.message : undefined;
    throw new Error(errorMessage ?? `Google Docs API request failed with status ${response.status}.`);
  }

  const documentResponse = payload as GoogleDocsResponse;
  const paragraphTexts = documentResponse.body?.content?.flatMap((item) => {
    const elements = item.paragraph?.elements ?? [];
    return elements.map((element) => element.textRun?.content ?? "").filter(Boolean);
  }) ?? [];

  return normalizeWhitespace(paragraphTexts.join(" "));
}

chrome.runtime.onMessage.addListener((message: BackendHealthMessage | BackendEvidenceMessage | ScanDocumentRequestedMessage | FetchDocumentTextMessage | ExtractTopicsMessage, sender, sendResponse) => {
  if (message.type === "BACKEND_HEALTH") {
    devLog("request received", message.type);
    fetchWithTimeout<HealthResponse>("/health")
      .then((result) => sendResponse({ ok: true, payload: result.payload, status: "Backend health OK", backendUrl: result.backendUrl, httpStatus: result.httpStatus, responseBody: result.responseBody }))
      .catch((error: unknown) => sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        status: "Backend health failed",
        backendUrl: error instanceof BackendFetchError ? error.backendUrl : `${API_BASE_URL}/health`,
        httpStatus: error instanceof BackendFetchError ? error.httpStatus : undefined,
        responseBody: error instanceof BackendFetchError ? error.responseBody : undefined,
      }));
    return true;
  }

  if (message.type === "BACKEND_EVIDENCE") {
    devLog("request received", message.type);
    devLog("selectedText sent to backend", message.request.text);
    const requestBody = JSON.stringify(message.request);
    fetchWithTimeout<EvidenceResponse>("/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody,
    })
      .then((result) => sendResponse({ ok: true, payload: result.payload, status: "Evidence request OK", backendUrl: result.backendUrl, httpStatus: result.httpStatus, requestBody, responseBody: result.responseBody }))
      .catch((error: unknown) => sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        status: "Evidence request failed",
        backendUrl: error instanceof BackendFetchError ? error.backendUrl : `${API_BASE_URL}/evidence`,
        httpStatus: error instanceof BackendFetchError ? error.httpStatus : undefined,
        requestBody,
        responseBody: error instanceof BackendFetchError ? error.responseBody : undefined,
      }));
    return true;
  }

  if (message.type === "FETCH_DOCUMENT_TEXT") {
    fetchDocumentText(message.documentId)
      .then((text) => sendResponse({ text }))
      .catch((error: unknown) => sendResponse({ error: error instanceof Error ? error.message : String(error) }));
    return true;
  }

  if (message.type === "EXTRACT_TOPICS") {
    const detectedLanguage = message.detectedLanguage ?? "unknown";
    const requestBody = JSON.stringify({ text: message.text, language: detectedLanguage });
    fetchWithTimeout<{ topics: string[] }>("/extract-topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody,
    })
      .then((result) => {
        const originalTopics = result.payload.topics;
        const translatedTopics = translateQueriesToEnglish(originalTopics, detectedLanguage);
        sendResponse({ topics: translatedTopics, originalTopics, detectedLanguage });
      })
      .catch((error: unknown) => sendResponse({ error: error instanceof Error ? error.message : String(error) }));
    return true;
  }

  if (message.type === "SCAN_DOCUMENT_REQUESTED") {
    const forwardToTab = (tabId: number) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({ ok: false, error: chrome.runtime.lastError.message ?? "Could not scan the active Google Docs tab." });
          return;
        }
        sendResponse(response);
      });
    };

    if (sender.tab?.id !== undefined) {
      forwardToTab(sender.tab.id);
      return true;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id === undefined) {
        sendResponse({ ok: false, error: "No active tab is available for document scanning." });
        return;
      }
      forwardToTab(tab.id);
    });
    return true;
  }

  return false;
});
