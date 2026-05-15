import type { EvidenceNode } from "../lib/essay-planner";
import {
  appendWorksCitedToText,
  buildWorksCited,
  CitationStore,
  formatCitation,
  formatCitations,
} from "../lib/citation-manager";

type TestCase = {
  name: string;
  run: () => void;
};

const MOCK_NODES: EvidenceNode[] = [
  {
    id: "source-1",
    title: "Industrial Growth and Urban Change",
    author: "Jane Smith",
    year: 2021,
    keywords: ["industrial", "urban"],
    abstract: "A journal article about urban change.",
    credibilityScore: 0.9,
    citationMla: "",
    citationApa: "",
    sourceType: "journal",
  },
  {
    id: "source-2",
    title: "Education Reform in Modern Cities",
    author: "Alex Rivera",
    year: null,
    keywords: ["education"],
    abstract: "A book about education reform.",
    credibilityScore: 0.85,
    citationMla: "",
    citationApa: "",
    sourceType: "book",
  },
  {
    id: "source-3",
    title: "Public Health Report on Housing",
    author: "",
    year: 2019,
    keywords: ["health", "housing"],
    abstract: "A government report with no named author.",
    credibilityScore: 0.8,
    citationMla: "",
    citationApa: "",
    sourceType: "governmentReport",
  },
  {
    id: "source-4",
    title: "University Archive on Labour",
    author: "Mina Chen",
    year: 2020,
    keywords: ["labour"],
    abstract: "A university page about labour records.",
    credibilityScore: 0.75,
    citationMla: "",
    citationApa: "",
    sourceType: "universityPage",
  },
];

const tests: TestCase[] = [];

function test(name: string, run: () => void): void {
  tests.push({ name, run });
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

test("MLA formatCitation returns inlineCitation and fullCitation", () => {
  const citation = formatCitation(MOCK_NODES[0], "mla");
  assert(citation.inlineCitation.length > 0 && citation.fullCitation.length > 0, "Missing MLA citation text");
});

test("MLA inlineCitation contains author last name", () => {
  const citation = formatCitation(MOCK_NODES[0], "mla");
  assert(citation.inlineCitation.includes("Smith"), "Missing author last name");
});

test("MLA fullCitation contains title", () => {
  const citation = formatCitation(MOCK_NODES[0], "mla");
  assert(citation.fullCitation.includes(MOCK_NODES[0].title), "Missing title");
});

test("MLA node with no author uses title fragment for inlineCitation", () => {
  const citation = formatCitation(MOCK_NODES[2], "mla");
  assert(citation.inlineCitation.includes("Public Health Report on"), "Missing title fragment");
});

test("MLA node with no year omits year from fullCitation", () => {
  const citation = formatCitation(MOCK_NODES[1], "mla");
  assert(!citation.fullCitation.includes("null") && !citation.fullCitation.includes("n.d."), "MLA no-year citation should omit year");
});

test("APA inlineCitation contains year when available", () => {
  const citation = formatCitation(MOCK_NODES[0], "apa");
  assert(citation.inlineCitation.includes("2021"), "Missing APA year");
});

test("APA inlineCitation uses n.d. when year is null", () => {
  const citation = formatCitation(MOCK_NODES[1], "apa");
  assert(citation.inlineCitation.includes("n.d."), "Missing n.d.");
});

test("APA fullCitation follows APA structure", () => {
  const citation = formatCitation(MOCK_NODES[0], "apa");
  assert(citation.fullCitation.includes("Smith, J.") && citation.fullCitation.includes("(2021)."), "APA structure mismatch");
});

test("formatCitations returns same length as input", () => {
  assert(formatCitations(MOCK_NODES, "mla").length === MOCK_NODES.length, "Length mismatch");
});

test("formatCitations ids match source node ids", () => {
  const citations = formatCitations(MOCK_NODES, "apa");
  assert(citations.every((citation, index) => citation.id === MOCK_NODES[index].id), "ID mismatch");
});

test("MLA works cited heading is Works Cited", () => {
  const worksCited = buildWorksCited(formatCitations(MOCK_NODES, "mla"), "mla");
  assert(worksCited.heading === "Works Cited", "Wrong MLA heading");
});

test("APA works cited heading is References", () => {
  const worksCited = buildWorksCited(formatCitations(MOCK_NODES, "apa"), "apa");
  assert(worksCited.heading === "References", "Wrong APA heading");
});

test("Works cited entries are sorted alphabetically", () => {
  const worksCited = buildWorksCited(formatCitations(MOCK_NODES, "mla"), "mla");
  const sortedEntries = [...worksCited.entries].sort((left, right) => left.localeCompare(right));
  assert(JSON.stringify(worksCited.entries) === JSON.stringify(sortedEntries), "Entries not sorted");
});

test("Works cited formattedBlock joins entries with double newline", () => {
  const worksCited = buildWorksCited(formatCitations(MOCK_NODES, "mla"), "mla");
  assert(worksCited.formattedBlock.includes("\n\n"), "Missing double newline");
});

test("appendWorksCitedToText appends block to essay text", () => {
  const worksCited = buildWorksCited(formatCitations(MOCK_NODES, "mla"), "mla");
  const text = appendWorksCitedToText("Essay body.", worksCited);
  assert(text.includes("Essay body.\n\nWorks Cited\n\n"), "Works Cited block not appended");
});

test("CitationStore loadCitations stores citations", () => {
  const store = new CitationStore("mla");
  const citations = formatCitations(MOCK_NODES, "mla");
  store.loadCitations(citations);
  assert(store.getCitations().length === citations.length, "Citations not stored");
});

test("CitationStore selectCitation adds to selectedIds", () => {
  const store = new CitationStore("mla");
  store.loadCitations(formatCitations(MOCK_NODES, "mla"));
  store.selectCitation("source-1");
  assert(store.getState().selectedIds.includes("source-1"), "Citation not selected");
});

test("CitationStore deselectCitation removes from selectedIds", () => {
  const store = new CitationStore("mla");
  store.loadCitations(formatCitations(MOCK_NODES, "mla"));
  store.selectCitation("source-1");
  store.deselectCitation("source-1");
  assert(!store.getState().selectedIds.includes("source-1"), "Citation still selected");
});

test("CitationStore selectAll selects all citations", () => {
  const store = new CitationStore("mla");
  store.loadCitations(formatCitations(MOCK_NODES, "mla"));
  store.selectAll();
  assert(store.getState().selectedIds.length === MOCK_NODES.length, "Not all selected");
});

test("CitationStore deselectAll clears all selections", () => {
  const store = new CitationStore("mla");
  store.loadCitations(formatCitations(MOCK_NODES, "mla"));
  store.selectAll();
  store.deselectAll();
  assert(store.getState().selectedIds.length === 0, "Selections not cleared");
});

test("CitationStore getSelected returns only selected citations", () => {
  const store = new CitationStore("mla");
  store.loadCitations(formatCitations(MOCK_NODES, "mla"));
  store.selectCitation("source-2");
  const selected = store.getSelected();
  assert(selected.length === 1 && selected[0]?.id === "source-2", "getSelected mismatch");
});

test("CitationStore setFormat updates format in state", () => {
  const store = new CitationStore("mla");
  store.setFormat("apa");
  assert(store.getState().format === "apa", "Format not updated");
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
