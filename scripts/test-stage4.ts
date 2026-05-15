import type { DraftChunk, GeneratedDraft, GeneratedSection } from "../lib/generation";
import {
  computeTotalEstimatedDurationMs,
  deleteText,
  insertText,
  runLiveDrafting,
  scheduleChunks,
  simulateCorrection,
} from "../lib/live-drafting";
import type { DocsSessionConfig, ScheduledChunk } from "../lib/live-drafting";

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

type FetchCall = {
  url: string;
  init: RequestInit | undefined;
};

const MOCK_DRAFT_CHUNKS: DraftChunk[] = [
  { chunkIndex: 0, text: "The opening ", delayMs: 10, isPause: false, isCorrection: false },
  { chunkIndex: 1, text: "claim establishes ", delayMs: 10, isPause: false, isCorrection: false },
  { chunkIndex: 2, text: "", delayMs: 20, isPause: true, isCorrection: false },
  { chunkIndex: 3, text: "context for readers. ", delayMs: 10, isPause: false, isCorrection: false },
  { chunkIndex: 4, text: "rs.", delayMs: 10, isPause: false, isCorrection: true },
  { chunkIndex: 5, text: "rs.", delayMs: 10, isPause: false, isCorrection: true },
  { chunkIndex: 6, text: "Evidence then extends ", delayMs: 10, isPause: false, isCorrection: false },
  { chunkIndex: 7, text: "", delayMs: 20, isPause: true, isCorrection: false },
  { chunkIndex: 8, text: "the argument with detail. ", delayMs: 10, isPause: false, isCorrection: false },
  {
    chunkIndex: 9,
    text: "This deliberately longer text chunk checks that the scheduler keeps larger drafting units intact. ",
    delayMs: 10,
    isPause: false,
    isCorrection: false,
  },
  { chunkIndex: 10, text: "It remains readable. ", delayMs: 10, isPause: false, isCorrection: false },
  { chunkIndex: 11, text: "The section closes. ", delayMs: 10, isPause: false, isCorrection: false },
];

const MOCK_GENERATED_SECTIONS: GeneratedSection[] = [
  {
    sectionIndex: 0,
    role: "introduction",
    label: "Introduction",
    generatedText: "The opening claim establishes context for readers.",
    wordCount: 7,
    targetWordCount: 100,
    wordCountDelta: -93,
    styleDeltaResult: null,
    citationsUsed: [],
    draftChunks: MOCK_DRAFT_CHUNKS.slice(0, 6),
  },
  {
    sectionIndex: 1,
    role: "claim",
    label: "Claim 1",
    generatedText: "Evidence then extends the argument with detail.",
    wordCount: 7,
    targetWordCount: 120,
    wordCountDelta: -113,
    styleDeltaResult: null,
    citationsUsed: [],
    draftChunks: MOCK_DRAFT_CHUNKS.slice(6, 12),
  },
];

const MOCK_CONFIG: DocsSessionConfig = {
  documentId: "test-doc-123",
  accessToken: "mock-token",
  insertionIndex: 1,
  interChunkDelayMs: 0,
  pauseJitterMs: 0,
  correctionEnabled: true,
  sectionBreakStyle: "doubleNewline",
};

const MOCK_DRAFT: GeneratedDraft = {
  schemaVersion: "3.0.0",
  draftId: "draft-stage4",
  planId: "plan-stage4",
  profileId: "profile-stage4",
  essayType: "argumentative",
  citationFormat: "mla",
  sections: MOCK_GENERATED_SECTIONS,
  assembledText: "The opening claim establishes context for readers.\n\nEvidence then extends the argument with detail.",
  totalWordCount: 14,
  targetWordCount: 220,
  totalAssignedEvidence: 1,
  overallStyleSimilarity: 0.8,
  worksСited: [],
  styleWarnings: [],
  generatedAt: "2026-05-14T00:00:00.000Z",
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

function installImmediateTimer(): typeof setTimeout {
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = ((handler: TimerHandler): number => {
    if (typeof handler === "function") {
      handler();
    }

    return 0;
  }) as typeof setTimeout;

  return originalSetTimeout;
}

function installFetchStub(options: { failBatchUpdates?: boolean } = {}): { calls: FetchCall[]; restore: () => void } {
  const originalFetch = globalThis.fetch;
  const calls: FetchCall[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });

    if (options.failBatchUpdates && url.includes(":batchUpdate")) {
      return new Response("forced failure", { status: 500 });
    }

    if (init?.method === "GET") {
      return new Response(JSON.stringify({ body: { content: [{ endIndex: 20 }] } }), { status: 200 });
    }

    return new Response(JSON.stringify({ replies: [{}] }), { status: 200 });
  }) as typeof fetch;

  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

function authHeader(init: RequestInit | undefined): string {
  const headers = init?.headers as Record<string, string> | undefined;

  return headers?.Authorization ?? "";
}

