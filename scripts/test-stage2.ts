import type { StyleDomainProfile, StyleProfile } from "../lib/style-profiler";
import {
  computeSourceDiversityScore,
  computeWordBudget,
  detectConflicts,
  generateEssayPlan,
  GENRE_SKELETONS,
  getGenreSkeleton,
  mapEvidenceToSections,
  resolveSyntacticDensityMode,
  scoreEvidenceForSection,
  validatePlan,
  type EssayPlan,
  type EssayType,
  type EvidenceNode,
} from "../lib/essay-planner";

declare const process: { exitCode?: number };

const MOCK_EVIDENCE: EvidenceNode[] = [
  evidence("e1", "Journal Evidence for Civic Reform", "Dr. Avery Stone", 2021, ["supports", "evidence", "policy"], "This study supports civic reform and demonstrates positive evidence for policy outcomes.", 0.95, "journal"),
  evidence("e2", "Book on Historical Change", "Mina Patel", 2018, ["argues", "history", "demonstrates"], "The book argues that historical change demonstrates durable social patterns.", 0.88, "book"),
  evidence("e3", "Government Report on Reform", "National Archive", 2020, ["critics", "counterargument", "policy"], "The report refutes some policy claims and notes negative consequences for implementation.", 0.84, "governmentReport"),
  evidence("e4", "University Evidence Brief", "Dr. Avery Stone", 2022, ["supports", "evidence", "education"], "The brief supports education reform and shows beneficial outcomes.", 0.79, "universityPage"),
  evidence("e5", "Comparative News Context", "Jordan Lee", 2023, ["comparison", "contrast", "difference"], "The article shows contrast between approaches and describes a difference in results.", 0.52, "newsOutlet"),
  evidence("e6", "Counter Study on Reform", "Sam Rivera", 2019, ["supports", "policy"], "This study refutes the policy and describes harmful outcomes despite shared policy keywords.", 0.76, "journal"),
];

const MOCK_PROFILE = createMockStyleProfile();

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
    console.error(error instanceof Error ? error.message : String(error));
  }
}

test("All five EssayTypes return a valid skeleton", () => {
  const types: EssayType[] = ["argumentative", "expository", "analytical", "compareContrast", "personalStatement"];
  for (const type of types) {
    assert(getGenreSkeleton(type).essayType === type, `Missing skeleton for ${type}.`);
  }
});

test("All skeleton weights sum to 1.0", () => {
  for (const skeleton of Object.values(GENRE_SKELETONS)) {
    const sum = skeleton.sections.reduce((total, section) => total + section.baseWordCountWeight, 0);
    assert(Math.abs(sum - 1) <= 0.001, `${skeleton.essayType} weights sum to ${sum}.`);
  }
});

test("getGenreSkeleton throws for unknown type", () => {
  let threw = false;
  try {
    getGenreSkeleton("unknown" as EssayType);
  } catch {
    threw = true;
  }
  assert(threw, "Expected unknown type to throw.");
});

test("scoreEvidenceForSection returns score between 0 and 1", () => {
  const score = scoreEvidenceForSection(MOCK_EVIDENCE[0], getGenreSkeleton("argumentative").sections[1]);
  assert(score >= 0 && score <= 1, "Score should be clamped.");
});

test("Matching keywords score higher than no matching keywords", () => {
  const section = getGenreSkeleton("argumentative").sections[1];
  const matching = scoreEvidenceForSection(MOCK_EVIDENCE[0], section);
  const nonMatching = scoreEvidenceForSection({ ...MOCK_EVIDENCE[0], keywords: ["unrelated"], abstract: "No overlap here.", credibilityScore: 0.1, sourceType: "other" }, section);
  assert(matching > nonMatching, "Expected matching node to score higher.");
});

test("Credibility boost increases score when credibilityScore is high", () => {
  const section = getGenreSkeleton("argumentative").sections[1];
  const low = scoreEvidenceForSection({ ...MOCK_EVIDENCE[0], credibilityScore: 0.1 }, section);
  const high = scoreEvidenceForSection({ ...MOCK_EVIDENCE[0], credibilityScore: 0.95 }, section);
  assert(high > low, "Expected credibility boost.");
});

test("computeSourceDiversityScore single node returns 0", () => {
  assert(computeSourceDiversityScore([MOCK_EVIDENCE[0]]) === 0, "Single source should have zero diversity.");
});

test("Different authors and sourceTypes return diversity > 0.5", () => {
  const score = computeSourceDiversityScore([MOCK_EVIDENCE[0], MOCK_EVIDENCE[1], MOCK_EVIDENCE[2]]);
  assert(score > 0.5, `Expected > 0.5, got ${score}.`);
});

