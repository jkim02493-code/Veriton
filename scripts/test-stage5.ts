import type { GeneratedDraft, GeneratedSection } from "../lib/generation";
import {
  buildOverallSummary,
  computeNotesId,
  extractKeyClaims,
  extractKeyTerms,
  generateReviewerNotes,
  summariseSection,
} from "../lib/reviewer-notes";
import type { KeyTerm, ReviewerNotesConfig } from "../lib/reviewer-notes";

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

const MOCK_SECTION_TEXT =
  "The Industrial Revolution demonstrates how technology can reshape daily life, work, and political debate in a short historical period. Northern Factory towns grew quickly because steam power made production faster, and therefore families moved closer to mills for wages and stability. This transformation also shows that urbanisation was not only an economic change but a social change, because communities had to adapt to crowding, pollution, and new schedules. Research shows that mechanisation influenced education, housing, and labour organisation (Smith, 2021). The evidence suggests that industrialisation may have created opportunity while also producing inequality for workers (Jones, 2020). Industrialisation changed family routines, and industrialisation made public health more important. Consequently, the section argues that technological progress cannot be judged only by output; it must also be judged by how people lived through the transition.";

const MOCK_GENERATED_SECTION: GeneratedSection = {
  sectionIndex: 0,
  role: "claim",
  label: "Claim 1",
  generatedText: MOCK_SECTION_TEXT,
  wordCount: 150,
  targetWordCount: 170,
  wordCountDelta: -20,
  styleDeltaResult: null,
  citationsUsed: ["(Smith, 2021)", "(Jones, 2020)"],
  draftChunks: [],
};

const SECOND_GENERATED_SECTION: GeneratedSection = {
  ...MOCK_GENERATED_SECTION,
  sectionIndex: 1,
  label: "Claim 2",
};

const MOCK_DRAFT: GeneratedDraft = {
  schemaVersion: "3.0.0",
  draftId: "draft-stage5",
  planId: "plan-stage5",
  profileId: "profile-stage5",
  essayType: "argumentative",
  citationFormat: "apa",
  sections: [MOCK_GENERATED_SECTION, SECOND_GENERATED_SECTION],
  assembledText: `${MOCK_SECTION_TEXT}\n\n${MOCK_SECTION_TEXT}`,
  totalWordCount: 300,
  targetWordCount: 500,
  totalAssignedEvidence: 2,
  overallStyleSimilarity: 0.8,
  worksСited: ["(Jones, 2020)", "(Smith, 2021)"],
  styleWarnings: [],
  generatedAt: "2026-05-15T00:00:00.000Z",
};

const MOCK_CONFIG: ReviewerNotesConfig = {
  model: "claude-sonnet-4-20250514",
  maxTokensPerSection: 600,
  includeDefenceQuestions: true,
  includeKeyTerms: true,
  includeEvidenceSummary: true,
  readingLevel: "standard",
};

const tests: TestCase[] = [];

function test(name: string, run: () => void | Promise<void>): void {
  tests.push({ name, run });
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function mockSummaryText(): string {
  return JSON.stringify({
    plainSummary:
      "This section explains that industrial change affected both the economy and ordinary life. It argues that progress created benefits but also made new social problems visible.",
    keyTermDefinitions: {
      "Industrial Revolution":
        "A period when machines and factories changed how goods were made and how people lived.",
      industrialisation:
        "The process of a society becoming organised around machine production and factory work.",
    },
    evidenceSummary:
      "(Smith, 2021) supports the claim about mechanisation. (Jones, 2020) shows the mixed effects on workers.",
    defenceQuestions: [
      {
        question: "Why does this section connect technology with social change?",
        suggestedAnswer:
          "Because the section argues that machines changed not just production, but also housing, work, health, and daily routines.",
      },
    ],
  });
}

function installFetchStub(options: { malformedJson?: boolean } = {}): { restore: () => void; calls: string[] } {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    const text = options.malformedJson ? "not-json-response" : mockSummaryText();

    return new Response(
      JSON.stringify({
        content: [{ type: "text", text }],
      }),
      { status: 200 },
    );
  }) as typeof fetch;

  return {
    restore: () => {
      globalThis.fetch = originalFetch;
    },
    calls,
  };
}

test("extractKeyClaims returns claim for text with signal words", () => {
  assert(extractKeyClaims(MOCK_SECTION_TEXT, MOCK_GENERATED_SECTION.citationsUsed).length >= 1, "Expected key claim");
});

test("extractKeyClaims marks demonstrates as strong", () => {
  const claims = extractKeyClaims("This demonstrates a clear pattern.", ["(Smith, 2021)"]);
  assert(claims[0]?.claimStrength === "strong", "Expected strong claim");
});

test("extractKeyClaims marks suggests as weak", () => {
  const claims = extractKeyClaims("This suggests a possible pattern.", ["(Smith, 2021)"]);
  assert(claims[0]?.claimStrength === "weak", "Expected weak claim");
});

test("extractKeyClaims returns fallback claim when no signals exist", () => {
  const claims = extractKeyClaims("This sentence describes the topic. Another sentence follows.", []);
  assert(claims.length === 1 && claims[0]?.claimText.includes("describes"), "Expected fallback claim");
});

