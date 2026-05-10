import type { EvidenceResponse, HealthResponse } from "../../../shared/types";
import type { BackendEvidenceMessage, BackendHealthMessage } from "../types/messages";

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

chrome.runtime.onInstalled.addListener(() => {
  console.info("Academic Citation Copilot installed.");
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

chrome.runtime.onMessage.addListener((message: BackendHealthMessage | BackendEvidenceMessage, _sender, sendResponse) => {
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

  return false;
});
