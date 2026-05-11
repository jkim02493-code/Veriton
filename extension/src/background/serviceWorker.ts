import type { CurrentUserResponse, EvidenceResponse, HealthResponse, SearchHistoryEntry, SearchResponse, StarredSource, SupabaseSession } from "../../../shared/types";
import type {
  BackendEvidenceMessage,
  BackendHealthMessage,
  BackendHistoryMessage,
  BackendMeMessage,
  BackendSearchMessage,
  BackendStarMessage,
  BackendStarredMessage,
  BackendUnstarMessage,
  ExtractTopicsMessage,
  FetchDocumentTextMessage,
  ScanDocumentRequestedMessage,
  SupabaseLoginMessage,
  SupabaseLogoutMessage,
  SupabaseSessionMessage,
} from "../types/messages";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "https://veriton.onrender.com";
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const SESSION_STORAGE_KEY = "veriton-supabase-session";
const REQUEST_TIMEOUT_MS = 30000;

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

function requireSupabaseConfig(): void {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for the extension build.");
  }
}

function getStoredSession(): Promise<SupabaseSession | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(SESSION_STORAGE_KEY, (items) => {
      resolve((items[SESSION_STORAGE_KEY] as SupabaseSession | undefined) ?? null);
    });
  });
}

function setStoredSession(session: SupabaseSession | null): Promise<void> {
  return new Promise((resolve) => {
    if (!session) {
      chrome.storage.local.remove(SESSION_STORAGE_KEY, () => resolve());
      return;
    }
    chrome.storage.local.set({ [SESSION_STORAGE_KEY]: session }, () => resolve());
  });
}

function parseSupabaseSession(callbackUrl: string): SupabaseSession {
  const url = new URL(callbackUrl);
  const params = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.search.slice(1));
  const accessToken = params.get("access_token");
  if (!accessToken) {
    throw new Error(params.get("error_description") ?? params.get("error") ?? "Supabase login did not return an access token.");
  }
  const expiresIn = Number(params.get("expires_in") ?? "3600");
  return {
    access_token: accessToken,
    refresh_token: params.get("refresh_token") ?? undefined,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    token_type: params.get("token_type") ?? "bearer",
  };
}

async function refreshSupabaseSession(session: SupabaseSession): Promise<SupabaseSession> {
  requireSupabaseConfig();
  if (!session.refresh_token) {
    throw new Error("Supabase session expired. Please sign in again.");
  }
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  const payload = (await response.json().catch(() => ({}))) as Partial<SupabaseSession> & { expires_in?: number; error_description?: string };
  if (!response.ok || !payload.access_token) {
    await setStoredSession(null);
    throw new Error(payload.error_description ?? "Supabase session expired. Please sign in again.");
  }
  const refreshed: SupabaseSession = {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token ?? session.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + Number(payload.expires_in ?? 3600),
    token_type: payload.token_type ?? "bearer",
  };
  await setStoredSession(refreshed);
  return refreshed;
}

async function getValidSupabaseSession(): Promise<SupabaseSession> {
  const session = await getStoredSession();
  if (!session?.access_token) {
    throw new Error("Please sign in with Google to use Veriton.");
  }
  if (session.expires_at && session.expires_at < Math.floor(Date.now() / 1000) + 60) {
    return refreshSupabaseSession(session);
  }
  return session;
}

