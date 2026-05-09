import type { CitationStyle } from "../../../shared/types";

export interface SelectionSnapshot {
  text: string;
}

export interface InsertCitationMessage {
  type: "INSERT_CITATION";
  citation: string;
}

export interface SelectionChangedMessage {
  type: "SELECTION_CHANGED";
  text: string;
}

export interface FindEvidenceRequestState {
  selectedText: string;
  citationStyle: CitationStyle;
}