test("extractKeyClaims claimText stays under 200 characters", () => {
  const longSentence = `This demonstrates ${"important ".repeat(60)}change.`;
  const claims = extractKeyClaims(longSentence, []);
  assert((claims[0]?.claimText.length ?? 0) <= 200, "Claim text exceeded 200 characters");
});

test("extractKeyClaims never returns more than 3 claims", () => {
  const text = "This shows one. This shows two. This shows three. This shows four.";
  assert(extractKeyClaims(text, []).length <= 3, "Returned too many claims");
});

test("extractKeyTerms returns an array", () => {
  assert(Array.isArray(extractKeyTerms(MOCK_SECTION_TEXT)), "Expected array");
});

test("extractKeyTerms definitions are empty strings", () => {
  assert(extractKeyTerms(MOCK_SECTION_TEXT).every((term) => term.definition === ""), "Expected empty definitions");
});

test("extractKeyTerms returns max 4 terms", () => {
  assert(extractKeyTerms(MOCK_SECTION_TEXT).length <= 4, "Returned too many terms");
});

test("buildOverallSummary returns non-empty string containing essayType", () => {
  const summary = buildOverallSummary(
    [
      {
        sectionIndex: 0,
        sectionLabel: "Claim 1",
        role: "claim",
        plainSummary: "Summary.",
        keyClaims: extractKeyClaims(MOCK_SECTION_TEXT, MOCK_GENERATED_SECTION.citationsUsed),
        keyTerms: [],
        evidenceSummary: "",
        defenceQuestions: [],
        wordCount: 150,
      },
    ],
    "argumentative",
  );
  assert(summary.length > 0 && summary.includes("argumentative"), "Summary missing essay type");
});

test("computeNotesId is deterministic", () => {
  assert(computeNotesId("draft-one") === computeNotesId("draft-one"), "Expected deterministic notes id");
});

test("computeNotesId differs for different draftIds", () => {
  assert(computeNotesId("draft-one") !== computeNotesId("draft-two"), "Expected different notes ids");
});

test("summariseSection returns non-empty plainSummary", async () => {
  const { restore } = installFetchStub();
  const result = await summariseSection(MOCK_GENERATED_SECTION, extractKeyTerms(MOCK_SECTION_TEXT), MOCK_CONFIG);
  restore();
  assert(result.plainSummary.length > 0, "Expected plain summary");
});

test("summariseSection returns defenceQuestions array", async () => {
  const { restore } = installFetchStub();
  const result = await summariseSection(MOCK_GENERATED_SECTION, extractKeyTerms(MOCK_SECTION_TEXT), MOCK_CONFIG);
  restore();
  assert(result.defenceQuestions.length >= 1, "Expected defence questions");
});

test("summariseSection handles malformed JSON gracefully", async () => {
  const { restore } = installFetchStub({ malformedJson: true });
  const result = await summariseSection(MOCK_GENERATED_SECTION, [], MOCK_CONFIG);
  restore();
  assert(result.plainSummary === "not-json-response", "Expected raw text fallback");
});

test("generateReviewerNotes returns ReviewerNotesResult", async () => {
  const { restore } = installFetchStub();
  const result = await generateReviewerNotes({ draft: MOCK_DRAFT, config: MOCK_CONFIG });
  restore();
  assert(Boolean(result.notes), "Missing notes");
});

test("generateReviewerNotes schemaVersion is 5.0.0", async () => {
  const { restore } = installFetchStub();
  const result = await generateReviewerNotes({ draft: MOCK_DRAFT, config: MOCK_CONFIG });
  restore();
  assert(result.notes.schemaVersion === "5.0.0", "Wrong schema version");
});

test("generateReviewerNotes sectionNotes length matches draft sections", async () => {
  const { restore } = installFetchStub();
  const result = await generateReviewerNotes({ draft: MOCK_DRAFT, config: MOCK_CONFIG });
  restore();
  assert(result.notes.sectionNotes.length === MOCK_DRAFT.sections.length, "Section note count mismatch");
});

test("generateReviewerNotes notesId is non-empty and deterministic", async () => {
  const { restore } = installFetchStub();
  const result = await generateReviewerNotes({ draft: MOCK_DRAFT, config: MOCK_CONFIG });
  restore();
  assert(
    result.notes.notesId.length > 0 && result.notes.notesId === computeNotesId(MOCK_DRAFT.draftId),
    "Invalid notesId",
  );
});

test("generateReviewerNotes overallSummary is non-empty", async () => {
  const { restore } = installFetchStub();
  const result = await generateReviewerNotes({ draft: MOCK_DRAFT, config: MOCK_CONFIG });
  restore();
  assert(result.notes.overallSummary.length > 0, "Missing overall summary");
});

test("generateReviewerNotes totalApiCalls equals sections processed", async () => {
  const { restore } = installFetchStub();
  const result = await generateReviewerNotes({ draft: MOCK_DRAFT, config: MOCK_CONFIG });
  restore();
  assert(result.totalApiCalls === MOCK_DRAFT.sections.length, "totalApiCalls mismatch");
});

test("generateReviewerNotes errors is an array", async () => {
  const { restore } = installFetchStub();
  const result = await generateReviewerNotes({ draft: MOCK_DRAFT, config: MOCK_CONFIG });
  restore();
  assert(Array.isArray(result.errors), "Expected errors array");
});

async function runTests(): Promise<void> {
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
}

runTests().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`❌ FAIL test runner: ${message}`);
  process.exit(1);
});
