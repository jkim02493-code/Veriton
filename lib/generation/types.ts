import type { EssayPlan, EssayType, SectionRole } from "../essay-planner";
import type { StyleDeltaResult, StyleProfile } from "../style-profiler";

export type CitationFormat = "mla" | "apa";

export interface GenerationConfig {
  citationFormat: CitationFormat;
  model: string;
  maxTokensPerSection: number;
  temperature: number;
  enableStyleDeltaCheck: boolean;
  deltaWarningThreshold: number;
}

export interface DraftChunk {
  chunkIndex: number;
  text: string;
  delayMs: number;
  isPause: boolean;
  isCorrection: boolean;
}

export interface GeneratedSection {
  sectionIndex: number;
  role: SectionRole;
  label: string;
  generatedText: string;
  wordCount: number;
  targetWordCount: number;
  wordCountDelta: number;
  styleDeltaResult: StyleDeltaResult | null;
  citationsUsed: string[];
  draftChunks: DraftChunk[];
}

export interface GeneratedDraft {
  schemaVersion: "3.0.0";
  draftId: string;
  planId: string;
  profileId: string;
  essayType: EssayType;
  citationFormat: CitationFormat;
  sections: GeneratedSection[];
  assembledText: string;
  totalWordCount: number;
  targetWordCount: number;
  totalAssignedEvidence: number;
  overallStyleSimilarity: number;
  worksСited: string[];
  styleWarnings: string[];
  generatedAt: string;
}

export interface GenerationInput {
  plan: EssayPlan;
  profile: StyleProfile;
  config?: Partial<GenerationConfig>;
}

export interface GenerationResult {
  draft: GeneratedDraft;
  errors: string[];
  totalApiCalls: number;
}
