import type { DocWriteResult } from "./types";

function editorElement(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(".kix-appview-editor") ??
    document.querySelector<HTMLElement>('[role="textbox"]')
  );
}

export function focusEditor(): boolean {
  const editor = editorElement();

  if (!editor) {
    return false;
  }

  editor.focus();
  return true;
}

export function moveCaretToEnd(): void {
  const target = editorElement() ?? document.body;
  const event = new KeyboardEvent("keydown", {
    key: "End",
    code: "End",
    ctrlKey: !navigator.platform.toLowerCase().includes("mac"),
    metaKey: navigator.platform.toLowerCase().includes("mac"),
    bubbles: true,
  });
  target.dispatchEvent(event);

  try {
    document.execCommand("selectAll", false);
    const selection = window.getSelection();
    selection?.collapseToEnd();
  } catch {
    return;
  }
}

export function insertTextAtCaret(text: string): DocWriteResult {
  if (!focusEditor()) {
    return {
      success: false,
      charactersInserted: 0,
      error: "Editor not found",
    };
  }

  // Google Docs does not expose a stable DOM write API. execCommand is deprecated,
  // but remains the most reliable content-script insertion path without Docs API OAuth.
  const inserted = document.execCommand("insertText", false, text);

  if (!inserted) {
    const inputEvent = new InputEvent("input", {
      inputType: "insertText",
      data: text,
      bubbles: true,
    });
    (editorElement() ?? document.body).dispatchEvent(inputEvent);
  }

  return {
    success: true,
    charactersInserted: text.length,
  };
}

export function insertParagraphBreak(): void {
  document.execCommand("insertParagraph", false);
}
