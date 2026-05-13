import type { FrequencyMap, PunctuationHabits, SpellingVariantPreference } from "./types";
import { round, splitSentences, tokenizeWords } from "./sentenceStats";

const US_UK_PAIRS: Array<[string, string]> = [
  ["analyze", "analyse"],
  ["behavior", "behaviour"],
  ["color", "colour"],
  ["center", "centre"],
  ["defense", "defence"],
  ["organize", "organise"],
  ["theater", "theatre"],
];

export function buildPunctuationStats(text: string): PunctuationHabits {
  const words = Math.max(tokenizeWords(text).length, 1);
  const sentences = Math.max(splitSentences(text).length, 1);
  const punctuationFrequencyMap = countPunctuation(text);
  const punctuationTotal = Object.values(punctuationFrequencyMap).reduce((sum, count) => sum + count, 0);

  return {
    punctuationFrequencyMap,
    commaDensity: per100(punctuationFrequencyMap[","] ?? 0, words),
    semicolonDensity: per100(punctuationFrequencyMap[";"] ?? 0, words),
    colonDensity: per100(punctuationFrequencyMap[":"] ?? 0, words),
    dashDensity: per100((punctuationFrequencyMap["-"] ?? 0) + (punctuationFrequencyMap["--"] ?? 0), words),
    parenthesisDensity: per100((punctuationFrequencyMap["("] ?? 0) + (punctuationFrequencyMap[")"] ?? 0), words),
    quoteUsageFrequency: per100((punctuationFrequencyMap["\""] ?? 0) + (punctuationFrequencyMap["'"] ?? 0), words),
    oxfordCommaEstimate: estimateOxfordComma(text),
    averagePunctuationPerSentence: round(punctuationTotal / sentences, 3),
    typoPatterns: {},
    spellingVariantPreference: detectSpellingVariant(text),
  };
}

function countPunctuation(text: string): FrequencyMap {
  const result: FrequencyMap = {};
  const matches = text.match(/--|[.,;:!?()[\]"'-]/g) ?? [];
  for (const mark of matches) {
    result[mark] = (result[mark] ?? 0) + 1;
  }
  return result;
}

function per100(count: number, words: number): number {
  return round((count / words) * 100, 3);
}

function estimateOxfordComma(text: string): number {
  const oxford = text.match(/\b\w+,\s+\w+,\s+(and|or)\s+\w+/gi)?.length ?? 0;
  const noOxford = text.match(/\b\w+,\s+\w+\s+(and|or)\s+\w+/gi)?.length ?? 0;
  const total = oxford + noOxford;
  return total ? round(oxford / total, 3) : 0;
}

function detectSpellingVariant(text: string): SpellingVariantPreference {
  const words = new Set(tokenizeWords(text));
  let us = 0;
  let uk = 0;
  for (const [usWord, ukWord] of US_UK_PAIRS) {
    if (words.has(usWord)) {
      us += 1;
    }
    if (words.has(ukWord)) {
      uk += 1;
    }
  }
  if (us > 0 && uk > 0) {
    return "mixed";
  }
  if (us > 0) {
    return "US";
  }
  if (uk > 0) {
    return "UK";
  }
  return "unknown";
}