function expectedProcessedApiCalls(chunks: ScheduledChunk[]): number {
  return chunks.reduce((total, chunk) => {
    if (chunk.isPause) {
      return total;
    }

    if (chunk.isCorrection) {
      return total + 2;
    }

    return total + 1;
  }, 0);
}

test("scheduleChunks returns a flat array of ScheduledChunk", () => {
  const chunks = scheduleChunks(MOCK_GENERATED_SECTIONS, MOCK_CONFIG);
  assert(Array.isArray(chunks) && chunks.length > 0, "Expected flat scheduled chunk array");
});

test("Total chunk count equals section chunks plus section break chunks", () => {
  const chunks = scheduleChunks(MOCK_GENERATED_SECTIONS, MOCK_CONFIG);
  const rawChunkCount = MOCK_GENERATED_SECTIONS.reduce((total, section) => total + section.draftChunks.length, 0);
  assert(chunks.length === rawChunkCount + 1, "Unexpected scheduled chunk count");
});

test("Section break chunks are inserted between sections only", () => {
  const chunks = scheduleChunks(MOCK_GENERATED_SECTIONS, MOCK_CONFIG);
  const sectionBreaks = chunks.filter((chunk) => chunk.isSectionBreak);
  assert(sectionBreaks.length === 1, "Expected exactly one section break");
  assert(chunks[chunks.length - 1]?.isSectionBreak === false, "Found section break after final section");
});

test("Section break text is double newline", () => {
  const chunks = scheduleChunks(MOCK_GENERATED_SECTIONS, MOCK_CONFIG);
  assert(chunks.find((chunk) => chunk.isSectionBreak)?.text === "\n\n", "Expected double newline section break");
});

test("All chunks have sequential globalChunkIndex values", () => {
  const chunks = scheduleChunks(MOCK_GENERATED_SECTIONS, MOCK_CONFIG);
  assert(chunks.every((chunk, index) => chunk.globalChunkIndex === index), "globalChunkIndex was not sequential");
});

test("Correction chunks are excluded when correctionEnabled is false", () => {
  const chunks = scheduleChunks(MOCK_GENERATED_SECTIONS, { ...MOCK_CONFIG, correctionEnabled: false });
  assert(chunks.every((chunk) => !chunk.isCorrection), "Found correction chunk while disabled");
});

test("Pause chunks are preserved when correctionEnabled is false", () => {
  const chunks = scheduleChunks(MOCK_GENERATED_SECTIONS, { ...MOCK_CONFIG, correctionEnabled: false });
  assert(chunks.some((chunk) => chunk.isPause), "Pause chunks were removed");
});

test("computeTotalEstimatedDurationMs returns number greater than 0", () => {
  assert(computeTotalEstimatedDurationMs(scheduleChunks(MOCK_GENERATED_SECTIONS, MOCK_CONFIG)) > 0, "Expected duration");
});

test("computeTotalEstimatedDurationMs returns 0 for empty chunk list", () => {
  assert(computeTotalEstimatedDurationMs([]) === 0, "Expected zero duration");
});

test("simulateCorrection calls deleteText and insertText", async () => {
  const timer = installImmediateTimer();
  const { calls, restore } = installFetchStub();
  await simulateCorrection("test-doc-123", "mock-token", 10, scheduleChunks(MOCK_GENERATED_SECTIONS, MOCK_CONFIG)[4], undefined);
  restore();
  globalThis.setTimeout = timer;
  assert(calls.length === 2, "Expected delete and insert calls");
});

test("simulateCorrection returns same currentIndex", async () => {
  const timer = installImmediateTimer();
  const { restore } = installFetchStub();
  const currentIndex = await simulateCorrection(
    "test-doc-123",
    "mock-token",
    10,
    scheduleChunks(MOCK_GENERATED_SECTIONS, MOCK_CONFIG)[4],
    undefined,
  );
  restore();
  globalThis.setTimeout = timer;
  assert(currentIndex === 10, "Expected unchanged currentIndex");
});

test("insertText builds correct URL with documentId", async () => {
  const { calls, restore } = installFetchStub();
  await insertText("test-doc-123", "mock-token", 1, "hello");
  restore();
  assert(calls[0]?.url === "https://docs.googleapis.com/v1/documents/test-doc-123:batchUpdate", "Unexpected insert URL");
});

test("insertText returns updatedIndex", async () => {
  const { restore } = installFetchStub();
  const result = await insertText("test-doc-123", "mock-token", 1, "hello");
  restore();
  assert(result.updatedIndex === 6, "Incorrect updatedIndex");
});

test("deleteText builds correct URL with documentId", async () => {
  const { calls, restore } = installFetchStub();
  await deleteText("test-doc-123", "mock-token", 1, 3);
  restore();
  assert(calls[0]?.url === "https://docs.googleapis.com/v1/documents/test-doc-123:batchUpdate", "Unexpected delete URL");
});

