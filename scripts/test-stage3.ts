import type { EssayPlan, EvidenceNode, PlannedSection } from "../lib/essay-planner";
import {
  assembleDraft,
  buildDraftChunks,
  buildSectionPrompt,
  buildSystemPrompt,
  extractWordCount,
  runGenerationPipeline,
} from "../lib/generation";
import type { GeneratedSection } from "../lib/generation";
import type { ResolvedStyleProfile, StyleProfile } from "../lib/style-profiler";

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

const MOCK_EVIDENCE: EvidenceNode = {
  id: "ev-stage3-1",
  title: "Industrial Change and Urban Growth",
  author: "Rivera",
  year: 2021,
  keywords: ["industrial", "urbanization", "economic"],
  abstract: "The source argues that industrial change accelerated urbanization and altered economic structures.",
  credibilityScore: 0.91,
  citationMla: "Rivera. Industrial Change and Urban Growth. 2021.",
  citationApa: "Rivera. (2021). Industrial Change and Urban Growth.",
  sourceType: "journal",
};

const INTRO_SECTION: PlannedSection = {
  sectionIndex: 0,
  role: "introduction",
  label: "Introduction",
  targetWordCount: 120,
  assignedEvidence: [],
  blockStrength: 0,
  sourceDiversityScore: 0,
  suggestedTransitionType: "no transition needed",
  conflictFlags: [],
  targetSyntacticDensity: "low",
  thesisSlot: true,
};

const CLAIM_SECTION: PlannedSection = {
  sectionIndex: 1,
  role: "claim",
  label: "Claim 1",
  targetWordCount: 180,
  assignedEvidence: [
    {
      node: MOCK_EVIDENCE,
      relevanceScore: 0.8,
      role: "primary",
    },
  ],
  blockStrength: 0.7,
  sourceDiversityScore: 0,
  suggestedTransitionType: "additive transition (e.g. furthermore, in addition)",
  conflictFlags: [],
  targetSyntacticDensity: "high",
};

const COUNTER_SECTION: PlannedSection = {
  ...CLAIM_SECTION,
  sectionIndex: 2,
  role: "counterArgument",
  label: "Counter-Perspective",
  suggestedTransitionType: "contrastive transition (e.g. however, in contrast)",
};

const CONCLUSION_SECTION: PlannedSection = {
  sectionIndex: 3,
  role: "conclusion",
  label: "Conclusion",
  targetWordCount: 100,
  assignedEvidence: [],
  blockStrength: 0,
  sourceDiversityScore: 0,
  suggestedTransitionType: "conclusive transition (e.g. in conclusion, ultimately)",
  conflictFlags: [],
  targetSyntacticDensity: "low",
};

const CONFLICT_SECTION: PlannedSection = {
  ...CLAIM_SECTION,
  conflictFlags: [
    {
      nodeIdA: "a",
      nodeIdB: "b",
      reason: "Test conflict.",
    },
  ],
};

const MOCK_PLAN: EssayPlan = {
  schemaVersion: "2.0.0",
  planId: "plan-stage3",
  createdAt: "2026-05-14T00:00:00.000Z",
  essayType: "argumentative",
  targetWordCount: 400,
  resolvedProfileDomain: "academic",
  sections: [INTRO_SECTION, CLAIM_SECTION, CONCLUSION_SECTION],
  unusedEvidence: [],
  totalAssignedEvidence: 1,
  wordBudgetBreakdown: {
    Introduction: 120,
    "Claim 1": 180,
    Conclusion: 100,
  },
  validation: {
    isValid: true,
    errors: [],
    warnings: [],
  },
  plannerMeta: {
    syntacticDensityMode: "high",
    bodyBlockCount: 1,
    profileBurstinessScore: 0.7,
    profileAvgSentenceLength: 24,
    evidenceNodeCount: 1,
  },
};