test("Same author and sourceType return diversity < 0.5", () => {
  const score = computeSourceDiversityScore([MOCK_EVIDENCE[0], { ...MOCK_EVIDENCE[0], id: "dup" }]);
  assert(score < 0.5, `Expected < 0.5, got ${score}.`);
});

test("Opposing abstract signals return at least one ConflictFlag", () => {
  const conflicts = detectConflicts([MOCK_EVIDENCE[0], MOCK_EVIDENCE[5]]);
  assert(conflicts.length >= 1, "Expected conflict.");
});

test("No opposing signals return empty conflicts", () => {
  const conflicts = detectConflicts([MOCK_EVIDENCE[0], MOCK_EVIDENCE[1]]);
  assert(conflicts.length === 0, "Expected no conflicts.");
});

test("mapEvidenceToSections assigns evidence to required sections", () => {
  const skeleton = getGenreSkeleton("argumentative");
  const mapped = mapEvidenceToSections(MOCK_EVIDENCE, skeleton);
  for (const section of skeleton.sections.filter((item) => item.requiresEvidence)) {
    assert((mapped.assignments.get(section.label) ?? []).length > 0, `${section.label} should receive evidence.`);
  }
});

test("unusedEvidence contains only nodes not assigned anywhere", () => {
  const mapped = mapEvidenceToSections(MOCK_EVIDENCE, getGenreSkeleton("argumentative"));
  const assigned = new Set(Array.from(mapped.assignments.values()).flat().map((block) => block.node.id));
  assert(mapped.unusedEvidence.every((node) => !assigned.has(node.id)), "Unused evidence should not be assigned.");
});

test("Source diversity heuristic avoids duplicate authors when alternatives exist", () => {
  const mapped = mapEvidenceToSections(MOCK_EVIDENCE, getGenreSkeleton("argumentative"));
  for (const blocks of mapped.assignments.values()) {
    const authors = blocks.map((block) => block.node.author);
    assert(new Set(authors).size === authors.length, "Expected unique authors per section when alternatives exist.");
  }
});

test("computeWordBudget total equals target within tolerance", () => {
  const budget = computeWordBudget(getGenreSkeleton("argumentative"), 1000, "medium", 0.5);
  const total = Object.values(budget).reduce((sum, words) => sum + words, 0);
  assert(Math.abs(total - 1000) <= 20, `Expected around 1000, got ${total}.`);
});

test("High burstiness gives claim sections more words than low burstiness", () => {
  const skeleton = getGenreSkeleton("argumentative");
  const high = computeWordBudget(skeleton, 1000, "high", 0.7);
  const low = computeWordBudget(skeleton, 1000, "low", 0.3);
  assert(high["Claim 1"] > low["Claim 1"], "Expected high density claim to receive more words.");
});

test("Density mode high", () => {
  assert(resolveSyntacticDensityMode(0.7, 24) === "high", "Expected high.");
});

test("Density mode low", () => {
  assert(resolveSyntacticDensityMode(0.3, 10) === "low", "Expected low.");
});

test("Density mode medium", () => {
  assert(resolveSyntacticDensityMode(0.5, 17) === "medium", "Expected medium.");
});

test("validatePlan valid plan passes", () => {
  const plan = generateEssayPlan({ evidence: MOCK_EVIDENCE, profile: MOCK_PROFILE, essayType: "argumentative", targetWordCount: 1000, targetDomain: "history" });
  assert(validatePlan(plan).isValid === true, "Expected valid plan.");
});

test("validatePlan zero assigned evidence on required section is invalid", () => {
  const plan = clonePlan(generateEssayPlan({ evidence: MOCK_EVIDENCE, profile: MOCK_PROFILE, essayType: "argumentative", targetWordCount: 1000, targetDomain: "history" }));
  plan.sections[1].assignedEvidence = [];
  const validation = validatePlan(plan);
  assert(validation.isValid === false, "Expected invalid plan.");
});

test("validatePlan low blockStrength warning", () => {
  const plan = clonePlan(generateEssayPlan({ evidence: MOCK_EVIDENCE, profile: MOCK_PROFILE, essayType: "argumentative", targetWordCount: 1000, targetDomain: "history" }));
  plan.sections[1].blockStrength = 0.1;
  const validation = validatePlan(plan);
  assert(validation.warnings.some((warning) => warning.includes("low block strength")), "Expected low strength warning.");
});

