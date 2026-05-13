import { splitSentences } from "./sentenceStats";

export interface PhraseFingerprint {
  commonBigrams: Array<{ phrase: string; count: number }>;
  commonTrigrams: Array<{ phrase: string; count: number }>;
  commonFourgrams: Array<{ phrase: string; count: number }>;
  repeatedAcademicPhrases: Array<{ phrase: string; count: number }>;
  repeatedSentenceFrames: Array<{ frame: string; count: number }>;
}

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "it",
  "its",
  "this",
  "that",
  "these",
  "those",
]);

const ACADEMIC_PHRASE_SEEDS = [
  "however",
  "therefore",
  "furthermore",
  "in contrast",
  "this suggests",
  "as a result",
  "on the other hand",
  "in light of this",
  "for example",
  "for instance",
  "according to",
  "research suggests",
  "the evidence shows",
  "this indicates",
  "in other words",
  "some may argue",
  "critics argue",
];

export function buildPhraseFingerprint(normalizedText: string): PhraseFingerprint {
  const tokens = tokenize(normalizedText);
  return {
    commonBigrams: topRepeatedNgrams(tokens, 2, 20),
    commonTrigrams: topRepeatedNgrams(tokens, 3, 15),
    commonFourgrams: topRepeatedNgrams(tokens, 4, 10),
    repeatedAcademicPhrases: countAcademicPhrases(normalizedText),
    repeatedSentenceFrames: buildSentenceFrames(normalizedText),
  };
}

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

function topRepeatedNgrams(tokens: string[], size: number, limit: number): Array<{ phrase: string; count: number }> {
  const counts = new Map<string, number>();
  for (let index = 0; index <= tokens.length - size; index += 1) {
    const words = tokens.slice(index, index + size);
    if (words.every((word) => STOP_WORDS.has(word))) {
      continue;
    }
    const phrase = words.join(" ");
    if (phrase.length >= 60) {
      continue;
    }
    counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([phrase, count]) => ({ phrase, count }));
}

function countAcademicPhrases(text: string): Array<{ phrase: string; count: number }> {
  return ACADEMIC_PHRASE_SEEDS.map((phrase) => ({
    phrase,
    count: text.match(new RegExp(`\\b${escapeRegex(phrase)}\\b`, "gi"))?.length ?? 0,
  }))
    .filter(({ phrase, count }) => count >= 2 && phrase.length < 60)
    .sort((a, b) => b.count - a.count || a.phrase.localeCompare(b.phrase))
    .slice(0, 15);
}

function buildSentenceFrames(text: string): Array<{ frame: string; count: number }> {
  const counts = new Map<string, number>();
  for (const sentence of splitSentences(text)) {
    const contentWords = tokenize(sentence).filter((word) => !STOP_WORDS.has(word)).slice(0, 3);
    if (contentWords.length < 2) {
      continue;
    }
    const frame = `${contentWords.join(" ")} ...`;
    if (frame.length < 60) {
      counts.set(frame, (counts.get(frame) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([frame, count]) => ({ frame, count }));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
