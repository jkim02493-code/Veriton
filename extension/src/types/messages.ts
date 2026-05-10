import type { EvidenceRequest } from "../../../shared/types";
import type { ScannedDocument } from "../content/documentScanner";

export interface InsertCitationMessage {
  type: "INSERT_CITATION";
  citation: string;
}

export interface ContextMenuSelectionMessage {
  type: "CONTEXT_MENU_SELECTION";
  text: string;
}

export interface BackendHealthMessage {
  type: "BACKEND_HEALTH";
}

export interface BackendEvidenceMessage {
  type: "BACKEND_EVIDENCE";
  request: EvidenceRequest;
}

export interface ScanDocumentRequestedMessage {
  type: "SCAN_DOCUMENT_REQUESTED";
}

export interface ScanDocumentRuntimeResponse {
  ok: boolean;
  payload?: ScannedDocument;
  error?: string;
}

export interface FetchDocumentTextMessage {
  type: "FETCH_DOCUMENT_TEXT";
  documentId: string;
}

export interface FetchDocumentTextRuntimeResponse {
  text?: string;
  error?: string;
}

export interface ExtractTopicsMessage {
  type: "EXTRACT_TOPICS";
  text: string;
}

export interface ExtractTopicsRuntimeResponse {
  topics?: string[];
  error?: string;
}