test("Docs functions include Authorization header with Bearer token", async () => {
  const { calls, restore } = installFetchStub();
  await insertText("test-doc-123", "mock-token", 1, "hello");
  await deleteText("test-doc-123", "mock-token", 1, 3);
  restore();
  assert(calls.every((call) => authHeader(call.init) === "Bearer mock-token"), "Missing Authorization header");
});

test("runLiveDrafting returns a LiveDraftingResult", async () => {
  const timer = installImmediateTimer();
  const { restore } = installFetchStub();
  const result = await runLiveDrafting({ draft: MOCK_DRAFT, config: MOCK_CONFIG });
  restore();
  globalThis.setTimeout = timer;
  assert(Boolean(result.sessionState), "Missing sessionState");
});

test("runLiveDrafting completes when no errors occur", async () => {
  const timer = installImmediateTimer();
  const { restore } = installFetchStub();
  const result = await runLiveDrafting({ draft: MOCK_DRAFT, config: MOCK_CONFIG });
  restore();
  globalThis.setTimeout = timer;
  assert(result.sessionState.status === "completed", "Expected completed status");
});

test("runLiveDrafting totalChunks matches scheduled chunk count", async () => {
  const timer = installImmediateTimer();
  const { restore } = installFetchStub();
  const result = await runLiveDrafting({ draft: MOCK_DRAFT, config: MOCK_CONFIG });
  restore();
  globalThis.setTimeout = timer;
  assert(result.sessionState.totalChunks === scheduleChunks(MOCK_GENERATED_SECTIONS, MOCK_CONFIG).length, "totalChunks mismatch");
});

test("runLiveDrafting inserts characters after successful run", async () => {
  const timer = installImmediateTimer();
  const { restore } = installFetchStub();
  const result = await runLiveDrafting({ draft: MOCK_DRAFT, config: MOCK_CONFIG });
  restore();
  globalThis.setTimeout = timer;
  assert(result.sessionState.charactersInserted > 0, "Expected inserted characters");
});

test("runLiveDrafting errors are empty when API calls succeed", async () => {
  const timer = installImmediateTimer();
  const { restore } = installFetchStub();
  const result = await runLiveDrafting({ draft: MOCK_DRAFT, config: MOCK_CONFIG });
  restore();
  globalThis.setTimeout = timer;
  assert(result.sessionState.errors.length === 0, "Expected no errors");
});

test("runLiveDrafting fails after 5 API failures", async () => {
  const timer = installImmediateTimer();
  const { restore } = installFetchStub({ failBatchUpdates: true });
  const result = await runLiveDrafting({ draft: MOCK_DRAFT, config: MOCK_CONFIG });
  restore();
  globalThis.setTimeout = timer;
  assert(result.sessionState.status === "failed", "Expected failed status");
});

test("Pause chunks do not trigger API calls", async () => {
  const timer = installImmediateTimer();
  const { calls, restore } = installFetchStub();
  const result = await runLiveDrafting({ draft: MOCK_DRAFT, config: MOCK_CONFIG });
  restore();
  globalThis.setTimeout = timer;
  const pauseCount = scheduleChunks(MOCK_GENERATED_SECTIONS, MOCK_CONFIG).filter((chunk) => chunk.isPause).length;
  assert(calls.length === result.totalApiCalls, "Fetch calls and totalApiCalls should match");
  assert(result.sessionState.totalChunks - pauseCount >= result.totalApiCalls, "Pause chunks appear to trigger calls");
});

test("Normal text chunks increment charactersInserted correctly", async () => {
  const timer = installImmediateTimer();
  const { restore } = installFetchStub();
  const result = await runLiveDrafting({ draft: MOCK_DRAFT, config: MOCK_CONFIG });
  restore();
  globalThis.setTimeout = timer;
  const expectedCharacters = scheduleChunks(MOCK_GENERATED_SECTIONS, MOCK_CONFIG)
    .filter((chunk) => !chunk.isPause && !chunk.isCorrection)
    .reduce((total, chunk) => total + chunk.text.length, 0);
  assert(result.sessionState.charactersInserted === expectedCharacters, "charactersInserted mismatch");
});

test("totalApiCalls equals text calls plus 2 per correction chunk", async () => {
  const timer = installImmediateTimer();
  const { restore } = installFetchStub();
  const result = await runLiveDrafting({ draft: MOCK_DRAFT, config: MOCK_CONFIG });
  restore();
  globalThis.setTimeout = timer;
  assert(
    result.totalApiCalls === expectedProcessedApiCalls(scheduleChunks(MOCK_GENERATED_SECTIONS, MOCK_CONFIG)),
    "totalApiCalls mismatch",
  );
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
