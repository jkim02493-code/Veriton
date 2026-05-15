import { createErrorBanner } from "../extension/src/popup/components/ErrorBanner";
import { createHeader } from "../extension/src/popup/components/Header";
import { createProgressBar } from "../extension/src/popup/components/ProgressBar";
import { Router } from "../extension/src/popup/router";
import { AppStateStore } from "../extension/src/popup/state";

type TestCase = {
  name: string;
  run: () => void;
};

class FakeElement {
  tagName: string;
  children: FakeElement[];
  textContent: string;
  style: { cssText: string; [key: string]: string };
  attributes: Map<string, string>;
  private listeners: Map<string, Array<() => void>>;

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.textContent = "";
    this.style = { cssText: "" };
    this.attributes = new Map();
    this.listeners = new Map();
  }

  append(...items: Array<FakeElement | string>): void {
    for (const item of items) {
      if (typeof item === "string") {
        const text = new FakeElement("#text");
        text.textContent = item;
        this.children.push(text);
      } else {
        this.children.push(item);
      }
    }
  }

  appendChild(child: FakeElement): FakeElement {
    this.children.push(child);
    return child;
  }

  replaceChildren(...items: FakeElement[]): void {
    this.children = [];
    this.append(...items);
  }

  prepend(child: FakeElement): void {
    this.children.unshift(child);
  }

  remove(): void {
    return;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  addEventListener(type: string, listener: () => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  click(): void {
    for (const listener of this.listeners.get("click") ?? []) {
      listener();
    }
  }

  querySelector(selector: string): FakeElement | null {
    if (selector.startsWith("[") && selector.endsWith("]")) {
      const attributeName = selector.slice(1, -1).split("=")[0];
      if (this.attributes.has(attributeName)) {
        return this;
      }
    }

    for (const child of this.children) {
      const match = child.querySelector(selector);
      if (match) {
        return match;
      }
    }

    return null;
  }
}

class FakeDocument {
  head = new FakeElement("head");
  body = new FakeElement("body");

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName);
  }

  getElementById(_id: string): FakeElement | null {
    return null;
  }
}

const fakeDocument = new FakeDocument();
globalThis.document = fakeDocument as unknown as Document;
globalThis.HTMLElement = FakeElement as unknown as typeof HTMLElement;

const tests: TestCase[] = [];

