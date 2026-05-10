import type { CitationStyle } from "../../../shared/types";
import type { EvidenceRequest } from "../../../shared/types";

export interface SelectionSnapshot {
  text: string;
  normalizedText: string;
  method: string;
  emptyReason: string;
  capturedAt: number | null;
  documentUrl: string;
  source: "google-docs" | "none";
  fingerprint: string;
  extractionAttempts: string[];
}

export interface InsertCitationMessage {
  type: "INSERT_CITATION";
  citation: string;
}

export interface SelectionChangedMessage {
  type: "SELECTION_CHANGED";
  snapshot: SelectionSnapshot;
}

export interface SelectionRequestedMessage {
  type: "SELECTION_REQUESTED";
  requestId: string;
  allowCopyFallback?: boolean;
  previousRequestText?: string;
}

export interface SelectionResponseMessage {
  type: "SELECTION_RESPONSE";
  requestId: string;
  snapshot: SelectionSnapshot;
}

export interface FindEvidenceRequestState {
  selectedText: string;
  citationStyle: CitationStyle;
}

export interface BackendHealthMessage {
  type: "BACKEND_HEALTH";
}

export interface BackendEvidenceMessage {
  type: "BACKEND_EVIDENCE";
  request: EvidenceRequest;
}
