import type { DocReadResult } from "./types";

function normaliseText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function wordCount(text: string): number {
  if (text.length === 0) {
    return 0;
  }

  return text.split(/\s+/).filter(Boolean).length;
}

function textFromElements(selector: string, separator: string): string {
  const elements = Array.from(document.querySelectorAll(selector));
  return normaliseText(elements.map((element) => element.textContent ?? "").join(separator));
}

function textFromTextbox(): string {
  const textbox =
    document.querySelector<HTMLElement>('[role="textbox"]') ??
    document.querySelector<HTMLElement>('[aria-label*="Document"]');

  return normaliseText(textbox?.innerText ?? textbox?.textContent ?? "");
}

export function readDocumentText(): DocReadResult {
  const strategyOneText = textFromElements(".kix-wordhtmlgenerator-word-node", " ");
  const text =
    strategyOneText ||
    textFromElements(".kix-paragraphrenderer", "\n") ||
    textFromTextbox();

  if (text.length === 0) {
    return {
      text: "",
      wordCount: 0,
      success: false,
      error: "Could not read document text.",
    };
  }

  return {
    text,
    wordCount: wordCount(text),
    success: true,
  };
}

export function isGoogleDoc(): boolean {
  return window.location.href.includes("docs.google.com/document");
}
