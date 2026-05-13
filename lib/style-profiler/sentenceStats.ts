import type { FrequencyMap, NumericDistribution, SyntacticFingerprint } from "./types";

const SUBORDINATE_MARKERS = [
  "although",
  "because",
  "since",
  "while",
  "whereas",
  "when",
  "whenever",
  "if",
  "unless",
  "which",
  "that",
  "who",
  "whom",
  "whose",
  "after",
  "before",
  "despite",
];

const COORDINATE_MARKERS = ["and", "but", "or", "nor", "for", "so", "yet"];

export function tokenizeWords(text: string): string[] {
  return text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
}

export function splitSentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [])
    .map((sentence) => sentence.trim())
    .filter((sentence) => tokenizeWords(sentence).length > 0);
}

export function round(value: number, places = 3): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function median(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function standardDeviation(values: number[]): number {
  if (values.length <= 1) {
    return 0;
  }
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function topFrequencyMap(entries: string[], limit = 12): FrequencyMap {
  const counts: FrequencyMap = {};
  for (const entry of entries) {
    const normalized = entry.trim().toLowerCase();
    if (normalized) {
      counts[normalized] = (counts[normalized] ?? 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit));
}

export function bucketDistribution(values: number[], buckets: Array<[string, number, number]>): NumericDistribution {
  const distribution: NumericDistribution = Object.fromEntries(buckets.map(([label]) => [label, 0]));
  for (const value of values) {
    const bucket = buckets.find(([, min, max]) => value >= min && value <= max);
    if (bucket) {
      distribution[bucket[0]] += 1;
    }
  }
  return distribution;
}

export function buildSentenceStats(text: string, paragraphs: string[]): SyntacticFingerprint {
  const sentences = splitSentences(text);
  const sentenceLengths = sentences.map((sentence) => tokenizeWords(sentence).length);
  const sentenceCount = Math.max(sentences.length, 1);
  const averageSentenceLength = sentenceLengths.reduce((sum, length) => sum + length, 0) / sentenceCount;
  const sentenceStdDev = standardDeviation(sentenceLengths);
  const shortMediumLong = sentenceLengths.map((length) => {
    if (length <= 10) {
      return "short";
    }
    if (length >= 24) {
      return "long";
    }
    return "medium";
  });

  const subordinateCount = countMarkers(text, SUBORDINATE_MARKERS);
  const coordinateCount = countCoordinateClauses(sentences);
  const passiveCount = countPassiveVoice(sentences);
  const complexCount = sentences.filter((sentence) => containsMarker(sentence, SUBORDINATE_MARKERS) || /[;:]/.test(sentence)).length;
  const compoundCount = sentences.filter((sentence) => /,\s+(and|but|or|so|yet)\s+/i.test(sentence)).length;
  const simpleCount = Math.max(sentences.length - complexCount - compoundCount, 0);
  const openers = sentences.map((sentence) => tokenizeWords(sentence).slice(0, 3).join(" ")).filter(Boolean);
  const closers = sentences.map((sentence) => tokenizeWords(sentence).slice(-3).join(" ")).filter(Boolean);
  const paragraphLengths = paragraphs.map((paragraph) => tokenizeWords(paragraph).length).filter((length) => length > 0);

  return {
    averageSentenceLength: round(averageSentenceLength, 2),
    medianSentenceLength: round(median(sentenceLengths), 2),
    sentenceLengthStandardDeviation: round(sentenceStdDev, 2),
    sentenceLengthDistribution: bucketDistribution(sentenceLengths, [
      ["1-8", 1, 8],
      ["9-14", 9, 14],
      ["15-22", 15, 22],
      ["23-32", 23, 32],
      ["33+", 33, Number.MAX_SAFE_INTEGER],
    ]),
    burstinessScore: averageSentenceLength ? round(sentenceStdDev / averageSentenceLength, 3) : 0,
    shortToLongSentencePattern: shortMediumLong.slice(0, 40).join(" -> "),
    paragraphLengthDistribution: bucketDistribution(paragraphLengths, [
      ["1-50", 1, 50],
      ["51-100", 51, 100],
      ["101-175", 101, 175],
      ["176-250", 176, 250],
      ["251+", 251, Number.MAX_SAFE_INTEGER],
    ]),
    clausalDensityEstimate: round((subordinateCount + coordinateCount) / sentenceCount, 3),
    subordinateClauseFrequency: round(subordinateCount / sentenceCount, 3),
    coordinateClauseFrequency: round(coordinateCount / sentenceCount, 3),
    passiveVoiceEstimate: round(passiveCount / sentenceCount, 3),
    activeVoiceEstimate: round(Math.max(sentenceCount - passiveCount, 0) / sentenceCount, 3),
    commonSentenceOpeners: topFrequencyMap(openers, 10),
    commonSentenceClosers: topFrequencyMap(closers, 10),
    gerundOpeningFrequency: round(sentences.filter((sentence) => /^[\s"']*[a-z]+ing\b/i.test(sentence)).length / sentenceCount, 3),
    complexSentenceRatio: round(complexCount / sentenceCount, 3),
    simpleSentenceRatio: round(simpleCount / sentenceCount, 3),
    compoundSentenceRatio: round(compoundCount / sentenceCount, 3),
  };
}

function countMarkers(text: string, markers: string[]): number {
  return markers.reduce((sum, marker) => sum + (text.match(new RegExp(`\\b${escapeRegex(marker)}\\b`, "gi"))?.length ?? 0), 0);
}

function countCoordinateClauses(sentences: string[]): number {
  return sentences.reduce((sum, sentence) => sum + (sentence.match(/,\s+(and|but|or|nor|for|so|yet)\s+/gi)?.length ?? 0), 0);
}

function countPassiveVoice(sentences: string[]): number {
  return sentences.filter((sentence) => /\b(am|is|are|was|were|be|been|being)\s+(?:\w+\s+){0,2}\w+(ed|en)\b/i.test(sentence)).length;
}

function containsMarker(text: string, markers: string[]): boolean {
  return markers.some((marker) => new RegExp(`\\b${escapeRegex(marker)}\\b`, "i").test(text));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
