import type { KeyClaim, KeyTerm } from "./types";

const CLAIM_SIGNALS = [
  "argues",
  "demonstrates",
  "shows",
  "proves",
  "suggests",
  "indicates",
  "therefore",
  "thus",
  "consequently",
  "this means",
  "this shows",
  "evidence shows",
  "research shows",
];

const STRONG_SIGNALS = ["proves", "demonstrates", "clearly"];
const WEAK_SIGNALS = ["may", "might", "possibly", "suggests"];

function splitIntoSentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [])
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function trimClaimText(sentence: string): string {
  return sentence.length <= 200 ? sentence : `${sentence.slice(0, 197).trimEnd()}...`;
}

function resolveClaimStrength(sentence: string): KeyClaim["claimStrength"] {
  const lowerSentence = sentence.toLowerCase();

  if (STRONG_SIGNALS.some((signal) => lowerSentence.includes(signal))) {
    return "strong";
  }

  if (WEAK_SIGNALS.some((signal) => lowerSentence.includes(signal))) {
    return "weak";
  }

  return "moderate";
}

export function extractKeyClaims(sectionText: string, citationsUsed: string[]): KeyClaim[] {
  const sentences = splitIntoSentences(sectionText);
  const supportingSource = citationsUsed[0] ?? "No citation";
  const claimSentences = sentences.filter((sentence) => {
    const lowerSentence = sentence.toLowerCase();

    return CLAIM_SIGNALS.some((signal) => lowerSentence.includes(signal));
  });
  const selectedSentences = claimSentences.length > 0 ? claimSentences.slice(0, 3) : sentences.slice(0, 1);

  return selectedSentences.map((sentence) => ({
    claimText: trimClaimText(sentence),
    supportingSource,
    claimStrength: claimSentences.length > 0 ? resolveClaimStrength(sentence) : "moderate",
  }));
}

function normaliseTerm(term: string): string {
  return term.replace(/\s+/g, " ").trim();
}

function addFrequency(frequencies: Map<string, number>, term: string): void {
  const normalisedTerm = normaliseTerm(term);

  if (normalisedTerm.length > 0) {
    frequencies.set(normalisedTerm, (frequencies.get(normalisedTerm) ?? 0) + 1);
  }
}

export function extractKeyTerms(sectionText: string): KeyTerm[] {
  const frequencies = new Map<string, number>();
  const capitalisedPhrasePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g;
  const capitalisedMatches = sectionText.matchAll(capitalisedPhrasePattern);

  for (const match of capitalisedMatches) {
    const matchIndex = match.index ?? 0;
    const prefix = sectionText.slice(0, matchIndex).trimEnd();
    const startsSentence = prefix.length === 0 || /[.!?]$/.test(prefix);

    if (!startsSentence) {
      addFrequency(frequencies, match[0]);
    }
  }

  const wordMatches = sectionText.toLowerCase().match(/\b[a-z]{10,}\b/g) ?? [];
  const longWordCounts = new Map<string, number>();

  for (const word of wordMatches) {
    longWordCounts.set(word, (longWordCounts.get(word) ?? 0) + 1);
  }

  for (const [word, count] of longWordCounts.entries()) {
    if (count > 1) {
      addFrequency(frequencies, word);
    }
  }

  return [...frequencies.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0]);
    })
    .slice(0, 4)
    .map(([term]) => ({
      term,
      definition: "",
    }));
}
