import type { GeneratedDraft } from "../generation";

export interface ReviewerNotesConfig {
  model: string;
  maxTokensPerSection: number;
  includeDefenceQuestions: boolean;
  includeKeyTerms: boolean;
  includeEvidenceSummary: boolean;
  readingLevel: "simple" | "standard" | "academic";
}

export interface KeyClaim {
  claimText: string;
  supportingSource: string;
  claimStrength: "strong" | "moderate" | "weak";
}

export interface KeyTerm {
  term: string;
  definition: string;
}

export interface DefenceQuestion {
  question: string;
  suggestedAnswer: string;
}

export interface SectionNote {
  sectionIndex: number;
  sectionLabel: string;
  role: string;
  plainSummary: string;
  keyClaims: KeyClaim[];
  keyTerms: KeyTerm[];
  evidenceSummary: string;
  defenceQuestions: DefenceQuestion[];
  wordCount: number;
}

export interface ReviewerNotes {
  schemaVersion: "5.0.0";
  notesId: string;
  draftId: string;
  essayType: string;
  generatedAt: string;
  config: ReviewerNotesConfig;
  sectionNotes: SectionNote[];
  overallSummary: string;
  totalKeyClaims: number;
  totalDefenceQuestions: number;
  totalKeyTerms: number;
}

export interface ReviewerNotesInput {
  draft: GeneratedDraft;
  config?: Partial<ReviewerNotesConfig>;
}

export interface ReviewerNotesResult {
  notes: ReviewerNotes;
  errors: string[];
  totalApiCalls: number;
}
