import type { EvidenceRequest, EvidenceResponse, HealthResponse } from "../../../shared/types";
import type { BackendEvidenceMessage, BackendHealthMessage } from "../types/messages";

export const API_BASE_URL = "http://127.0.0.1:8000";

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

function sendBackendMessage<T>(message: BackendHealthMessage | BackendEvidenceMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: BackendRuntimeResponse<T> | undefined) => {
      if (chrome.runtime.lastError) {
        const runtimeErrorMessage = chrome.runtime.lastError.message ?? "Chrome runtime messaging failed";
        emitApiDebug({
          message: `API request failed: ${runtimeErrorMessage}`,
          backendUrl: message.type === "BACKEND_EVIDENCE" ? `${API_BASE_URL}/evidence` : `${API_BASE_URL}/health`,
          httpStatus: runtimeErrorMessage,
          selectedTextPayload: message.type === "BACKEND_EVIDENCE" ? message.request.text : undefined,
          requestBody: message.type === "BACKEND_EVIDENCE" ? JSON.stringify(message.request) : undefined,
        });
        reject(new BackendRequestError(runtimeErrorMessage, message.type === "BACKEND_EVIDENCE" ? `${API_BASE_URL}/evidence` : `${API_BASE_URL}/health`, runtimeErrorMessage, message.type === "BACKEND_EVIDENCE" ? JSON.stringify(message.request) : undefined));
        return;
      }
      emitApiDebug({
        message: response?.status ?? "API request completed",
        backendUrl: response?.backendUrl,
        httpStatus: response?.httpStatus ?? response?.error,
        selectedTextPayload: message.type === "BACKEND_EVIDENCE" ? message.request.text : undefined,
        requestBody: response?.requestBody,
        responseBody: response?.responseBody,
      });
      if (!response?.ok) {
        reject(new BackendRequestError(response?.error ?? "Backend request failed", response?.backendUrl, response?.httpStatus ?? response?.error, response?.requestBody, response?.responseBody));
        return;
      }
      resolve(response.payload as T);
    });
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
