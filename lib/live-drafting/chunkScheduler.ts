import type { GeneratedSection } from "../generation";
import type { DocsSessionConfig, ScheduledChunk } from "./types";

function resolveConfig(config: DocsSessionConfig): DocsSessionConfig {
  return {
    ...config,
    interChunkDelayMs: config.interChunkDelayMs ?? 180,
    pauseJitterMs: config.pauseJitterMs ?? 200,
    correctionEnabled: config.correctionEnabled ?? true,
    sectionBreakStyle: config.sectionBreakStyle ?? "doubleNewline",
  };
}

function deterministicJitter(seed: number, maximum: number): number {
  if (maximum <= 0) {
    return 0;
  }

  return (seed * 37 + 17) % (maximum + 1);
}

function resolveDelayMs(
  baseDelayMs: number,
  globalChunkIndex: number,
  isPause: boolean,
  isCorrection: boolean,
  config: DocsSessionConfig,
): number {
  if (isCorrection) {
    return baseDelayMs;
  }

  if (isPause) {
    return baseDelayMs + deterministicJitter(globalChunkIndex, config.pauseJitterMs);
  }

  return baseDelayMs + config.interChunkDelayMs + deterministicJitter(globalChunkIndex, 40);
}

function createScheduledChunk(
  globalChunkIndex: number,
  section: GeneratedSection,
  text: string,
  delayMs: number,
  isPause: boolean,
  isCorrection: boolean,
  isSectionBreak: boolean,
  config: DocsSessionConfig,
): ScheduledChunk {
  return {
    globalChunkIndex,
    sectionIndex: section.sectionIndex,
    sectionLabel: section.label,
    text,
    resolvedDelayMs: isSectionBreak
      ? delayMs
      : resolveDelayMs(delayMs, globalChunkIndex, isPause, isCorrection, config),
    isPause,
    isCorrection,
    isSectionBreak,
  };
}

export function scheduleChunks(sections: GeneratedSection[], config: DocsSessionConfig): ScheduledChunk[] {
  const resolvedConfig = resolveConfig(config);
  const scheduledChunks: ScheduledChunk[] = [];

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const section = sections[sectionIndex];

    for (const chunk of section.draftChunks) {
      if (!resolvedConfig.correctionEnabled && chunk.isCorrection) {
        continue;
      }

      scheduledChunks.push(
        createScheduledChunk(
          scheduledChunks.length,
          section,
          chunk.text,
          chunk.delayMs,
          chunk.isPause,
          chunk.isCorrection,
          false,
          resolvedConfig,
        ),
      );
    }

    if (sectionIndex < sections.length - 1) {
      scheduledChunks.push(
        createScheduledChunk(
          scheduledChunks.length,
          section,
          resolvedConfig.sectionBreakStyle === "doubleNewline" ? "\n\n" : "\n",
          600,
          false,
          false,
          true,
          resolvedConfig,
        ),
      );
    }
  }

  return scheduledChunks;
}

export function computeTotalEstimatedDurationMs(chunks: ScheduledChunk[]): number {
  return chunks.reduce((total, chunk) => total + chunk.resolvedDelayMs, 0);
}