const MOCK_PROFILE = {
  schemaVersion: "1.1.0",
  profileId: "profile-stage3",
  globalProfile: {},
  syntax: {
    avgWordsPerSentence: 24,
    burstinessScore: 0.7,
    passiveVoiceRate: 5,
  },
  lexical: {
    typeTokenRatio: 0.58,
  },
  voice: {
    hedgeRatio: 0.3,
    firstPersonRate: 0,
  },
  transitions: {
    byCategory: {
      addition: 4,
      contrast: 2,
    },
  },
  resolutionMeta: {
    targetDomain: "academic",
  },
} as unknown as StyleProfile;

const MOCK_RESOLVED_PROFILE = MOCK_PROFILE as unknown as ResolvedStyleProfile;

const tests: TestCase[] = [];

function test(name: string, run: () => void | Promise<void>): void {
  tests.push({ name, run });
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function createGeneratedSection(index: number, text: string): GeneratedSection {
  return {
    sectionIndex: index,
    role: "claim",
    label: `Section ${index}`,
    generatedText: text,
    wordCount: extractWordCount(text),
    targetWordCount: 20,
    wordCountDelta: extractWordCount(text) - 20,
    styleDeltaResult: null,
    citationsUsed: [],
    draftChunks: [],
  };
}

function installFetchStub(): typeof fetch {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    return new Response(
      JSON.stringify({
        content: [
          {
            type: "text",
            text: "This is a generated paragraph for testing purposes. The industrial revolution changed economic structures fundamentally. Furthermore, urbanization accelerated during this period.",
          },
        ],
      }),
      { status: 200 },
    );
  }) as typeof fetch;

  return originalFetch;
}

test("systemPromptBuilder returns a non-empty string", () => {
  assert(buildSystemPrompt(MOCK_PROFILE, MOCK_RESOLVED_PROFILE, "argumentative", "mla").length > 0, "Prompt was empty");
});

test("systemPromptBuilder contains role block text", () => {
  assert(
    buildSystemPrompt(MOCK_PROFILE, MOCK_RESOLVED_PROFILE, "argumentative", "mla").includes("academic writing assistant"),
    "Missing role text",
  );
});

test("systemPromptBuilder contains evidence-first constraint text", () => {
  assert(
    buildSystemPrompt(MOCK_PROFILE, MOCK_RESOLVED_PROFILE, "argumentative", "mla").includes("Do NOT fabricate"),
    "Missing evidence constraint",
  );
});

test("systemPromptBuilder contains citation format instruction for MLA", () => {
  assert(
    buildSystemPrompt(MOCK_PROFILE, MOCK_RESOLVED_PROFILE, "argumentative", "mla").includes("MLA format"),
    "Missing MLA instruction",
  );
});

test("systemPromptBuilder contains citation format instruction for APA", () => {
  assert(
    buildSystemPrompt(MOCK_PROFILE, MOCK_RESOLVED_PROFILE, "argumentative", "apa").includes("APA format"),
    "Missing APA instruction",
  );
});

test("High burstiness profile produces vary sentence length instruction", () => {
  assert(
    buildSystemPrompt(MOCK_PROFILE, MOCK_RESOLVED_PROFILE, "argumentative", "mla").includes("vary sentence length"),
    "Missing burstiness instruction",
  );
});

test("Low hedge ratio profile produces assertive instruction", () => {
  assert(
    buildSystemPrompt(MOCK_PROFILE, MOCK_RESOLVED_PROFILE, "argumentative", "mla").includes("Write assertively"),
    "Missing assertive instruction",
  );
});

test("High passive voice rate profile produces passive voice instruction", () => {
  assert(
    buildSystemPrompt(MOCK_PROFILE, MOCK_RESOLVED_PROFILE, "argumentative", "mla").includes("Use passive voice frequently"),
    "Missing passive voice instruction",
  );
});

test("sectionPromptBuilder returns a non-empty string", () => {
  assert(buildSectionPrompt(CLAIM_SECTION, MOCK_PLAN, "mla", 1, 3).length > 0, "Prompt was empty");
});

