import type { GenreSkeleton } from "./types";

export function computeWordBudget(
  skeleton: GenreSkeleton,
  targetWordCount: number,
  syntacticDensityMode: "high" | "medium" | "low",
  burstinessScore: number
): Record<string, number> {
  const adjusted = skeleton.sections.map((section) => {
    let words = section.baseWordCountWeight * targetWordCount;
    if (section.role === "claim" || section.role === "layer") {
      if (syntacticDensityMode === "high" && burstinessScore >= 0.6) {
        words *= 1.15;
      } else if (syntacticDensityMode === "low" && burstinessScore < 0.35) {
        words *= 0.85;
      }
    }
    return { label: section.label, words };
  });

  const adjustedTotal = adjusted.reduce((sum, item) => sum + item.words, 0) || 1;
  const scaled = adjusted.map((item) => ({ label: item.label, words: Math.round((item.words / adjustedTotal) * targetWordCount / 10) * 10 }));
  const roundedTotal = scaled.reduce((sum, item) => sum + item.words, 0);
  const diff = targetWordCount - roundedTotal;
  if (scaled.length && diff !== 0) {
    const target = scaled.reduce((largest, item) => (item.words > largest.words ? item : largest), scaled[0]);
    target.words += diff;
  }
  return Object.fromEntries(scaled.map((item) => [item.label, item.words]));
}

export function resolveSyntacticDensityMode(burstinessScore: number, avgSentenceLength: number): "high" | "medium" | "low" {
  if (burstinessScore >= 0.6 && avgSentenceLength >= 20) {
    return "high";
  }
  if (burstinessScore < 0.35 || avgSentenceLength < 13) {
    return "low";
  }
  return "medium";
}

export function resolveBodyBlockCount(densityMode: "high" | "medium" | "low", evidenceCount: number, skeleton: GenreSkeleton): number {
  const baseBlockCount = skeleton.sections.filter((section) => section.requiresEvidence).length;
  let blockCount = baseBlockCount;
  if (densityMode === "low") {
    blockCount = Math.min(baseBlockCount + 1, evidenceCount, baseBlockCount + 2);
  } else if (densityMode === "high") {
    blockCount = Math.max(baseBlockCount - 1, 2);
  }
  if (evidenceCount > 0) {
    blockCount = Math.min(blockCount, evidenceCount);
  }
  return Math.max(blockCount, 2);
}
