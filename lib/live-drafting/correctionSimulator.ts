import { deleteText, insertText } from "./docsApiClient";
import type { ScheduledChunk } from "./types";

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export async function simulateCorrection(
  documentId: string,
  accessToken: string,
  currentIndex: number,
  correctionChunk: ScheduledChunk,
  nextChunk: ScheduledChunk | undefined,
): Promise<number> {
  void nextChunk;

  const deletionStartIndex = Math.max(currentIndex - correctionChunk.text.length, 1);

  await deleteText(documentId, accessToken, deletionStartIndex, currentIndex);
  await sleep(correctionChunk.resolvedDelayMs);
  await insertText(documentId, accessToken, deletionStartIndex, correctionChunk.text);
  await sleep(150);

  return currentIndex;
}
