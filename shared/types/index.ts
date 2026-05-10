export type CitationStyle = "APA" | "MLA";
export type SourceTier = "high" | "medium" | "low";
export type CitationSourceType = "journal" | "book" | "website" | "report" | "unknown";
export type RecencyPreference = "recent" | "balanced" | "foundational";
export type AgeBucket = "Recent" | "Mid" | "Foundational" | "Older";

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
  ageBucket?: AgeBucket;
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
  recencyPreference?: RecencyPreference;
  demoMode?: boolean;
}

export interface EvidenceResponse {
  query: string;
  searchFocus?: string;
  cards: EvidenceCard[];
  evidence?: EvidenceCard[];
  warnings: string[];
  error?: string;
  message?: string;
  retry?: boolean;
  demoMode?: boolean;
}

export interface HealthResponse {
  status: "ok";
  mockMode: boolean;
}
