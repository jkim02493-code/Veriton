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
  language?: string;
  sourceType?: CitationSourceType;
}

export interface EvidenceCard {
  id: string;
  title: string;
  authors: string[];
  year?: string;
  ageBucket?: AgeBucket;
  language?: string;
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
  searchLanguage?: "en" | "ja" | "es" | "zh" | "unknown";
  citationStyle: CitationStyle;
  recencyPreference?: RecencyPreference;
  demoMode?: boolean;
}

export interface UsageState {
  plan: "free" | "pro";
  lifetimeSearches: number;
  searchesToday: number;
  remainingSearches: number;
  limit: number;
  resetsAt?: string | null;
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

export interface SearchRequest {
  query: string;
  seen_urls: string[];
  searchLanguage?: "en" | "ja" | "es" | "zh" | "unknown";
  citationStyle?: CitationStyle;
  recencyPreference?: RecencyPreference;
  demoMode?: boolean;
}

export interface SearchResponse extends EvidenceResponse {
  usage: UsageState;
}

export interface StarredSource {
  id: string;
  source_title: string;
  authors?: string;
  url?: string;
  citation_apa?: string;
  citation_mla?: string;
  year?: string;
  starred_at: string;
}

export interface SearchHistoryEntry {
  id: string;
  query: string;
  sources_returned: EvidenceCard[];
  searched_at: string;
}

export interface CurrentUserResponse {
  id: string;
  email?: string;
  usage: UsageState;
}

export interface SupabaseSession {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  token_type?: string;
}

export interface HealthResponse {
  status: "ok";
  mockMode: boolean;
}
