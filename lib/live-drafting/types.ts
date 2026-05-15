import type { GeneratedDraft, GeneratedSection } from "../generation";

export interface DocsSessionConfig {
  documentId: string;
  accessToken: string;
  insertionIndex: number;
  interChunkDelayMs: number;
  pauseJitterMs: number;
  correctionEnabled: boolean;
  sectionBreakStyle: "newline" | "doubleNewline";
}

export type DraftingSessionStatus = "idle" | "running" | "paused" | "completed" | "failed";

export interface DraftingSessionState {
  sessionId: string;
  documentId: string;
  status: DraftingSessionStatus;
  totalChunks: number;
  chunksProcessed: number;
  currentSectionIndex: number;
  currentSectionLabel: string;
  charactersInserted: number;
  startedAt: string | null;
  completedAt: string | null;
  errors: string[];
}

export interface DocsInsertRequest {
  requests: Array<{
    insertText: {
      location: { index: number };
      text: string;
    };
  }>;
}

export interface DocsDeleteRequest {
  requests: Array<{
    deleteContentRange: {
      range: {
        startIndex: number;
        endIndex: number;
      };
    };
  }>;
}

export interface LiveDraftingInput {
  draft: GeneratedDraft;
  config: DocsSessionConfig;
}

export interface LiveDraftingResult {
  sessionState: DraftingSessionState;
  totalCharactersInserted: number;
  totalApiCalls: number;
  errors: string[];
}

export interface ScheduledChunk {
  globalChunkIndex: number;
  sectionIndex: number;
  sectionLabel: string;
  text: string;
  resolvedDelayMs: number;
  isPause: boolean;
  isCorrection: boolean;
  isSectionBreak: boolean;
}

export type { GeneratedSection };
