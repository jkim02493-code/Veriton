import type { EvidenceCard, EvidenceRequest, SearchRequest } from "../../../shared/types";
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

export interface BackendSearchMessage {
  type: "BACKEND_SEARCH";
  request: SearchRequest;
}

export interface BackendMeMessage {
  type: "BACKEND_ME";
}

export interface BackendStarMessage {
  type: "BACKEND_STAR";
  source: EvidenceCard;
}

export interface BackendUnstarMessage {
  type: "BACKEND_UNSTAR";
  sourceId: string;
}

export interface BackendStarredMessage {
  type: "BACKEND_STARRED";
}

export interface BackendHistoryMessage {
  type: "BACKEND_HISTORY";
}

export interface SupabaseLoginMessage {
  type: "SUPABASE_LOGIN";
}

export interface SupabaseLogoutMessage {
  type: "SUPABASE_LOGOUT";
}

export interface SupabaseSessionMessage {
  type: "SUPABASE_SESSION";
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
  detectedLanguage?: string;
}

export interface ExtractTopicsRuntimeResponse {
  topics?: string[];
  error?: string;
}
