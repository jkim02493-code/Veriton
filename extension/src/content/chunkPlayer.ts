import { focusEditor, insertTextAtCaret, moveCaretToEnd } from "./docWriter";
import type { PlaybackState, SerializedChunk } from "./types";

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function initialPlaybackState(): PlaybackState {
  return {
    isPlaying: false,
    totalChunks: 0,
    chunksProcessed: 0,
    charactersInserted: 0,
  };
}

function dispatchBackspace(): void {
  const event = new KeyboardEvent("keydown", {
    key: "Backspace",
    code: "Backspace",
    bubbles: true,
  });
  (document.activeElement ?? document.body).dispatchEvent(event);
}

export class ChunkPlayer {
  private state: PlaybackState;
  private aborted: boolean;

  constructor() {
    this.state = initialPlaybackState();
    this.aborted = false;
  }

  getState(): PlaybackState {
    return { ...this.state };
  }

  abort(): void {
    this.aborted = true;
  }

  async play(chunks: SerializedChunk[]): Promise<PlaybackState> {
    this.aborted = false;
    this.state = {
      isPlaying: true,
      totalChunks: chunks.length,
      chunksProcessed: 0,
      charactersInserted: 0,
    };

    focusEditor();
    moveCaretToEnd();

    for (const chunk of chunks) {
      if (this.aborted) {
        break;
      }

      if (chunk.isPause) {
        await wait(chunk.delayMs);
        this.state.chunksProcessed += 1;
        continue;
      }

      if (chunk.isCorrection) {
        for (let index = 0; index < chunk.text.length; index += 1) {
          dispatchBackspace();
        }
        await wait(chunk.delayMs);
        insertTextAtCaret(chunk.text);
        await wait(150);
        this.state.chunksProcessed += 1;
        continue;
      }

      await wait(chunk.delayMs);
      const result = insertTextAtCaret(chunk.text);
      if (result.success) {
        this.state.charactersInserted += chunk.text.length;
      }
      this.state.chunksProcessed += 1;
    }

    this.state.isPlaying = false;
    return this.getState();
  }
}