test("sectionPromptBuilder contains target word count", () => {
  assert(buildSectionPrompt(CLAIM_SECTION, MOCK_PLAN, "mla", 1, 3).includes("Target word count: 180"), "Missing target count");
});

test("sectionPromptBuilder contains section label", () => {
  assert(buildSectionPrompt(CLAIM_SECTION, MOCK_PLAN, "mla", 1, 3).includes("Claim 1"), "Missing label");
});

test("Sections with evidence include source title in prompt", () => {
  assert(
    buildSectionPrompt(CLAIM_SECTION, MOCK_PLAN, "mla", 1, 3).includes(MOCK_EVIDENCE.title),
    "Missing source title",
  );
});

test("Sections with no evidence include Do not fabricate instruction", () => {
  assert(
    buildSectionPrompt(INTRO_SECTION, MOCK_PLAN, "mla", 0, 3).includes("Do not fabricate"),
    "Missing no-evidence instruction",
  );
});

test("Introduction section includes thesis slot instruction", () => {
  assert(
    buildSectionPrompt(INTRO_SECTION, MOCK_PLAN, "mla", 0, 3).includes("thesis statement slot"),
    "Missing thesis instruction",
  );
});

test("Counter-argument section includes steelman instruction", () => {
  assert(
    buildSectionPrompt(COUNTER_SECTION, MOCK_PLAN, "mla", 2, 4).includes("Steelman"),
    "Missing steelman instruction",
  );
});

test("Conclusion section includes no-new-evidence instruction", () => {
  assert(
    buildSectionPrompt(CONCLUSION_SECTION, MOCK_PLAN, "mla", 2, 3).includes("Do not introduce new evidence"),
    "Missing conclusion instruction",
  );
});

test("Section with conflict flags includes conflict warning text", () => {
  assert(
    buildSectionPrompt(CONFLICT_SECTION, MOCK_PLAN, "mla", 1, 3).includes("contrasting views"),
    "Missing conflict warning",
  );
});

test("assembleDraft joins sections with double newline", () => {
  const assembled = assembleDraft([createGeneratedSection(1, "First."), createGeneratedSection(2, "Second.")], "argumentative");
  assert(assembled === "First.\n\nSecond.", "Draft was not joined with double newline");
});

test("extractWordCount returns correct count for known string", () => {
  assert(extractWordCount("one two three") === 3, "Incorrect word count");
});

test("extractWordCount returns 0 for empty string", () => {
  assert(extractWordCount("") === 0, "Expected 0 words");
});

test("Non-empty text produces at least one chunk", () => {
  assert(buildDraftChunks("This is a sentence.").length > 0, "No chunks produced");
});

test("All chunks have delayMs > 0", () => {
  assert(buildDraftChunks("This is a sentence.").every((chunk) => chunk.delayMs > 0), "Found non-positive delay");
});

test("At least one pause chunk exists for long text", () => {
  const text = "One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen.";
  assert(buildDraftChunks(text).some((chunk) => chunk.isPause), "Missing pause chunk");
});

test("Final assembled text from non-correction chunks matches original text content", () => {
  const text = "One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen.";
  const rebuiltText = buildDraftChunks(text)
    .filter((chunk) => !chunk.isCorrection)
    .map((chunk) => chunk.text)
    .join("");
  assert(rebuiltText === text, "Chunk text did not rebuild original text");
});

test("generationPipeline returns a GenerationResult with draft field", async () => {
  const originalFetch = installFetchStub();
  const result = await runGenerationPipeline({
    plan: MOCK_PLAN,
    profile: MOCK_PROFILE,
    config: { enableStyleDeltaCheck: false },
  });
  globalThis.fetch = originalFetch;
  assert(Boolean(result.draft), "Missing draft");
});

