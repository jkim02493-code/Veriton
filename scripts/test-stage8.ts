import { ChunkPlayer } from "../extension/src/content/chunkPlayer";
import { isGoogleDoc, readDocumentText } from "../extension/src/content/docReader";
import { focusEditor, insertTextAtCaret } from "../extension/src/content/docWriter";
import { registerMessageHandler } from "../extension/src/content/messageHandler";
import type { ContentMessage, SerializedChunk } from "../extension/src/content/types";

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

type MessageListener = (
  message: ContentMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean;

class FakeElement {
  textContent: string;
  innerText: string;
  focused: boolean;
  dispatchedEvents: string[];

  constructor(textContent: string) {
    this.textContent = textContent;
    this.innerText = textContent;
    this.focused = false;
    this.dispatchedEvents = [];
  }

  focus(): void {
    this.focused = true;
    fakeDocument.activeElement = this;
  }

  dispatchEvent(event: Event): boolean {
    this.dispatchedEvents.push(event.type);
    return true;
  }
}

class FakeDocument {
  wordNodes: FakeElement[] = [];
  paragraphNodes: FakeElement[] = [];
  textbox: FakeElement | null = null;
  editor: FakeElement | null = new FakeElement("");
  body: FakeElement = new FakeElement("");
  activeElement: FakeElement | null = null;
  execCommandCalls: Array<{ command: string; value?: string }> = [];
  execCommandResult = true;

  querySelectorAll(selector: string): FakeElement[] {
    if (selector === ".kix-wordhtmlgenerator-word-node") {
      return this.wordNodes;
    }
    if (selector === ".kix-paragraphrenderer") {
      return this.paragraphNodes;
    }
    return [];
  }

  querySelector(selector: string): FakeElement | null {
    if (selector === ".kix-appview-editor") {
      return this.editor;
    }
    if (selector === '[role="textbox"]' || selector === '[aria-label*="Document"]') {
      return this.textbox;
    }
    return null;
  }

  execCommand(command: string, _showUi?: boolean, value?: string): boolean {
    this.execCommandCalls.push({ command, value });
    return this.execCommandResult;
  }
}

const fakeDocument = new FakeDocument();
let registeredListener: MessageListener | null = null;

globalThis.document = fakeDocument as unknown as Document;
globalThis.window = {
  location: { href: "https://docs.google.com/document/d/test" },
  getSelection: () => ({ collapseToEnd: () => undefined }),
} as unknown as Window & typeof globalThis;
globalThis.navigator = { platform: "MacIntel" } as Navigator;
globalThis.KeyboardEvent = class extends Event {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;

  constructor(type: string, init: KeyboardEventInit = {}) {
    super(type);
    this.key = init.key ?? "";
    this.code = init.code ?? "";
    this.ctrlKey = init.ctrlKey ?? false;
    this.metaKey = init.metaKey ?? false;
  }
} as typeof KeyboardEvent;
globalThis.InputEvent = class extends Event {
  inputType: string;
  data: string | null;

  constructor(type: string, init: InputEventInit = {}) {
    super(type);
    this.inputType = init.inputType ?? "";
    this.data = init.data ?? null;
  }
} as typeof InputEvent;
globalThis.chrome = {
  runtime: {
    onMessage: {
      addListener: (listener: MessageListener) => {
        registeredListener = listener;
      },
    },
  },
  tabs: {},
} as unknown as typeof chrome;

const tests: TestCase[] = [];

function test(name: string, run: () => void | Promise<void>): void {
  tests.push({ name, run });
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function resetDom(): void {
  fakeDocument.wordNodes = [];
  fakeDocument.paragraphNodes = [];
  fakeDocument.textbox = null;
  fakeDocument.editor = new FakeElement("");
  fakeDocument.body = new FakeElement("");
  fakeDocument.activeElement = null;
  fakeDocument.execCommandCalls = [];
  fakeDocument.execCommandResult = true;
  window.location.href = "https://docs.google.com/document/d/test";
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

async function waitForMicrotask(): Promise<void> {
  await Promise.resolve();
}

test("readDocumentText returns success true when DOM elements found", () => {
  resetDom();
  fakeDocument.wordNodes = [new FakeElement("Hello"), new FakeElement("world")];
  assert(readDocumentText().success, "Expected success");
});

test("readDocumentText wordCount matches returned text", () => {
  resetDom();
  fakeDocument.wordNodes = [new FakeElement("Hello"), new FakeElement("world again")];
  const result = readDocumentText();
  assert(result.wordCount === 3, "Wrong word count");
});

test("readDocumentText returns success false when no elements found", () => {
  resetDom();
  assert(!readDocumentText().success, "Expected failure");
});

test("readDocumentText falls back to strategy 2", () => {
  resetDom();
  fakeDocument.paragraphNodes = [new FakeElement("Paragraph one"), new FakeElement("Paragraph two")];
  const result = readDocumentText();
  assert(result.success && result.text.includes("Paragraph one"), "Fallback strategy failed");
});

test("readDocumentText returns error string when all strategies fail", () => {
  resetDom();
  const result = readDocumentText();
  assert(typeof result.error === "string" && result.error.length > 0, "Missing error");
});

test("isGoogleDoc returns true for docs URL", () => {
  resetDom();
  assert(isGoogleDoc(), "Expected Google Doc");
});

test("isGoogleDoc returns false for other URLs", () => {
  resetDom();
  window.location.href = "https://example.com";
  assert(!isGoogleDoc(), "Expected non-Google Doc");
});

test("insertTextAtCaret calls focusEditor before inserting", () => {
  resetDom();
  insertTextAtCaret("hello");
  assert(fakeDocument.editor?.focused === true, "Editor was not focused");
});

test("insertTextAtCaret returns success true on execCommand success", () => {
  resetDom();
  assert(insertTextAtCaret("hello").success, "Expected write success");
});

test("insertTextAtCaret returns charactersInserted equal to text length", () => {
  resetDom();
  assert(insertTextAtCaret("hello").charactersInserted === 5, "Wrong inserted count");
});

test("insertTextAtCaret returns success false when editor not found", () => {
  resetDom();
  fakeDocument.editor = null;
  fakeDocument.textbox = null;
  assert(!insertTextAtCaret("hello").success, "Expected write failure");
});

test("ChunkPlayer processes all chunks and returns final state", async () => {
  resetDom();
  const timer = installImmediateTimer();
  const player = new ChunkPlayer();
  const state = await player.play([{ text: "hi", delayMs: 1, isPause: false, isCorrection: false }]);
  globalThis.setTimeout = timer;
  assert(state.chunksProcessed === 1 && !state.isPlaying, "Unexpected final state");
});

test("ChunkPlayer pause chunks do not call insertTextAtCaret", async () => {
  resetDom();
  const timer = installImmediateTimer();
  const player = new ChunkPlayer();
  await player.play([{ text: "", delayMs: 1, isPause: true, isCorrection: false }]);
  globalThis.setTimeout = timer;
  assert(!fakeDocument.execCommandCalls.some((call) => call.command === "insertText"), "Pause inserted text");
});

test("ChunkPlayer normal chunks increment charactersInserted", async () => {
  resetDom();
  const timer = installImmediateTimer();
  const player = new ChunkPlayer();
  const state = await player.play([{ text: "hello", delayMs: 1, isPause: false, isCorrection: false }]);
  globalThis.setTimeout = timer;
  assert(state.charactersInserted === 5, "charactersInserted mismatch");
});

test("ChunkPlayer chunksProcessed equals total chunks after completion", async () => {
  resetDom();
  const timer = installImmediateTimer();
  const player = new ChunkPlayer();
  const chunks: SerializedChunk[] = [
    { text: "a", delayMs: 1, isPause: false, isCorrection: false },
    { text: "", delayMs: 1, isPause: true, isCorrection: false },
  ];
  const state = await player.play(chunks);
  globalThis.setTimeout = timer;
  assert(state.chunksProcessed === state.totalChunks, "Not all chunks processed");
});

test("ChunkPlayer abort stops playback before all chunks processed", async () => {
  resetDom();
  const player = new ChunkPlayer();
  const playPromise = player.play([
    { text: "first", delayMs: 10, isPause: false, isCorrection: false },
    { text: "second", delayMs: 10, isPause: false, isCorrection: false },
  ]);
  player.abort();
  const state = await playPromise;
  assert(state.chunksProcessed < state.totalChunks, "Abort did not stop playback");
});

test("ChunkPlayer isPlaying is false after play resolves", async () => {
  resetDom();
  const timer = installImmediateTimer();
  const player = new ChunkPlayer();
  const state = await player.play([{ text: "a", delayMs: 1, isPause: false, isCorrection: false }]);
  globalThis.setTimeout = timer;
  assert(!state.isPlaying, "isPlaying stayed true");
});

test("messageHandler GET_DOC_TEXT triggers readDocumentText and sendResponse", () => {
  resetDom();
  fakeDocument.wordNodes = [new FakeElement("Doc text")];
  registerMessageHandler();
  let response: unknown;
  const returned = registeredListener?.({ type: "VERITON_GET_DOC_TEXT" }, {}, (value) => {
    response = value;
  });
  assert(returned === true && JSON.stringify(response).includes("Doc text"), "GET_DOC_TEXT failed");
});

test("messageHandler INSERT_INLINE calls insertTextAtCaret with message text", () => {
  resetDom();
  registerMessageHandler();
  const returned = registeredListener?.({ type: "VERITON_INSERT_INLINE", text: "(Smith)" }, {}, () => undefined);
  assert(returned === true && fakeDocument.execCommandCalls.some((call) => call.value === " (Smith)"), "Inline insert failed");
});

test("messageHandler INSERT_WORKS_CITED calls insertTextAtCaret with block", () => {
  resetDom();
  registerMessageHandler();
  const returned = registeredListener?.({ type: "VERITON_INSERT_WORKS_CITED", text: "\n\nWorks Cited" }, {}, () => undefined);
  assert(returned === true && fakeDocument.execCommandCalls.some((call) => call.value === "\n\nWorks Cited"), "Works Cited insert failed");
});

test("messageHandler START_LIVE_DRAFT creates ChunkPlayer and calls play", async () => {
  resetDom();
  const timer = installImmediateTimer();
  registerMessageHandler();
  let response: unknown;
  const returned = registeredListener?.(
    { type: "VERITON_START_LIVE_DRAFT", chunks: [{ text: "x", delayMs: 1, isPause: false, isCorrection: false }] },
    {},
    (value) => {
      response = value;
    },
  );
  await waitForMicrotask();
  globalThis.setTimeout = timer;
  assert(returned === true && JSON.stringify(response).includes("finalState"), "Live draft playback failed");
});

test("messageHandler returns true for all message types", () => {
  resetDom();
  registerMessageHandler();
  const messages: ContentMessage[] = [
    { type: "VERITON_GET_DOC_TEXT" },
    { type: "VERITON_INSERT_INLINE", text: "(Smith)" },
    { type: "VERITON_INSERT_WORKS_CITED", text: "Works" },
    { type: "VERITON_START_LIVE_DRAFT", chunks: [] },
  ];
  assert(messages.every((message) => registeredListener?.(message, {}, () => undefined) === true), "A handler returned false");
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
