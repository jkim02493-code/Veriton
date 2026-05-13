import type { ArgumentativeStance, SemanticVoiceProfile } from "./types";
import { round, splitSentences, tokenizeWords } from "./sentenceStats";
import { countPhrases } from "./transitionStats";

const HEDGE_PHRASES = ["might suggest", "could imply", "seems to", "perhaps", "may indicate", "may suggest", "could suggest", "appears to", "likely", "possibly"];
const BOOST_PHRASES = ["clearly", "proves", "demonstrates", "undoubtedly", "strongly suggests", "certainly", "definitely", "evidently"];
const COUNTER_ARGUMENTS = ["however", "although", "on the other hand", "critics argue", "some may argue", "despite this", "nevertheless"];
const EVIDENCE_PHRASES = ["according to", "for example", "the evidence", "research suggests", "data shows", "as shown"];
const EXPLANATION_PHRASES = ["because", "therefore", "this suggests", "this means", "as a result", "in other words"];

export function buildSemanticVoiceStats(text: string): SemanticVoiceProfile {
  const sentences = splitSentences(text);
  const words = Math.max(tokenizeWords(text).length, 1);
  const hedgePhraseFrequency = countPhrases(text, HEDGE_PHRASES);
  const boostPhraseFrequency = countPhrases(text, BOOST_PHRASES);
  const hedgeCount = Object.values(hedgePhraseFrequency).reduce((sum, count) => sum + count, 0);
  const boostCount = Object.values(boostPhraseFrequency).reduce((sum, count) => sum + count, 0);
  const counterargumentCount = Object.values(countPhrases(text, COUNTER_ARGUMENTS)).reduce((sum, count) => sum + count, 0);
  const explanationCount = Object.values(countPhrases(text, EXPLANATION_PHRASES)).reduce((sum, count) => sum + count, 0);

  return {
    hedgePhraseFrequency,
    boostPhraseFrequency,
    hedgeToBoostRatio: round(hedgeCount / Math.max(boostCount, 1), 3),
    certaintyLevel: estimateCertainty(hedgeCount, boostCount, sentences.length),
    argumentativeStance: inferStance(text, hedgeCount, boostCount, counterargumentCount),
    thesisDirectnessScore: estimateThesisDirectness(text),
    counterargumentFrequency: round(counterargumentCount / Math.max(sentences.length, 1), 3),
    evidenceIntegrationStyle: inferEvidenceStyle(text),
    explanationDepthEstimate: round(Math.min(explanationCount / Math.max(sentences.length, 1), 1), 3),
    firstPersonUsageFrequency: round((text.match(/\b(i|me|my|mine|we|our|us)\b/gi)?.length ?? 0) / words, 3),
    rhetoricalQuestionFrequency: round(sentences.filter((sentence) => sentence.trim().endsWith("?")).length / Math.max(sentences.length, 1), 3),
  };
}

function estimateCertainty(hedgeCount: number, boostCount: number, sentenceCount: number): number {
  const baseline = 0.5;
  const boost = boostCount / Math.max(sentenceCount, 1);
  const hedge = hedgeCount / Math.max(sentenceCount, 1);
  return round(Math.max(0, Math.min(1, baseline + boost * 0.35 - hedge * 0.25)), 3);
}

function inferStance(text: string, hedgeCount: number, boostCount: number, counterargumentCount: number): ArgumentativeStance {
  const lower = text.toLowerCase();
  if (counterargumentCount >= 3 || (hedgeCount > 0 && boostCount > 0)) {
    return "balanced";
  }
  if (boostCount > hedgeCount + 1) {
    return "assertive";
  }
  if (hedgeCount > boostCount + 1 || /\b(perhaps|question|possibility|explore)\b/.test(lower)) {
    return "exploratory";
  }
  if (/\b(analysis|evidence|indicates|suggests|therefore|because)\b/.test(lower)) {
    return "analytical";
  }
  return "descriptive";
}

function estimateThesisDirectness(text: string): number {
  const firstChunk = text.split(/\n{2,}/).slice(0, 2).join(" ").toLowerCase();
  let score = 0;
  if (/\b(i argue|this essay argues|this paper argues|the central claim|my argument)\b/.test(firstChunk)) {
    score += 0.7;
  }
  if (/\b(because|therefore|demonstrates|suggests|shows)\b/.test(firstChunk)) {
    score += 0.2;
  }
  if (firstChunk.length > 80) {
    score += 0.1;
  }
  return round(Math.min(score, 1), 3);
}

function inferEvidenceStyle(text: string): string {
  const evidenceCount = Object.values(countPhrases(text, EVIDENCE_PHRASES)).reduce((sum, count) => sum + count, 0);
  const quoteCount = text.match(/"[^"]{20,}"/g)?.length ?? 0;
  if (quoteCount > evidenceCount) {
    return "quote-led";
  }
  if (evidenceCount >= 3) {
    return "integrated evidence framing";
  }
  if (evidenceCount > 0) {
    return "light evidence framing";
  }
  return "claim-led";
}
