import { round } from "./sentenceStats";

export function calculateConfidence(totalWordCount: number, sampleCount: number): { confidence: number; warnings: string[] } {
  const warnings: string[] = [];
  let confidence = 0.35;

  if (totalWordCount < 500) {
    warnings.push("Total writing sample is under 500 words; style profile confidence is low.");
    confidence = 0.25;
  } else if (totalWordCount < 1500) {
    warnings.push("More writing would improve this profile; stronger confidence starts above 1500 words.");
    confidence = 0.55;
  } else if (totalWordCount < 3000) {
    confidence = 0.75;
  } else {
    confidence = sampleCount >= 3 ? 0.92 : 0.84;
  }

  if (sampleCount < 3) {
    warnings.push("Use 3 or more writing samples for the most stable profile.");
    confidence -= 0.05;
  }

  return { confidence: round(Math.max(0.1, Math.min(confidence, 0.95)), 3), warnings };
}