test("validatePlan unused evidence warning", () => {
  const plan = clonePlan(generateEssayPlan({ evidence: MOCK_EVIDENCE, profile: MOCK_PROFILE, essayType: "argumentative", targetWordCount: 1000, targetDomain: "history" }));
  plan.unusedEvidence = [MOCK_EVIDENCE[0]];
  const validation = validatePlan(plan);
  assert(validation.warnings.some((warning) => warning.includes("not assigned")), "Expected unused evidence warning.");
});

test("validatePlan conflict warning", () => {
  const plan = clonePlan(generateEssayPlan({ evidence: MOCK_EVIDENCE, profile: MOCK_PROFILE, essayType: "argumentative", targetWordCount: 1000, targetDomain: "history" }));
  plan.sections[1].conflictFlags = [{ nodeIdA: "a", nodeIdB: "b", reason: "conflict" }];
  const validation = validatePlan(plan);
  assert(validation.warnings.some((warning) => warning.includes("potential evidence conflict")), "Expected conflict warning.");
});

test("generateEssayPlan returns schemaVersion 2.0.0", () => {
  const plan = generateEssayPlan({ evidence: MOCK_EVIDENCE, profile: MOCK_PROFILE, essayType: "argumentative", targetWordCount: 1000, targetDomain: "history" });
  assert(plan.schemaVersion === "2.0.0", "Expected schema version.");
});

test("generateEssayPlan planId is non-empty", () => {
  const plan = generateEssayPlan({ evidence: MOCK_EVIDENCE, profile: MOCK_PROFILE, essayType: "argumentative", targetWordCount: 1000, targetDomain: "history" });
  assert(plan.planId.length > 0, "Expected plan id.");
});

test("generateEssayPlan sections length matches skeleton", () => {
  const plan = generateEssayPlan({ evidence: MOCK_EVIDENCE, profile: MOCK_PROFILE, essayType: "argumentative", targetWordCount: 1000, targetDomain: "history" });
  assert(plan.sections.length === getGenreSkeleton("argumentative").sections.length, "Expected matching section count.");
});

test("generateEssayPlan wordBudgetBreakdown keys match labels", () => {
  const plan = generateEssayPlan({ evidence: MOCK_EVIDENCE, profile: MOCK_PROFILE, essayType: "argumentative", targetWordCount: 1000, targetDomain: "history" });
  const labels = plan.sections.map((section) => section.label).sort();
  const keys = Object.keys(plan.wordBudgetBreakdown).sort();
  assert(JSON.stringify(labels) === JSON.stringify(keys), "Expected budget keys to match labels.");
});

test("generateEssayPlan totalAssignedEvidence does not exceed evidence length", () => {
  const plan = generateEssayPlan({ evidence: MOCK_EVIDENCE, profile: MOCK_PROFILE, essayType: "argumentative", targetWordCount: 1000, targetDomain: "history" });
  assert(plan.totalAssignedEvidence <= MOCK_EVIDENCE.length, "Expected unique assigned count.");
});

test("generateEssayPlan validation object is present", () => {
  const plan = generateEssayPlan({ evidence: MOCK_EVIDENCE, profile: MOCK_PROFILE, essayType: "argumentative", targetWordCount: 1000, targetDomain: "history" });
  assert(typeof plan.validation.isValid === "boolean", "Expected validation.");
});

test("generateEssayPlan unusedEvidence is an array", () => {
  const plan = generateEssayPlan({ evidence: MOCK_EVIDENCE, profile: MOCK_PROFILE, essayType: "argumentative", targetWordCount: 1000, targetDomain: "history" });
  assert(Array.isArray(plan.unusedEvidence), "Expected unusedEvidence array.");
});

test("generateEssayPlan with 0 evidence is valid for personalStatement", () => {
  const plan = generateEssayPlan({ evidence: [], profile: MOCK_PROFILE, essayType: "personalStatement", targetWordCount: 650, targetDomain: "history" });
  assert(plan.validation.isValid === true, "Expected personal statement to be valid without evidence.");
});

test("generateEssayPlan with fewer nodes than minimumEvidenceNodes warns, not errors", () => {
  const plan = generateEssayPlan({ evidence: [MOCK_EVIDENCE[0]], profile: MOCK_PROFILE, essayType: "argumentative", targetWordCount: 800, targetDomain: "history" });
  assert(plan.validation.isValid === true, "Expected warning only.");
  assert(plan.validation.warnings.some((warning) => warning.includes("usually works best")), "Expected minimum evidence warning.");
});

