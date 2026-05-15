import type { FormattedCitation } from "../../../lib/citation-manager";
import type { EssayPlan, EvidenceNode } from "../../../lib/essay-planner";
import type { GeneratedDraft } from "../../../lib/generation";
import type { ReviewerNotes } from "../../../lib/reviewer-notes";

export type ViewName = "home" | "evidence" | "plan" | "draft" | "reviewerNotes" | "citations";

export type AppStatus = "idle" | "loading" | "success" | "error";

export interface EssayTypeOption {
  value: "argumentative" | "expository" | "analytical" | "compareContrast" | "personalStatement";
  label: string;
}

export interface PopupConfig {
  essayType: EssayTypeOption["value"];
  targetWordCount: number;
  citationFormat: "mla" | "apa";
}

export interface AppState {
  currentView: ViewName;
  status: AppStatus;
  errorMessage: string | null;
  config: PopupConfig;
  documentText: string | null;
  evidenceNodes: EvidenceNode[];
  essayPlan: EssayPlan | null;
  generatedDraft: GeneratedDraft | null;
  reviewerNotes: ReviewerNotes | null;
  citations: FormattedCitation[];
}

export type PopupMessage =
  | { type: "VERITON_GET_DOC_TEXT" }
  | { type: "VERITON_DOC_TEXT_RESPONSE"; text: string }
  | { type: "VERITON_INSERT_INLINE"; text: string }
  | { type: "VERITON_INSERT_WORKS_CITED"; text: string }
  | { type: "VERITON_START_LIVE_DRAFT"; draftText: string };