test("generationPipeline draft.schemaVersion is 3.0.0", async () => {
  const originalFetch = installFetchStub();
  const result = await runGenerationPipeline({
    plan: MOCK_PLAN,
    profile: MOCK_PROFILE,
    config: { enableStyleDeltaCheck: false },
  });
  globalThis.fetch = originalFetch;
  assert(result.draft.schemaVersion === "3.0.0", "Wrong schema version");
});

test("generationPipeline draft.sections.length matches plan.sections.length", async () => {
  const originalFetch = installFetchStub();
  const result = await runGenerationPipeline({
    plan: MOCK_PLAN,
    profile: MOCK_PROFILE,
    config: { enableStyleDeltaCheck: false },
  });
  globalThis.fetch = originalFetch;
  assert(result.draft.sections.length === MOCK_PLAN.sections.length, "Section count mismatch");
});

test("generationPipeline draft.assembledText is non-empty", async () => {
  const originalFetch = installFetchStub();
  const result = await runGenerationPipeline({
    plan: MOCK_PLAN,
    profile: MOCK_PROFILE,
    config: { enableStyleDeltaCheck: false },
  });
  globalThis.fetch = originalFetch;
  assert(result.draft.assembledText.length > 0, "Assembled text was empty");
});

test("generationPipeline draft.totalAssignedEvidence is a number", async () => {
  const originalFetch = installFetchStub();
  const result = await runGenerationPipeline({
    plan: MOCK_PLAN,
    profile: MOCK_PROFILE,
    config: { enableStyleDeltaCheck: false },
  });
  globalThis.fetch = originalFetch;
  assert(typeof result.draft.totalAssignedEvidence === "number", "totalAssignedEvidence was not a number");
});

test("GeneratedSection has wordCount, targetWordCount, wordCountDelta", async () => {
  const originalFetch = installFetchStub();
  const result = await runGenerationPipeline({
    plan: MOCK_PLAN,
    profile: MOCK_PROFILE,
    config: { enableStyleDeltaCheck: false },
  });
  globalThis.fetch = originalFetch;
  const section = result.draft.sections[0];
  assert(
    typeof section.wordCount === "number" &&
      typeof section.targetWordCount === "number" &&
      typeof section.wordCountDelta === "number",
    "Missing word count fields",
  );
});

test("GeneratedSection has draftChunks array", async () => {
  const originalFetch = installFetchStub();
  const result = await runGenerationPipeline({
    plan: MOCK_PLAN,
    profile: MOCK_PROFILE,
    config: { enableStyleDeltaCheck: false },
  });
  globalThis.fetch = originalFetch;
  assert(Array.isArray(result.draft.sections[0].draftChunks), "draftChunks was not an array");
});

test("styleWarnings is an array", async () => {
  const originalFetch = installFetchStub();
  const result = await runGenerationPipeline({
    plan: MOCK_PLAN,
    profile: MOCK_PROFILE,
    config: { enableStyleDeltaCheck: false },
  });
  globalThis.fetch = originalFetch;
  assert(Array.isArray(result.draft.styleWarnings), "styleWarnings was not an array");
});

test("worksСited is a deduplicated array", async () => {
  const originalFetch = installFetchStub();
  const result = await runGenerationPipeline({
    plan: MOCK_PLAN,
    profile: MOCK_PROFILE,
    config: { enableStyleDeltaCheck: false },
  });
  globalThis.fetch = originalFetch;
  const uniqueCount = new Set(result.draft.worksСited).size;
  assert(Array.isArray(result.draft.worksСited) && uniqueCount === result.draft.worksСited.length, "works cited was not deduplicated");
});

let passed = 0;
let failed = 0;

for (const { name, run } of tests) {
  try {
    await run();
    passed += 1;
    console.log(`✅ PASS ${name}`);
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ FAIL ${name}: ${message}`);
  }
}

console.log(`\nSummary: ${passed} passed, ${failed} failed, ${tests.length} total`);

if (failed > 0) {
  process.exit(1);
}
