import { normalizeText } from "./normalizeText";
import { round, splitSentences, standardDeviation, tokenizeWords } from "./sentenceStats";
import { countPhrases } from "./transitionStats";
import { resolveStyleProfileForTask, type WritingDomain } from "./resolveStyleProfileForTask";
import type { StyleProfile } from "./types";

export interface StyleDeltaResult {
  overallSimilarityScore: number;
  sentenceLengthDelta: number;
  burstinessDelta: number;
  lexicalDiversityDelta: number;
  transitionDelta: number;
  punctuationDelta: number;
  hedgeBoostDelta: number;
  passiveVoiceDelta: number;
  firstPersonDelta: number;
  domainVocabularyDelta: number;
  recommendations: string[];
}

const TRANSITIONS = ["however", "therefore", "furthermore", "in contrast", "this suggests", "as a result", "on the other hand", "in light of this"];
const HEDGES = ["might suggest", "could imply", "seems to", "perhaps", "may indicate", "may suggest", "could suggest", "appears to", "likely", "possibly"];
const BOOSTS = ["clearly", "proves", "demonstrates", "undoubtedly", "strongly suggests", "certainly", "definitely", "evidently"];

export function compareDraftToStyleProfile(draftText: string, profile: StyleProfile, targetDomain?: WritingDomain): StyleDeltaResult {
  const draftStats = computeDraftStats(draftText);
  const resolved = resolveStyleProfileForTask(profile, targetDomain);
  const profileStats = {
    avgSentenceLength: numberFrom(resolved.syntax, ["avgWordsPerSentence", "averageSentenceLength"], 15),
    burstiness: numberFrom(resolved.syntax, ["sentenceLengthStdDev", "burstiness", "sentenceLengthStandardDeviation"], 5),
    lexicalDiversity: numberFrom(resolved.lexical, ["typeTokenRatio", "uniqueWordRatio"], 0.5),
    transitionRate: numberFrom(resolved.transitions, ["transitionRate"], 1.5),
    punctuationRate: numberFrom(resolved.punctuation, ["commaSemicolonRate"], 3.0),
    hedgeBoostRatio: numberFrom(resolved.semanticVoice, ["hedgeRatio"], 0.6),
    passiveVoiceRate: numberFrom(resolved.semanticVoice, ["passiveVoiceRate"], 3.0),
    firstPersonRate: numberFrom(resolved.semanticVoice, ["firstPersonRate"], 0),
  };

  const sentenceLengthDelta = pctDelta(draftStats.avgSentenceLength, profileStats.avgSentenceLength);
  const burstinessDelta = pctDelta(draftStats.burstiness, profileStats.burstiness);
  const lexicalDiversityDelta = pctDelta(draftStats.lexicalDiversity, profileStats.lexicalDiversity);
  const transitionDelta = pctDelta(draftStats.transitionRate, profileStats.transitionRate);
  const punctuationDelta = pctDelta(draftStats.punctuationRate, profileStats.punctuationRate);
  const hedgeBoostDelta = pctDelta(draftStats.hedgeBoostRatio, profileStats.hedgeBoostRatio);
  const passiveVoiceDelta = pctDelta(draftStats.passiveVoiceRate, profileStats.passiveVoiceRate);
  const firstPersonDelta = pctDelta(draftStats.firstPersonRate, profileStats.firstPersonRate);
  const domainVocabularyDelta = 0;

  const deltas = [sentenceLengthDelta, burstinessDelta, lexicalDiversityDelta, transitionDelta, punctuationDelta, hedgeBoostDelta, passiveVoiceDelta, firstPersonDelta, domainVocabularyDelta];
  const overallSimilarityScore = Math.round((1 - clamp(deltas.reduce((sum, delta) => sum + Math.abs(delta), 0) / deltas.length, 0, 1)) * 100) / 100;
  const recommendations = buildRecommendations(draftStats, profileStats, {
    sentenceLengthDelta,
    burstinessDelta,
    lexicalDiversityDelta,
    transitionDelta,
    punctuationDelta,
    hedgeBoostDelta,
    passiveVoiceDelta,
  });

  return {
    overallSimilarityScore,
    sentenceLengthDelta,
    burstinessDelta,
    lexicalDiversityDelta,
    transitionDelta,
    punctuationDelta,
    hedgeBoostDelta,
    passiveVoiceDelta,
    firstPersonDelta,
    domainVocabularyDelta,
    recommendations,
  };
}

