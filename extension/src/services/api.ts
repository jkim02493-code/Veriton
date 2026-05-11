import type { CurrentUserResponse, EvidenceCard, EvidenceRequest, EvidenceResponse, HealthResponse, SearchHistoryEntry, SearchRequest, SearchResponse, StarredSource, SupabaseSession } from "../../../shared/types";
import type {
  BackendEvidenceMessage,
  BackendHealthMessage,
  BackendHistoryMessage,
  BackendMeMessage,
  BackendSearchMessage,
  BackendStarMessage,
  BackendStarredMessage,
  BackendUnstarMessage,
  SupabaseLoginMessage,
  SupabaseLogoutMessage,
  SupabaseSessionMessage,
} from "../types/messages";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

interface ApiDebugDetail {
  message: string;
  backendUrl?: string;
  httpStatus?: number | string;
  selectedTextPayload?: string;
  requestBody?: string;
  responseBody?: unknown;
}

interface BackendRuntimeResponse<T> {
  ok: boolean;
  payload?: T;
  error?: string;
  status?: string;
  backendUrl?: string;
  httpStatus?: number;
  requestBody?: string;
  responseBody?: unknown;
}

export class BackendRequestError extends Error {
  constructor(
    message: string,
    readonly backendUrl?: string,
    readonly httpStatus?: number | string,
    readonly requestBody?: string,
    readonly responseBody?: unknown
  ) {
    super(message);
  }
}

function emitApiDebug(detail: string | ApiDebugDetail): void {
  window.dispatchEvent(new CustomEvent("acc-api-debug", { detail: typeof detail === "string" ? { message: detail } : detail }));
}

function devLog(message: string, value?: unknown): void {
  if (import.meta.env.DEV) {
    console.info(`[ACC api] ${message}`, value ?? "");
  }
}

function backendUrlForMessage(message: RuntimeApiMessage): string {
  if (message.type === "BACKEND_EVIDENCE") {
    return `${API_BASE_URL}/evidence`;
  }
  if (message.type === "BACKEND_SEARCH") {
    return `${API_BASE_URL}/search`;
  }
  if (message.type === "BACKEND_ME") {
    return `${API_BASE_URL}/me`;
  }
  if (message.type === "BACKEND_STAR") {
    return `${API_BASE_URL}/star`;
  }
  if (message.type === "BACKEND_UNSTAR") {
    return `${API_BASE_URL}/star/${message.sourceId}`;
  }
  if (message.type === "BACKEND_STARRED") {
    return `${API_BASE_URL}/starred`;
  }
  if (message.type === "BACKEND_HISTORY") {
    return `${API_BASE_URL}/history`;
  }
  return `${API_BASE_URL}/health`;
}

type RuntimeApiMessage =
  | BackendHealthMessage
  | BackendEvidenceMessage
  | BackendSearchMessage
  | BackendMeMessage
  | BackendStarMessage
  | BackendUnstarMessage
  | BackendStarredMessage
  | BackendHistoryMessage
  | SupabaseLoginMessage
  | SupabaseLogoutMessage
  | SupabaseSessionMessage;

function requestTextForMessage(message: RuntimeApiMessage): string | undefined {
  if (message.type === "BACKEND_EVIDENCE") {
    return message.request.text;
  }
  if (message.type === "BACKEND_SEARCH") {
    return message.request.query;
  }
  return undefined;
}

function requestBodyForMessage(message: RuntimeApiMessage): string | undefined {
  if (message.type === "BACKEND_EVIDENCE" || message.type === "BACKEND_SEARCH") {
    return JSON.stringify(message.request);
  }
  if (message.type === "BACKEND_STAR") {
    return JSON.stringify({ source: message.source });
  }
  return undefined;
}