function launchSupabaseLogin(): Promise<SupabaseSession> {
  requireSupabaseConfig();
  const redirectUrl = chrome.identity.getRedirectURL("supabase");
  const authUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}`;
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, async (callbackUrl) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError || !callbackUrl) {
        reject(new Error(runtimeError?.message ?? "Supabase login was cancelled."));
        return;
      }
      try {
        const session = parseSupabaseSession(callbackUrl);
        await setStoredSession(session);
        resolve(session);
      } catch (error) {
        reject(error);
      }
    });
  });
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
      const backendMessage = typeof payload === "object" && payload && "detail" in payload
        ? (payload as { detail?: { message?: string } | string }).detail
        : undefined;
      const message = typeof backendMessage === "object" ? backendMessage.message : backendMessage;
      throw new BackendFetchError(message ?? `Request failed with status ${response.status}: ${JSON.stringify(payload)}`, url, response.status, payload);
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

async function fetchWithSupabaseAuth<T>(path: string, options: RequestInit = {}): Promise<BackendFetchResult<T>> {
  const session = await getValidSupabaseSession();
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  return fetchWithTimeout<T>(path, {
    ...options,
    headers,
  });
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

chrome.runtime.onMessage.addListener((message: BackendHealthMessage | BackendEvidenceMessage | BackendSearchMessage | BackendMeMessage | BackendStarMessage | BackendUnstarMessage | BackendStarredMessage | BackendHistoryMessage | SupabaseLoginMessage | SupabaseLogoutMessage | SupabaseSessionMessage | ScanDocumentRequestedMessage | FetchDocumentTextMessage | ExtractTopicsMessage, sender, sendResponse) => {
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

  if (message.type === "SUPABASE_SESSION") {
    getValidSupabaseSession()
      .then((session) => sendResponse({ ok: true, payload: session }))
      .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    return true;
  }

  if (message.type === "SUPABASE_LOGIN") {
    launchSupabaseLogin()
      .then((session) => sendResponse({ ok: true, payload: session }))
      .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    return true;
  }

  if (message.type === "SUPABASE_LOGOUT") {
    setStoredSession(null)
      .then(() => sendResponse({ ok: true }))
      .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    return true;
  }

  if (message.type === "BACKEND_ME") {
    fetchWithSupabaseAuth<CurrentUserResponse>("/me")
      .then((result) => sendResponse({ ok: true, payload: result.payload, status: "Session OK", backendUrl: result.backendUrl, httpStatus: result.httpStatus, responseBody: result.responseBody }))
      .catch((error: unknown) => sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        status: "Session check failed",
        backendUrl: error instanceof BackendFetchError ? error.backendUrl : `${API_BASE_URL}/me`,
        httpStatus: error instanceof BackendFetchError ? error.httpStatus : undefined,
        responseBody: error instanceof BackendFetchError ? error.responseBody : undefined,
      }));
    return true;
  }

  if (message.type === "BACKEND_EVIDENCE") {
    devLog("request received", message.type);
    devLog("selectedText sent to backend", message.request.text);
    const requestBody = JSON.stringify({ searchLanguage: "en", ...message.request });
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

  if (message.type === "BACKEND_SEARCH") {
    devLog("request received", message.type);
    const requestBody = JSON.stringify({ searchLanguage: "en", ...message.request });
    fetchWithSupabaseAuth<SearchResponse>("/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody,
    })
      .then((result) => sendResponse({ ok: true, payload: result.payload, status: "Search request OK", backendUrl: result.backendUrl, httpStatus: result.httpStatus, requestBody, responseBody: result.responseBody }))
      .catch((error: unknown) => sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        status: "Search request failed",
        backendUrl: error instanceof BackendFetchError ? error.backendUrl : `${API_BASE_URL}/search`,
        httpStatus: error instanceof BackendFetchError ? error.httpStatus : undefined,
        requestBody,
        responseBody: error instanceof BackendFetchError ? error.responseBody : undefined,
      }));
    return true;
  }

  if (message.type === "BACKEND_STAR") {
    const requestBody = JSON.stringify({ source: message.source });
    fetchWithSupabaseAuth<StarredSource>("/star", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody,
    })
      .then((result) => sendResponse({ ok: true, payload: result.payload, status: "Star saved", backendUrl: result.backendUrl, httpStatus: result.httpStatus, requestBody, responseBody: result.responseBody }))
      .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error), status: "Star failed", backendUrl: error instanceof BackendFetchError ? error.backendUrl : `${API_BASE_URL}/star`, httpStatus: error instanceof BackendFetchError ? error.httpStatus : undefined, requestBody, responseBody: error instanceof BackendFetchError ? error.responseBody : undefined }));
    return true;
  }

  if (message.type === "BACKEND_UNSTAR") {
    fetchWithSupabaseAuth<void>(`/star/${encodeURIComponent(message.sourceId)}`, { method: "DELETE" })
      .then((result) => sendResponse({ ok: true, payload: result.payload, status: "Star removed", backendUrl: result.backendUrl, httpStatus: result.httpStatus, responseBody: result.responseBody }))
      .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error), status: "Unstar failed", backendUrl: error instanceof BackendFetchError ? error.backendUrl : `${API_BASE_URL}/star/${message.sourceId}`, httpStatus: error instanceof BackendFetchError ? error.httpStatus : undefined, responseBody: error instanceof BackendFetchError ? error.responseBody : undefined }));
    return true;
  }

  if (message.type === "BACKEND_STARRED") {
    fetchWithSupabaseAuth<StarredSource[]>("/starred")
      .then((result) => sendResponse({ ok: true, payload: result.payload, status: "Starred sources loaded", backendUrl: result.backendUrl, httpStatus: result.httpStatus, responseBody: result.responseBody }))
      .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error), status: "Starred sources failed", backendUrl: error instanceof BackendFetchError ? error.backendUrl : `${API_BASE_URL}/starred`, httpStatus: error instanceof BackendFetchError ? error.httpStatus : undefined, responseBody: error instanceof BackendFetchError ? error.responseBody : undefined }));
    return true;
  }

  if (message.type === "BACKEND_HISTORY") {
    fetchWithSupabaseAuth<SearchHistoryEntry[]>("/history")
      .then((result) => sendResponse({ ok: true, payload: result.payload, status: "History loaded", backendUrl: result.backendUrl, httpStatus: result.httpStatus, responseBody: result.responseBody }))
      .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error), status: "History failed", backendUrl: error instanceof BackendFetchError ? error.backendUrl : `${API_BASE_URL}/history`, httpStatus: error instanceof BackendFetchError ? error.httpStatus : undefined, responseBody: error instanceof BackendFetchError ? error.responseBody : undefined }));
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
        sendResponse({ topics: result.payload.topics });
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
