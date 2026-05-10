import { cleanSelectedText } from "./selectionValidation";

type ClipboardFallbackResult = {
  text: string;
  method: string;
  detail: string;
};

function nodeIsInGoogleDocsEditor(node: Node | null): boolean {
  const element = node instanceof Element ? node : node?.parentElement;
  return Boolean(element?.closest(".kix-appview-editor"));
}

function activeSelectionIsInGoogleDocsEditor(): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return false;
  }
  return nodeIsInGoogleDocsEditor(selection.anchorNode) && nodeIsInGoogleDocsEditor(selection.focusNode);
}

export async function clipboardCopyFallback(): Promise<ClipboardFallbackResult> {
  const attempts: string[] = [];
  let capturedText = "";
  let originalClipboard = "";
  let clipboardWasSaved = false;

  try {
    originalClipboard = await navigator.clipboard.readText();
    clipboardWasSaved = true;
    attempts.push("clipboard save: success");
  } catch (error) {
    attempts.push(`clipboard save failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!activeSelectionIsInGoogleDocsEditor()) {
    attempts.push("selection check failed: active selection is not inside .kix-appview-editor");
    return {
      text: "",
      method: "clipboard copy-event fallback",
      detail: attempts.join("; "),
    };
  }
  attempts.push("selection check: inside Google Docs editor");

  const copyListener = (evt: ClipboardEvent) => {
    capturedText = cleanSelectedText(evt.clipboardData?.getData("text/plain") ?? "");
    attempts.push(capturedText ? `copy event: success (${capturedText.length} chars)` : "copy event: empty clipboardData");
  };

  document.addEventListener("copy", copyListener);
  try {
    const copied = document.execCommand("copy");
    attempts.push(`execCommand copy: ${copied ? "success" : "returned false"}`);
  } catch (error) {
    attempts.push(`execCommand copy failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    document.removeEventListener("copy", copyListener);
  }

  if (!capturedText) {
    await new Promise((resolve) => window.setTimeout(resolve, 60));
    try {
      capturedText = cleanSelectedText(await navigator.clipboard.readText());
      attempts.push(capturedText ? `clipboard read after copy: success (${capturedText.length} chars)` : "clipboard read after copy: empty");
    } catch (error) {
      attempts.push(`clipboard read after copy failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (clipboardWasSaved) {
    try {
      await navigator.clipboard.writeText(originalClipboard);
      attempts.push("clipboard restore: success");
    } catch (error) {
      attempts.push(`clipboard restore failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    text: capturedText,
    method: "clipboard copy-event fallback",
    detail: attempts.join("; "),
  };
}
