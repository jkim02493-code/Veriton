import type { EvidenceRequest, EvidenceResponse, HealthResponse } from "../../../shared/types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const REQUEST_TIMEOUT_MS = 10_000;

async function fetchWithTimeout<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, signal: controller.signal });
    const payload = (await response.json().catch(() => ({}))) as unknown;
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}: ${JSON.stringify(payload)}`);
    }
    return payload as T;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function getHealth(): Promise<HealthResponse> {
  return fetchWithTimeout<HealthResponse>("/health");
}

export function findEvidence(request: EvidenceRequest): Promise<EvidenceResponse> {
  return fetchWithTimeout<EvidenceResponse>("/evidence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}
