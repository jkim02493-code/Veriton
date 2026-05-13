import {
  buildPhraseFingerprint,
  compareDraftToStyleProfile,
  computeProfileReliability,
  migrateProfileSchema,
  normalizeText,
  resolveStyleProfileForTask,
  type ProfileReliability,
  type StyleDomainProfile,
  type StyleProfile,
} from "../lib/style-profiler";

declare const process: { exitCode?: number };

let passed = 0;
let failed = 0;

function test(label: string, assertion: () => void): void {
  try {
    assertion();
    passed += 1;
    console.log(`✅ PASS ${label}`);
  } catch (error) {
    failed += 1;
    console.error(`❌ FAIL ${label}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

const fixture = createMockStyleProfile();

test("normalizeText removes Works Cited section", () => {
  const cleaned = normalizeText("Body argument remains.\n\nWorks Cited\nSmith. Book. Publisher.");
  assert(!cleaned.includes("Works Cited"), "Bibliography header should be removed.");
  assert(!cleaned.includes("Smith. Book"), "Bibliography content should be removed.");
});

test("normalizeText removes URL", () => {
  const cleaned = normalizeText("This body cites a source https://example.com/article but keeps prose.");
  assert(!cleaned.includes("https://example.com"), "URL should be removed.");
});

test("normalizeText preserves body before bibliography", () => {
  const cleaned = normalizeText("The actual essay body should stay.\n\nReferences\nRemoved source.");
  assert(cleaned.includes("The actual essay body should stay."), "Body text should be preserved.");
});

test("normalizeText empty input returns empty string", () => {
  assert(normalizeText("") === "", "Empty input should normalize to empty string.");
});

test("phraseFingerprint extracts bigrams", () => {
  const fingerprint = buildPhraseFingerprint("This evidence shows social change. This evidence shows social change. This evidence shows social change.");
  assert(fingerprint.commonBigrams.length > 0, "Expected repeated bigrams.");
});

test("phraseFingerprint extracts trigrams", () => {
  const fingerprint = buildPhraseFingerprint("This evidence shows social change. This evidence shows social change. This evidence shows social change.");
  assert(fingerprint.commonTrigrams.length > 0, "Expected repeated trigrams.");
});

test("phraseFingerprint stores no phrases over 60 characters", () => {
  const fingerprint = buildPhraseFingerprint("This evidence shows social change. This evidence shows social change. This evidence shows social change.");
  const values = [
    ...fingerprint.commonBigrams.map((item) => item.phrase),
    ...fingerprint.commonTrigrams.map((item) => item.phrase),
    ...fingerprint.commonFourgrams.map((item) => item.phrase),
    ...fingerprint.repeatedAcademicPhrases.map((item) => item.phrase),
    ...fingerprint.repeatedSentenceFrames.map((item) => item.frame),
  ];
  assert(values.every((value) => value.length < 60), "Every stored phrase/frame should be under 60 characters.");
});

test("phraseFingerprint entries include count property", () => {
  const fingerprint = buildPhraseFingerprint("This evidence shows social change. This evidence shows social change. This evidence shows social change.");
  assert(typeof fingerprint.commonBigrams[0]?.count === "number", "Repeated phrases should include count.");
});

test("profileReliability recommends more samples for 1 sample and 150 words", () => {
  const reliability = computeProfileReliability(createReliabilityProfile(150, 10, 45, 3), 1, 150, { history: 150 });
  assert(reliability.recommendedMoreSamples === true, "Expected more samples recommendation.");
});

test("profileReliability syntax confidence below 0.5 for 1 sample and 150 words", () => {
  const reliability = computeProfileReliability(createReliabilityProfile(150, 10, 45, 3), 1, 150, { history: 150 });
  assert(reliability.confidenceByCategory.syntax < 0.5, "Expected weak syntax confidence.");
});

test("profileReliability weakestAreas non-empty for weak profile", () => {
  const reliability = computeProfileReliability(createReliabilityProfile(150, 10, 45, 3), 1, 150, { history: 150 });
  assert(reliability.weakestAreas.length > 0, "Expected weakest areas.");
});

test("profileReliability schemaVersion is 1.1.0", () => {
  const reliability = computeProfileReliability(createReliabilityProfile(150, 10, 45, 3), 1, 150, { history: 150 });
  assert(reliability.schemaVersion === "1.1.0", "Expected reliability schema version 1.1.0.");
});

test("profileReliability does not recommend more samples for 8 samples and 5000 words", () => {
  const reliability = computeProfileReliability(createReliabilityProfile(5000, 80, 900, 25), 8, 5000, { history: 2000, business: 1500, scientific: 1500 });
  assert(reliability.recommendedMoreSamples === false, "Expected no more samples recommendation.");
});

test("profileReliability syntax confidence high for 8 samples and 5000 words", () => {
  const reliability = computeProfileReliability(createReliabilityProfile(5000, 80, 900, 25), 8, 5000, { history: 2000, business: 1500, scientific: 1500 });
  assert(reliability.confidenceByCategory.syntax >= 0.8, "Expected high syntax confidence.");
});

test("resolveStyleProfileForTask known domain uses 70/30 weights", () => {
  const resolved = resolveStyleProfileForTask(fixture, "history");
  assert(resolved.resolutionMeta.targetDomain === "history", "Expected history target domain.");
  assert(resolved.resolutionMeta.domainWeight === 0.7, "Expected 70% domain weight.");
  assert(resolved.resolutionMeta.globalWeight === 0.3, "Expected 30% global weight.");
});

test("resolveStyleProfileForTask blends known domain average sentence length", () => {
  const resolved = resolveStyleProfileForTask(fixture, "history");
  const blended = resolved.syntax.avgWordsPerSentence as number;
  assert(typeof blended === "number", "Expected numeric blended average.");
  assert(blended > 10 && blended < 20, "Blended average should sit between global and domain values.");
});

test("resolveStyleProfileForTask unknown domain falls back to global", () => {
  const resolved = resolveStyleProfileForTask(fixture, "science");
  assert(resolved.resolutionMeta.targetDomain === "global", "Expected global fallback.");
  assert(resolved.resolutionMeta.explanation.toLowerCase().includes("fallback") || resolved.resolutionMeta.explanation.toLowerCase().includes("no science"), "Expected fallback explanation.");
});

test("resolveStyleProfileForTask no domain uses global", () => {
  const resolved = resolveStyleProfileForTask(fixture);
  assert(resolved.resolutionMeta.targetDomain === "global", "Expected global target.");
});

test("styleDelta returns overall similarity between 0 and 1", () => {
  const result = compareDraftToStyleProfile("Short sentence. Short sentence. Short sentence. Short sentence.", fixture, "history");
  assert(result.overallSimilarityScore >= 0 && result.overallSimilarityScore <= 1, "Similarity should be between 0 and 1.");
});

test("styleDelta uniform draft has negative burstiness delta", () => {
  const result = compareDraftToStyleProfile("Short sentence. Short sentence. Short sentence. Short sentence.", fixture, "history");
  assert(result.burstinessDelta < 0, "Uniform draft should have lower burstiness.");
});

test("styleDelta uniform draft has recommendations", () => {
  const result = compareDraftToStyleProfile("Short sentence. Short sentence. Short sentence. Short sentence.", fixture, "history");
  assert(result.recommendations.length > 0, "Expected recommendations.");
});

test("styleDelta uniform recommendation mentions uniform or mix", () => {
  const result = compareDraftToStyleProfile("Short sentence. Short sentence. Short sentence. Short sentence.", fixture, "history");
  assert(result.recommendations.some((recommendation) => /uniform|mix/i.test(recommendation)), "Expected uniform/mix recommendation.");
});

test("migrateProfileSchema upgrades 1.0.0 profile version", () => {
  const migrated = migrateProfileSchema({ ...fixture, schemaVersion: "1.0.0", phraseFingerprint: undefined, profileReliability: undefined });
  assert(migrated.schemaVersion === "1.1.0", "Expected schema version 1.1.0.");
});

test("migrateProfileSchema adds empty phraseFingerprint stub", () => {
  const migrated = migrateProfileSchema({ ...fixture, schemaVersion: "1.0.0", phraseFingerprint: undefined, profileReliability: undefined });
  assert(migrated.phraseFingerprint.commonBigrams.length === 0, "Expected empty bigram stub.");
  assert(migrated.phraseFingerprint.commonTrigrams.length === 0, "Expected empty trigram stub.");
});

test("migrateProfileSchema adds profileReliability stub", () => {
  const migrated = migrateProfileSchema({ ...fixture, schemaVersion: "1.0.0", phraseFingerprint: undefined, profileReliability: undefined });
  assert(migrated.profileReliability.recommendedMoreSamples === true, "Expected recommendedMoreSamples stub.");
});

console.log(`Stage 1.5 tests complete: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}

function createMockStyleProfile(): StyleProfile {
  const globalProfile = createDomainProfile("global", 10, 5, 0.5, 2);
  const historyProfile = createDomainProfile("history", 20, 8, 0.6, 4);
  const reliability: ProfileReliability = {
    schemaVersion: "1.1.0",
    totalWords: 3000,
    sampleCount: 3,
    domainCoverage: { history: 1200 },
    weakestAreas: [],
    recommendedMoreSamples: false,
    confidenceByCategory: {
      syntax: 0.8,
      lexical: 0.8,
      transitions: 0.7,
      punctuation: 0.75,
      semanticVoice: 0.65,
      domain: 0.6,
    },
  };

  return {
    schemaVersion: "1.1.0",
    profileId: "style_test",
    createdAt: "2026-05-13T00:00:00.000Z",
    sampleCount: 3,
    totalWordCount: 3000,
    totalSentenceCount: 120,
    totalParagraphCount: 20,
    detectedDomains: ["history"],
    confidenceScore: 0.82,
    warnings: [],
    phraseFingerprint: {
      commonBigrams: [],
      commonTrigrams: [],
      commonFourgrams: [],
      repeatedAcademicPhrases: [],
      repeatedSentenceFrames: [],
    },
    profileReliability: reliability,
    globalProfile,
    domainProfiles: {
      history: historyProfile,
    },
  };
}

function createReliabilityProfile(wordCount: number, sentenceCount: number, uniqueWordCount: number, transitionTotal: number): Pick<StyleProfile, "globalProfile" | "domainProfiles"> {
  const profile = createDomainProfile("global", 15, 5, uniqueWordCount / Math.max(wordCount, 1), transitionTotal);
  profile.wordCount = wordCount;
  profile.sentenceCount = sentenceCount;
  return { globalProfile: profile, domainProfiles: { history: createDomainProfile("history", 15, 5, uniqueWordCount / Math.max(wordCount, 1), transitionTotal) } };
}

function createDomainProfile(domain: StyleDomainProfile["domain"], avgSentenceLength: number, sentenceStdDev: number, typeTokenRatio: number, transitionTotal: number): StyleDomainProfile {
  return {
    domain,
    sampleCount: 1,
    wordCount: 1000,
    sentenceCount: 80,
    paragraphCount: 8,
    syntacticFingerprint: {
      averageSentenceLength: avgSentenceLength,
      medianSentenceLength: avgSentenceLength,
      sentenceLengthStandardDeviation: sentenceStdDev,
      sentenceLengthDistribution: { "9-14": 4, "15-22": 6 },
      burstinessScore: sentenceStdDev / Math.max(avgSentenceLength, 1),
      shortToLongSentencePattern: "short -> medium -> long",
      paragraphLengthDistribution: { "51-100": 4 },
      clausalDensityEstimate: 0.4,
      subordinateClauseFrequency: 0.2,
      coordinateClauseFrequency: 0.2,
      passiveVoiceEstimate: 0.03,
      activeVoiceEstimate: 0.97,
      commonSentenceOpeners: { "this suggests": 3 },
      commonSentenceClosers: { "the argument": 2 },
      gerundOpeningFrequency: 0.05,
      complexSentenceRatio: 0.4,
      simpleSentenceRatio: 0.35,
      compoundSentenceRatio: 0.25,
    },
    lexicalLandscape: {
      vocabularyFrequencyMap: Object.fromEntries(Array.from({ length: Math.max(20, Math.round(typeTokenRatio * 1000)) }, (_, index) => [`word${index}`, 1])),
      topAcademicTerms: ["analysis", "evidence"],
      repeatedAcademicPhrases: { "historical context": 3 },
      lexicalDiversityScore: 0.7,
      typeTokenRatio,
      hapaxLegomenaRate: 0.3,
      vocabularyTierDistribution: { common: 0.5, academic: 0.2, domainSpecific: 0.2, rare: 0.1 },
      preferredSynonyms: {},
      avoidedOverusedWords: [],
      domainVocabularyByCategory: { history: { regime: 4 } },
    },
    transitionFingerprint: {
      commonTransitions: ["however", "therefore"],
      transitionFrequencyMap: { however: Math.ceil(transitionTotal / 2), therefore: Math.floor(transitionTotal / 2) },
      contrastTransitions: { however: 2 },
      additionTransitions: { furthermore: 1 },
      causationTransitions: { therefore: 2 },
      conclusionTransitions: {},
      evidenceIntroductionPhrases: { "for example": 1 },
      explanationPhrases: { "this suggests": 2 },
      counterargumentPhrases: { although: 1 },
    },
    punctuationHabits: {
      punctuationFrequencyMap: { ",": 30, ";": 4, ".": 80 },
      commaDensity: 3,
      semicolonDensity: 0.4,
      colonDensity: 0.1,
      dashDensity: 0,
      parenthesisDensity: 0,
      quoteUsageFrequency: 0.2,
      oxfordCommaEstimate: 0.5,
      averagePunctuationPerSentence: 1.4,
      typoPatterns: {},
      spellingVariantPreference: "US",
    },
    semanticVoiceProfile: {
      hedgePhraseFrequency: { perhaps: 3 },
      boostPhraseFrequency: { demonstrates: 2 },
      hedgeToBoostRatio: 1.5,
      certaintyLevel: 0.55,
      argumentativeStance: "analytical",
      thesisDirectnessScore: 0.7,
      counterargumentFrequency: 0.1,
      evidenceIntegrationStyle: "integrated evidence framing",
      explanationDepthEstimate: 0.6,
      firstPersonUsageFrequency: 0,
      rhetoricalQuestionFrequency: 0,
    },
  };
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
