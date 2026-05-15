import type { EvidenceNode } from "../essay-planner";

export type CitationFormat = "mla" | "apa";

export interface FormattedCitation {
  id: string;
  format: CitationFormat;
  inlineCitation: string;
  fullCitation: string;
  sourceType: string;
  title: string;
  author: string;
  year: number | null;
}

export interface WorksCitedPage {
  format: CitationFormat;
  heading: string;
  entries: string[];
  formattedBlock: string;
}

export interface CitationManagerState {
  citations: FormattedCitation[];
  selectedIds: string[];
  format: CitationFormat;
  lastUpdated: string;
}

export interface FormatCitationInput {
  nodes: EvidenceNode[];
  format: CitationFormat;
}

export interface FormatCitationResult {
  citations: FormattedCitation[];
  worksCited: WorksCitedPage;
}
