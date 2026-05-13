import type { StyleDomainProfile, StyleProfile, StyleProfileInput, StyleProfileResult, WritingDomain } from "./types";
import { calculateConfidence } from "./confidence";
import { classifyDomain } from "./domainClassifier";
import { buildLexicalStats } from "./lexicalStats";
import { normalizeWritingSample, type NormalizedWritingSample } from "./normalizeText";
import { buildPhraseFingerprint } from "./phraseFingerprint";
import { computeProfileReliability } from "./profileReliability";
import { buildPunctuationStats } from "./punctuationStats";
import { buildSemanticVoiceStats } from "./semanticVoiceStats";
import { buildSentenceStats, splitSentences, tokenizeWords } from "./sentenceStats";
import { buildTransitionStats } from "./transitionStats";

interface PreparedSample extends NormalizedWritingSample {
  domain: WritingDomain;
}

export function buildStyleProfile(input: StyleProfileInput): StyleProfileResult {
  if (!input.samples?.length) {
    throw new Error("At least one writing sample is required.");
  }

  const preparedSamples = input.samples.map((sample) => {
    if (!sample.text?.trim()) {
      throw new Error(`Sample ${sample.id || "(missing id)"} is empty.`);
    }
    const normalized = normalizeWritingSample(sample);
    if (!normalized.text.trim()) {
      throw new Error(`Sample ${sample.id} has no analyzable prose after normalization.`);
    }
    return {
      ...normalized,
      domain: classifyDomain(normalized.text, sample.domain),
    };
  });

  const globalProfile = buildDomainProfile("global", preparedSamples);
  const detectedDomains = unique(preparedSamples.map((sample) => sample.domain));
  const domainProfiles: StyleProfile["domainProfiles"] = {};
  for (const domain of detectedDomains) {
    domainProfiles[domain] = buildDomainProfile(domain, preparedSamples.filter((sample) => sample.domain === domain));
  }

  const normalizationWarnings = preparedSamples.flatMap((sample) => sample.warnings);
  const confidenceResult = calculateConfidence(globalProfile.wordCount, preparedSamples.length);
  const warnings = unique([...normalizationWarnings, ...confidenceResult.warnings]);
  const confidence = confidenceResult.confidence;
  const createdAt = new Date().toISOString();
  const combinedText = preparedSamples.map((sample) => sample.text).join("\n\n");
  const domainCoverage = buildDomainCoverage(preparedSamples);

  const profile: StyleProfile = {
    schemaVersion: "1.1.0",
    profileId: createProfileId(preparedSamples, createdAt),
    userId: input.userId,
    createdAt,
    sampleCount: preparedSamples.length,
    totalWordCount: globalProfile.wordCount,
    totalSentenceCount: globalProfile.sentenceCount,
    totalParagraphCount: globalProfile.paragraphCount,
    detectedDomains,
    confidenceScore: confidence,
    warnings,
    phraseFingerprint: buildPhraseFingerprint(combinedText),
    profileReliability: {
      schemaVersion: "1.1.0",
      totalWords: globalProfile.wordCount,
      sampleCount: preparedSamples.length,
      domainCoverage,
      weakestAreas: [],
      recommendedMoreSamples: true,
      confidenceByCategory: {
        syntax: 0,
        lexical: 0,
        transitions: 0,
        punctuation: 0,
        semanticVoice: 0,
        domain: 0,
      },
    },
    globalProfile,
    domainProfiles,
  };
  profile.profileReliability = computeProfileReliability(profile, preparedSamples.length, globalProfile.wordCount, domainCoverage);

  return { profile, confidence, warnings };
}

function buildDomainProfile(domain: WritingDomain | "global", samples: PreparedSample[]): StyleDomainProfile {
  const text = samples.map((sample) => sample.text).join("\n\n");
  const paragraphs = samples.flatMap((sample) => sample.paragraphs);
  const words = tokenizeWords(text);
  const sentences = splitSentences(text);

  return {
    domain,
    sampleCount: samples.length,
    wordCount: words.length,
    sentenceCount: sentences.length,
    paragraphCount: paragraphs.length,
    syntacticFingerprint: buildSentenceStats(text, paragraphs),
    lexicalLandscape: buildLexicalStats(text),
    transitionFingerprint: buildTransitionStats(text),
    punctuationHabits: buildPunctuationStats(text),
    semanticVoiceProfile: buildSemanticVoiceStats(text),
  };
}

function createProfileId(samples: PreparedSample[], createdAt: string): string {
  const seed = `${createdAt}|${samples.map((sample) => `${sample.id}:${sample.domain}:${sample.text.length}`).join("|")}`;
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `style_${(hash >>> 0).toString(16)}`;
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function buildDomainCoverage(samples: PreparedSample[]): Record<string, number> {
  const coverage: Record<string, number> = {};
  for (const sample of samples) {
    coverage[sample.domain] = (coverage[sample.domain] ?? 0) + tokenizeWords(sample.text).length;
  }
  return coverage;
}