function test(name: string, run: () => void): void {
  tests.push({ name, run });
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function textOf(element: FakeElement): string {
  return `${element.textContent}${element.children.map(textOf).join("")}`;
}

function findByTag(element: FakeElement, tagName: string): FakeElement | null {
  if (element.tagName === tagName.toUpperCase()) {
    return element;
  }

  for (const child of element.children) {
    const match = findByTag(child, tagName);
    if (match) {
      return match;
    }
  }

  return null;
}

test("AppStateStore initial state has currentView home", () => {
  assert(new AppStateStore().getState().currentView === "home", "Initial view was not home");
});

test("AppStateStore setState merges partial state", () => {
  const store = new AppStateStore();
  store.setState({ status: "loading" });
  assert(store.getState().status === "loading", "Status did not update");
});

test("AppStateStore setState does not overwrite unrelated fields", () => {
  const store = new AppStateStore();
  store.setState({ status: "loading" });
  assert(store.getState().config.targetWordCount === 800, "Config was overwritten");
});

test("AppStateStore subscribe listener called on setState", () => {
  const store = new AppStateStore();
  let calls = 0;
  store.subscribe(() => {
    calls += 1;
  });
  store.setState({ status: "success" });
  assert(calls === 1, "Listener was not called");
});

test("AppStateStore unsubscribe prevents further calls", () => {
  const store = new AppStateStore();
  let calls = 0;
  const unsubscribe = store.subscribe(() => {
    calls += 1;
  });
  unsubscribe();
  store.setState({ status: "success" });
  assert(calls === 0, "Listener was called after unsubscribe");
});

test("AppStateStore reset restores initial state", () => {
  const store = new AppStateStore();
  store.setState({ currentView: "draft", status: "success" });
  store.reset();
  assert(store.getState().currentView === "home" && store.getState().status === "idle", "Reset failed");
});

test("Router navigate updates store.currentView", () => {
  const store = new AppStateStore();
  const router = new Router(store, new FakeElement("div") as unknown as HTMLElement);
  router.register("draft", () => new FakeElement("div") as unknown as HTMLElement);
  router.navigate("draft");
  assert(store.getState().currentView === "draft", "View did not update");
});

test("Router navigate calls registered view factory", () => {
  const store = new AppStateStore();
  const container = new FakeElement("div");
  const router = new Router(store, container as unknown as HTMLElement);
  let called = false;
  router.register("plan", () => {
    called = true;
    return new FakeElement("section") as unknown as HTMLElement;
  });
  router.navigate("plan");
  assert(called && container.children.length === 1, "Factory was not called");
});

test("Router getCurrentView returns current view name", () => {
  const store = new AppStateStore();
  const router = new Router(store, new FakeElement("div") as unknown as HTMLElement);
  router.navigate("citations");
  assert(router.getCurrentView() === "citations", "Wrong current view");
});

test("Router navigating to unregistered view does not crash", () => {
  const store = new AppStateStore();
  const router = new Router(store, new FakeElement("div") as unknown as HTMLElement);
  router.navigate("reviewerNotes");
  assert(router.getCurrentView() === "reviewerNotes", "Unregistered navigation failed");
});

test("createHeader returns an HTMLElement", () => {
  assert(createHeader("Test") instanceof HTMLElement, "Header was not HTMLElement");
});

test("createHeader contains title text", () => {
  const header = createHeader("Essay Plan") as unknown as FakeElement;
  assert(textOf(header).includes("Essay Plan"), "Missing title");
});

test("createHeader back button present when onBack provided", () => {
  const header = createHeader("Backable", () => undefined) as unknown as FakeElement;
  assert(findByTag(header, "button") !== null, "Missing back button");
});

test("createHeader no back button when onBack not provided", () => {
  const header = createHeader("No Back") as unknown as FakeElement;
  assert(findByTag(header, "button") === null, "Unexpected back button");
});

test("createProgressBar returns an HTMLElement", () => {
  assert(createProgressBar("Progress", 1, 10) instanceof HTMLElement, "Progress bar was not HTMLElement");
});

test("createProgressBar shows label text", () => {
  const progress = createProgressBar("Upload", 1, 10) as unknown as FakeElement;
  assert(textOf(progress).includes("Upload"), "Missing label");
});

test("createProgressBar 0/10 renders 0% fill", () => {
  const progress = createProgressBar("Progress", 0, 10) as unknown as FakeElement;
  assert(textOf(progress).includes("0%"), "Missing 0%");
});

test("createProgressBar 10/10 renders 100% fill", () => {
  const progress = createProgressBar("Progress", 10, 10) as unknown as FakeElement;
  assert(textOf(progress).includes("100%"), "Missing 100%");
});

test("createErrorBanner returns an HTMLElement", () => {
  assert(createErrorBanner("Error", () => undefined) instanceof HTMLElement, "Banner was not HTMLElement");
});

test("createErrorBanner contains error message text", () => {
  const banner = createErrorBanner("Something failed", () => undefined) as unknown as FakeElement;
  assert(textOf(banner).includes("Something failed"), "Missing error message");
});

test("createErrorBanner dismiss callback fires on button click", () => {
  let dismissed = false;
  const banner = createErrorBanner("Dismiss me", () => {
    dismissed = true;
  }) as unknown as FakeElement;
  findByTag(banner, "button")?.click();
  assert(dismissed, "Dismiss callback did not fire");
});

let passed = 0;
let failed = 0;

for (const { name, run } of tests) {
  try {
    run();
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
