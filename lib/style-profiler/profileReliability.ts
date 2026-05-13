import type { StyleProfile } from "./types";

export interface ProfileReliability {
  schemaVersion: string;
  totalWords: number;
  sampleCount: number;
  domainCoverage: Record<string, number>;
  weakestAreas: string[];
  recommendedMoreSamples: boolean;
  confidenceByCategory: {
    syntax: number;
    lexical: number;
    transitions: number;
    punctuation: number;
    semanticVoice: number;
    domain: number;
  };
}

export function computeProfileReliability(
  profile: Pick<StyleProfile, "globalProfile" | "domainProfiles">,
  sampleCount: number,
  totalWords: number,
  domainCoverage: Record<string, number>
): ProfileReliability {
  const wordCountConfidence = totalWords < 300 ? 0.1 : totalWords >= 3000 ? 1 : 0.1 + ((totalWords - 300) / 2700) * 0.9;
  const sampleCountConfidence = sampleCount <= 0 ? 0 : sampleCount >= 5 ? 1 : sampleCount / 5;
  const base = (wordCountConfidence + sampleCountConfidence) / 2;
  const sentenceCount = profile.globalProfile.sentenceCount;
  const uniqueWordCount = estimateUniqueWordCount(profile, totalWords);
  const transitionTotal = Object.values(profile.globalProfile.transitionFingerprint.transitionFrequencyMap).reduce((sum, count) => sum + count, 0);
  const domainKeys = Object.keys(domainCoverage).filter((domain) => domainCoverage[domain] > 0);

  const confidenceByCategory = {
    syntax: clampRound(base * (sentenceCount > 50 ? 1 : sentenceCount / 50)),
    lexical: clampRound(base * (uniqueWordCount > 500 ? 1 : uniqueWordCount / 500)),
    transitions: clampRound(base * (transitionTotal > 20 ? 1 : transitionTotal / 20)),
    punctuation: clampRound(base * 0.95),
    semanticVoice: clampRound(base * 0.8),
    domain: clampRound(base * Math.min(1, domainKeys.length / 3)),
  };

  const weakestAreas = Object.entries(confidenceByCategory)
    .filter(([, confidence]) => confidence < 0.5)
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([area]) => area);

  return {
    schemaVersion: "1.1.0",
    totalWords,
    sampleCount,
    domainCoverage,
    weakestAreas,
    recommendedMoreSamples: totalWords < 3000 || sampleCount < 5,
    confidenceByCategory,
  };
}

function estimateUniqueWordCount(profile: Pick<StyleProfile, "globalProfile">, totalWords: number): number {
  const typeTokenEstimate = Math.round(profile.globalProfile.lexicalLandscape.typeTokenRatio * totalWords);
  return Math.max(Object.keys(profile.globalProfile.lexicalLandscape.vocabularyFrequencyMap).length, typeTokenEstimate);
}

function clampRound(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}
