export type ContentMessage =
  | { type: "VERITON_GET_DOC_TEXT" }
  | { type: "VERITON_INSERT_INLINE"; text: string }
  | { type: "VERITON_INSERT_WORKS_CITED"; text: string }
  | { type: "VERITON_START_LIVE_DRAFT"; chunks: SerializedChunk[] };

export interface SerializedChunk {
  text: string;
  delayMs: number;
  isPause: boolean;
  isCorrection: boolean;
}

export interface DocReadResult {
  text: string;
  wordCount: number;
  success: boolean;
  error?: string;
}

export interface DocWriteResult {
  success: boolean;
  charactersInserted: number;
  error?: string;
}

export interface PlaybackState {
  isPlaying: boolean;
  totalChunks: number;
  chunksProcessed: number;
  charactersInserted: number;
}
