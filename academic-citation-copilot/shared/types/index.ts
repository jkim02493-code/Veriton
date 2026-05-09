export type CitationStyle = "APA" | "MLA";
export type SourceTier = "high" | "medium" | "low";
export type CitationSourceType = "journal" | "book" | "website" | "report" | "unknown";

export interface CitationMetadata {
  title: string;
  authors: string[];
  year?: string;
  journal?: string;
  publisher?: string;
  url?: string;
  doi?: string;
  sourceType?: CitationSourceType;
}

export interface EvidenceCard {
  id: string;
  title: string;
  authors: string[];
  year?: string;
  sourceType: string;
  sourceTier: SourceTier;
  url?: string;
  doi?: string;
  snippet: string;
  relevanceExplanation: string;
  apaCitation: string;
  mlaCitation: string;
}

export interface EvidenceRequest {
  text: string;
  citationStyle: CitationStyle;
}

export interface EvidenceResponse {
  query: string;
  cards: EvidenceCard[];
  warnings: string[];
}

export interface HealthResponse {
  status: "ok";
  mockMode: boolean;
}