function sendBackendMessage<T>(message: RuntimeApiMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response: BackendRuntimeResponse<T> | undefined) => {
        const backendUrl = backendUrlForMessage(message);
        const selectedTextPayload = requestTextForMessage(message);
        const requestBody = requestBodyForMessage(message);
        if (chrome.runtime.lastError) {
          const runtimeErrorMessage = chrome.runtime.lastError.message ?? "Chrome runtime messaging failed";
          emitApiDebug({
            message: `API request failed: ${runtimeErrorMessage}`,
            backendUrl,
            httpStatus: runtimeErrorMessage,
            selectedTextPayload,
            requestBody,
          });
          reject(new BackendRequestError(runtimeErrorMessage, backendUrl, runtimeErrorMessage, requestBody));
          return;
        }
        emitApiDebug({
          message: response?.status ?? "API request completed",
          backendUrl: response?.backendUrl,
          httpStatus: response?.httpStatus ?? response?.error,
          selectedTextPayload,
          requestBody: response?.requestBody,
          responseBody: response?.responseBody,
        });
        if (!response?.ok) {
          reject(new BackendRequestError(response?.error ?? "Backend request failed", response?.backendUrl, response?.httpStatus ?? response?.error, response?.requestBody, response?.responseBody));
          return;
        }
        resolve(response.payload as T);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const backendUrl = backendUrlForMessage(message);
      const requestBody = requestBodyForMessage(message);
      emitApiDebug({
        message: `API request failed: ${errorMessage}`,
        backendUrl,
        httpStatus: errorMessage,
        selectedTextPayload: requestTextForMessage(message),
        requestBody,
      });
      reject(new BackendRequestError(errorMessage, backendUrl, errorMessage, requestBody));
    }
  });
}

export function getHealth(): Promise<HealthResponse> {
  emitApiDebug(`Checking backend via service worker at ${API_BASE_URL}/health`);
  return sendBackendMessage<HealthResponse>({ type: "BACKEND_HEALTH" });
}

export function findEvidence(request: EvidenceRequest): Promise<EvidenceResponse> {
  devLog("selectedText sent to backend", request.text);
  emitApiDebug({
    message: "Evidence request sent via service worker",
    backendUrl: `${API_BASE_URL}/evidence`,
    selectedTextPayload: request.text,
    requestBody: JSON.stringify(request),
  });
  return sendBackendMessage<EvidenceResponse>({ type: "BACKEND_EVIDENCE", request });
}

export function getCurrentUser(): Promise<CurrentUserResponse> {
  return sendBackendMessage<CurrentUserResponse>({ type: "BACKEND_ME" });
}

export function loginWithGoogle(): Promise<SupabaseSession> {
  return sendBackendMessage<SupabaseSession>({ type: "SUPABASE_LOGIN" });
}

export function getStoredSession(): Promise<SupabaseSession> {
  return sendBackendMessage<SupabaseSession>({ type: "SUPABASE_SESSION" });
}

export function logout(): Promise<void> {
  return sendBackendMessage<void>({ type: "SUPABASE_LOGOUT" });
}

export function searchEvidence(request: SearchRequest): Promise<SearchResponse> {
  emitApiDebug({
    message: "Authenticated search request sent via service worker",
    backendUrl: `${API_BASE_URL}/search`,
    selectedTextPayload: request.query,
    requestBody: JSON.stringify(request),
  });
  return sendBackendMessage<SearchResponse>({ type: "BACKEND_SEARCH", request });
}

export function starEvidenceSource(source: EvidenceCard): Promise<StarredSource> {
  return sendBackendMessage<StarredSource>({ type: "BACKEND_STAR", source });
}

export function unstarEvidenceSource(sourceId: string): Promise<void> {
  return sendBackendMessage<void>({ type: "BACKEND_UNSTAR", sourceId });
}

export function getStarredSources(): Promise<StarredSource[]> {
  return sendBackendMessage<StarredSource[]>({ type: "BACKEND_STARRED" });
}

export function getSearchHistory(): Promise<SearchHistoryEntry[]> {
  return sendBackendMessage<SearchHistoryEntry[]>({ type: "BACKEND_HISTORY" });
}
