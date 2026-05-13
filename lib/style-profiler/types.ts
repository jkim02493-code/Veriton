import type { PhraseFingerprint } from "./phraseFingerprint";
import type { ProfileReliability } from "./profileReliability";

export type WritingDomain =
  | "humanities"
  | "scientific"
  | "science"
  | "business"
  | "literaryAnalysis"
  | "literature"
  | "history"
  | "philosophy"
  | "personalStatement"
  | "generalAcademic"
  | "general"
  | "unknown";

export type ArgumentativeStance = "balanced" | "assertive" | "exploratory" | "analytical" | "descriptive";
export type SpellingVariantPreference = "US" | "UK" | "mixed" | "unknown";

export type FrequencyMap = Record<string, number>;
export type NumericDistribution = Record<string, number>;

export interface WritingSample {
  id: string;
  title?: string;
  domain?: WritingDomain;
  text: string;
}

export interface StyleProfileInput {
  samples: WritingSample[];
  userId?: string;
}

export interface StyleProfileResult {
  profile: StyleProfile;
  confidence: number;
  warnings: string[];
}

export interface StyleProfile {
  schemaVersion: "1.1.0";
  profileId: string;
  userId?: string;
  createdAt: string;
  sampleCount: number;
  totalWordCount: number;
  totalSentenceCount: number;
  totalParagraphCount: number;
  detectedDomains: WritingDomain[];
  confidenceScore: number;
  warnings: string[];
  phraseFingerprint: PhraseFingerprint;
  profileReliability: ProfileReliability;
  globalProfile: StyleDomainProfile;
  domainProfiles: Partial<Record<WritingDomain, StyleDomainProfile>>;
}

export interface StyleDomainProfile {
  domain: WritingDomain | "global";
  sampleCount: number;
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  syntacticFingerprint: SyntacticFingerprint;
  lexicalLandscape: LexicalLandscape;
  transitionFingerprint: TransitionFingerprint;
  punctuationHabits: PunctuationHabits;
  semanticVoiceProfile: SemanticVoiceProfile;
}

export interface SyntacticFingerprint {
  averageSentenceLength: number;
  medianSentenceLength: number;
  sentenceLengthStandardDeviation: number;
  sentenceLengthDistribution: NumericDistribution;
  burstinessScore: number;
  shortToLongSentencePattern: string;
  paragraphLengthDistribution: NumericDistribution;
  clausalDensityEstimate: number;
  subordinateClauseFrequency: number;
  coordinateClauseFrequency: number;
  passiveVoiceEstimate: number;
  activeVoiceEstimate: number;
  commonSentenceOpeners: FrequencyMap;
  commonSentenceClosers: FrequencyMap;
  gerundOpeningFrequency: number;
  complexSentenceRatio: number;
  simpleSentenceRatio: number;
  compoundSentenceRatio: number;
}

export interface LexicalLandscape {
  vocabularyFrequencyMap: FrequencyMap;
  topAcademicTerms: string[];
  repeatedAcademicPhrases: FrequencyMap;
  lexicalDiversityScore: number;
  typeTokenRatio: number;
  hapaxLegomenaRate: number;
  vocabularyTierDistribution: {
    common: number;
    academic: number;
    domainSpecific: number;
    rare: number;
  };
  preferredSynonyms: Record<string, { preferred: string; alternatives: FrequencyMap }>;
  avoidedOverusedWords: string[];
  domainVocabularyByCategory: Record<string, FrequencyMap>;
}

export interface TransitionFingerprint {
  commonTransitions: string[];
  transitionFrequencyMap: FrequencyMap;
  contrastTransitions: FrequencyMap;
  additionTransitions: FrequencyMap;
  causationTransitions: FrequencyMap;
  conclusionTransitions: FrequencyMap;
  evidenceIntroductionPhrases: FrequencyMap;
  explanationPhrases: FrequencyMap;
  counterargumentPhrases: FrequencyMap;
}

export interface PunctuationHabits {
  punctuationFrequencyMap: FrequencyMap;
  commaDensity: number;
  semicolonDensity: number;
  colonDensity: number;
  dashDensity: number;
  parenthesisDensity: number;
  quoteUsageFrequency: number;
  oxfordCommaEstimate: number;
  averagePunctuationPerSentence: number;
  typoPatterns?: FrequencyMap;
  spellingVariantPreference: SpellingVariantPreference;
}

export interface SemanticVoiceProfile {
  hedgePhraseFrequency: FrequencyMap;
  boostPhraseFrequency: FrequencyMap;
  hedgeToBoostRatio: number;
  certaintyLevel: number;
  argumentativeStance: ArgumentativeStance;
  thesisDirectnessScore: number;
  counterargumentFrequency: number;
  evidenceIntegrationStyle: string;
  explanationDepthEstimate: number;
  firstPersonUsageFrequency: number;
  rhetoricalQuestionFrequency: number;
}

export function migrateProfileSchema(raw: unknown): StyleProfile {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid style profile.");
  }

  const profile = raw as Partial<StyleProfile> & {
    schemaVersion?: string;
    totalWordCount?: number;
    sampleCount?: number;
    detectedDomains?: string[];
  };

  if (profile.schemaVersion === "1.1.0" && profile.phraseFingerprint && profile.profileReliability) {
    return profile as StyleProfile;
  }

  const totalWords = Number(profile.totalWordCount ?? 0);
  const sampleCount = Number(profile.sampleCount ?? 0);
  const domainCoverage = Object.fromEntries((profile.detectedDomains ?? []).map((domain) => [domain, 0]));

  return {
    ...(profile as StyleProfile),
    schemaVersion: "1.1.0",
    phraseFingerprint: profile.phraseFingerprint ?? {
      commonBigrams: [],
      commonTrigrams: [],
      commonFourgrams: [],
      repeatedAcademicPhrases: [],
      repeatedSentenceFrames: [],
    },
    profileReliability: profile.profileReliability ?? {
      schemaVersion: "1.1.0",
      totalWords,
      sampleCount,
      domainCoverage,
      weakestAreas: ["syntax", "lexical", "transitions", "punctuation", "semanticVoice", "domain"],
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
  } as StyleProfile;
}