function computeDraftStats(draftText: string) {
  const text = normalizeText(draftText);
  const sentences = splitSentences(text);
  const words = tokenizeWords(text);
  const sentenceLengths = sentences.map((sentence) => tokenizeWords(sentence).length);
  const totalWords = Math.max(words.length, 1);
  const hedgeCount = Object.values(countPhrases(text, HEDGES)).reduce((sum, count) => sum + count, 0);
  const boostCount = Object.values(countPhrases(text, BOOSTS)).reduce((sum, count) => sum + count, 0);
  const transitionCount = Object.values(countPhrases(text, TRANSITIONS)).reduce((sum, count) => sum + count, 0);
  const commas = text.match(/,/g)?.length ?? 0;
  const semicolons = text.match(/;/g)?.length ?? 0;

  return {
    avgSentenceLength: sentenceLengths.length ? sentenceLengths.reduce((sum, length) => sum + length, 0) / sentenceLengths.length : 0,
    burstiness: standardDeviation(sentenceLengths),
    lexicalDiversity: words.length ? new Set(words).size / words.length : 0,
    transitionRate: (transitionCount / totalWords) * 100,
    punctuationRate: ((commas + semicolons) / totalWords) * 100,
    hedgeBoostRatio: hedgeCount + boostCount > 0 ? hedgeCount / (hedgeCount + boostCount) : 0.5,
    passiveVoiceRate: ((text.match(/\b(am|is|are|was|were|be|been|being)\s+(?:\w+\s+){0,2}\w+(ed|en)\b/gi)?.length ?? 0) / totalWords) * 100,
    firstPersonRate: ((text.match(/\b(i|me|my|mine|we|our|us)\b/gi)?.length ?? 0) / totalWords) * 100,
  };
}

function buildRecommendations(
  draft: ReturnType<typeof computeDraftStats>,
  profile: {
    avgSentenceLength: number;
    burstiness: number;
    lexicalDiversity: number;
    transitionRate: number;
    punctuationRate: number;
    hedgeBoostRatio: number;
    passiveVoiceRate: number;
    firstPersonRate: number;
  },
  deltas: Pick<StyleDeltaResult, "sentenceLengthDelta" | "burstinessDelta" | "lexicalDiversityDelta" | "transitionDelta" | "punctuationDelta" | "hedgeBoostDelta" | "passiveVoiceDelta">
): string[] {
  const recommendations: string[] = [];
  if (Math.abs(deltas.sentenceLengthDelta) > 0.2) {
    recommendations.push(`Draft average sentence length (${round(draft.avgSentenceLength, 2)}) differs from your profile average (${round(profile.avgSentenceLength, 2)}).`);
  }
  if (deltas.burstinessDelta < -0.3) {
    recommendations.push("Draft sentence lengths are too uniform compared with your profile. Mix short and long sentences.");
  }
  if (deltas.burstinessDelta > 0.3) {
    recommendations.push("Draft sentence lengths are more erratic than your profile.");
  }
  if (deltas.lexicalDiversityDelta < -0.15) {
    recommendations.push("Use more varied vocabulary to better match your writing profile.");
  }
  if (deltas.transitionDelta < -0.3) {
    recommendations.push("Add more transitions between ideas to match your usual connective style.");
  }
  if (deltas.transitionDelta > 0.3) {
    recommendations.push("Trim transitions so the draft does not feel more signposted than your profile.");
  }
  if (Math.abs(deltas.punctuationDelta) > 0.35) {
    recommendations.push(`Comma/semicolon density differs from your profile (${round(draft.punctuationRate, 2)} vs ${round(profile.punctuationRate, 2)} per 100 words).`);
  }
  if (deltas.hedgeBoostDelta > 0.25) {
    recommendations.push("Draft uses more assertive boost phrases than your profile.");
  }
  if (deltas.hedgeBoostDelta < -0.25) {
    recommendations.push("Draft hedges more than your profile.");
  }
  if (deltas.passiveVoiceDelta > 0.4 && draft.passiveVoiceRate > 5) {
    recommendations.push("Reduce passive constructions and use more active phrasing.");
  }
  if (!recommendations.length) {
    recommendations.push("Draft stylistic profile closely matches your writing baseline. No major adjustments needed.");
  }
  return recommendations;
}

function numberFrom(source: Record<string, unknown>, keys: string[], fallback: number): number {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return fallback;
}

function pctDelta(draftValue: number, profileValue: number): number {
  if (profileValue === 0) {
    return 0;
  }
  return Math.round(((draftValue - profileValue) / profileValue) * 1000) / 1000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