console.log(`Stage 2 tests complete: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}

function evidence(
  id: string,
  title: string,
  author: string,
  year: number,
  keywords: string[],
  abstract: string,
  credibilityScore: number,
  sourceType: EvidenceNode["sourceType"]
): EvidenceNode {
  return {
    id,
    title,
    author,
    year,
    keywords,
    abstract,
    credibilityScore,
    citationMla: `${author}. "${title}." ${year}.`,
    citationApa: `${author} (${year}). ${title}.`,
    sourceType,
  };
}

function createMockStyleProfile(): StyleProfile {
  const globalProfile = createDomainProfile("global");
  const historyProfile = createDomainProfile("history");
  return {
    schemaVersion: "1.1.0",
    profileId: "style_stage2",
    createdAt: "2026-05-13T00:00:00.000Z",
    sampleCount: 4,
    totalWordCount: 3200,
    totalSentenceCount: 130,
    totalParagraphCount: 24,
    detectedDomains: ["history"],
    confidenceScore: 0.86,
    warnings: [],
    phraseFingerprint: {
      commonBigrams: [],
      commonTrigrams: [],
      commonFourgrams: [],
      repeatedAcademicPhrases: [],
      repeatedSentenceFrames: [],
    },
    profileReliability: {
      schemaVersion: "1.1.0",
      totalWords: 3200,
      sampleCount: 4,
      domainCoverage: { history: 3200 },
      weakestAreas: [],
      recommendedMoreSamples: true,
      confidenceByCategory: {
        syntax: 0.82,
        lexical: 0.8,
        transitions: 0.75,
        punctuation: 0.78,
        semanticVoice: 0.7,
        domain: 0.65,
      },
    },
    globalProfile,
    domainProfiles: {
      history: historyProfile,
    },
  };
}

function createDomainProfile(domain: StyleDomainProfile["domain"]): StyleDomainProfile {
  return {
    domain,
    sampleCount: 2,
    wordCount: 1600,
    sentenceCount: 66,
    paragraphCount: 12,
    syntacticFingerprint: {
      averageSentenceLength: 24,
      medianSentenceLength: 22,
      sentenceLengthStandardDeviation: 9,
      sentenceLengthDistribution: { "15-22": 30, "23-32": 24, "33+": 12 },
      burstinessScore: 0.7,
      shortToLongSentencePattern: "medium -> long -> short",
      paragraphLengthDistribution: { "101-175": 10 },
      clausalDensityEstimate: 0.55,
      subordinateClauseFrequency: 0.3,
      coordinateClauseFrequency: 0.25,
      passiveVoiceEstimate: 0.04,
      activeVoiceEstimate: 0.96,
      commonSentenceOpeners: { "this suggests": 4 },
      commonSentenceClosers: { "historical context": 3 },
      gerundOpeningFrequency: 0.04,
      complexSentenceRatio: 0.48,
      simpleSentenceRatio: 0.22,
      compoundSentenceRatio: 0.3,
    },
    lexicalLandscape: {
      vocabularyFrequencyMap: { evidence: 12, policy: 8, history: 7 },
      topAcademicTerms: ["evidence", "analysis"],
      repeatedAcademicPhrases: { "historical evidence": 3 },
      lexicalDiversityScore: 0.74,
      typeTokenRatio: 0.58,
      hapaxLegomenaRate: 0.32,
      vocabularyTierDistribution: { common: 0.45, academic: 0.25, domainSpecific: 0.2, rare: 0.1 },
      preferredSynonyms: {},
      avoidedOverusedWords: [],
      domainVocabularyByCategory: { history: { regime: 4 } },
    },
    transitionFingerprint: {
      commonTransitions: ["however", "therefore", "for example"],
      transitionFrequencyMap: { however: 6, therefore: 5, "for example": 4 },
      contrastTransitions: { however: 6 },
      additionTransitions: { furthermore: 2 },
      causationTransitions: { therefore: 5, "as a result": 3 },
      conclusionTransitions: { ultimately: 2 },
      evidenceIntroductionPhrases: { "for example": 4 },
      explanationPhrases: { "this suggests": 3 },
      counterargumentPhrases: { although: 2 },
    },
    punctuationHabits: {
      punctuationFrequencyMap: { ",": 50, ";": 8, ".": 66 },
      commaDensity: 3.1,
      semicolonDensity: 0.5,
      colonDensity: 0.1,
      dashDensity: 0,
      parenthesisDensity: 0,
      quoteUsageFrequency: 0.2,
      oxfordCommaEstimate: 0.6,
      averagePunctuationPerSentence: 1.9,
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
      counterargumentFrequency: 0.12,
      evidenceIntegrationStyle: "integrated evidence framing",
      explanationDepthEstimate: 0.7,
      firstPersonUsageFrequency: 0,
      rhetoricalQuestionFrequency: 0,
    },
  };
}

function clonePlan(plan: EssayPlan): EssayPlan {
  return JSON.parse(JSON.stringify(plan)) as EssayPlan;
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
