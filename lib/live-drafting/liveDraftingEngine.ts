import { scheduleChunks } from "./chunkScheduler";
import { simulateCorrection } from "./correctionSimulator";
import { getDocumentEndIndex, insertText } from "./docsApiClient";
import type { DocsSessionConfig, DraftingSessionState, LiveDraftingInput, LiveDraftingResult } from "./types";

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function djb2Hash(value: string): string {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

function createSessionId(documentId: string, draftId: string): string {
  return `live-drafting-${djb2Hash(`${documentId}:${draftId}`)}`;
}

function normalizeConfig(config: DocsSessionConfig): DocsSessionConfig {
  return {
    ...config,
    insertionIndex: config.insertionIndex ?? 0,
    interChunkDelayMs: config.interChunkDelayMs ?? 180,
    pauseJitterMs: config.pauseJitterMs ?? 200,
    correctionEnabled: config.correctionEnabled ?? true,
    sectionBreakStyle: config.sectionBreakStyle ?? "doubleNewline",
  };
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runLiveDrafting(input: LiveDraftingInput): Promise<LiveDraftingResult> {
  const config = normalizeConfig(input.config);
  const state: DraftingSessionState = {
    sessionId: createSessionId(config.documentId, input.draft.draftId),
    documentId: config.documentId,
    status: "idle",
    totalChunks: 0,
    chunksProcessed: 0,
    currentSectionIndex: 0,
    currentSectionLabel: "",
    charactersInserted: 0,
    startedAt: null,
    completedAt: null,
    errors: [],
  };

  let insertionIndex = config.insertionIndex;

  if (!insertionIndex || insertionIndex === 0) {
    insertionIndex = await getDocumentEndIndex(config.documentId, config.accessToken);
  }

  const scheduledChunks = scheduleChunks(input.draft.sections, config);
  let currentIndex = insertionIndex;
  let totalApiCalls = 0;

  state.totalChunks = scheduledChunks.length;
  state.startedAt = new Date().toISOString();
  state.status = "running";

  for (let index = 0; index < scheduledChunks.length; index += 1) {
    const chunk = scheduledChunks[index];
    state.currentSectionIndex = chunk.sectionIndex;
    state.currentSectionLabel = chunk.sectionLabel;

    if (chunk.isPause) {
      await sleep(chunk.resolvedDelayMs);
      state.chunksProcessed += 1;
      continue;
    }

    if (chunk.isCorrection) {
      try {
        await simulateCorrection(config.documentId, config.accessToken, currentIndex, chunk, scheduledChunks[index + 1]);
        totalApiCalls += 2;
      } catch (error) {
        state.errors.push(stringifyError(error));
      }

      state.chunksProcessed += 1;
      continue;
    }

    await sleep(chunk.resolvedDelayMs);

    try {
      const result = await insertText(config.documentId, config.accessToken, currentIndex, chunk.text);
      currentIndex = result.updatedIndex;
      state.charactersInserted += chunk.text.length;
      totalApiCalls += 1;
    } catch (error) {
      state.errors.push(stringifyError(error));

      if (state.errors.length >= 5) {
        state.status = "failed";
        state.chunksProcessed += 1;
        break;
      }
    }

    state.chunksProcessed += 1;
  }

  if (state.status !== "failed") {
    state.status = "completed";
  }

  state.completedAt = new Date().toISOString();

  return {
    sessionState: state,
    totalCharactersInserted: state.charactersInserted,
    totalApiCalls,
    errors: state.errors,
  };
}
