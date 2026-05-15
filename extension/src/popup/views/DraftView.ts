import type { ReviewerNotesResult } from "../../../../lib/reviewer-notes";
import { createHeader } from "../components/Header";
import { Router } from "../router";
import { AppStateStore } from "../state";
import type { PopupMessage } from "../types";
import { appendStatus, createContent, createPrimaryButton, createSecondaryButton, createViewShell, postJson, sendActiveTabMessage } from "./viewUtils";

export function createDraftView(store: AppStateStore, router: Router): HTMLElement {
  const shell = createViewShell();
  const content = createContent();
  const state = store.getState();
  shell.append(createHeader("Draft Ready", () => router.navigate("plan")), content);

  if (!state.generatedDraft) {
    const empty = document.createElement("p");
    empty.textContent = "No draft generated yet.";
    content.appendChild(empty);
    return shell;
  }

  const stats = document.createElement("div");
  stats.style.cssText = "display:grid;gap:4px;background:white;border:1px solid #d9e2ec;border-radius:8px;padding:10px;font-size:12px;";
  stats.append(
    `Words: ${state.generatedDraft.totalWordCount}`,
    document.createElement("br"),
    `Style similarity: ${Math.round(state.generatedDraft.overallStyleSimilarity * 100)}%`,
    document.createElement("br"),
    `Style warnings: ${state.generatedDraft.styleWarnings.length}`,
  );
  content.appendChild(stats);

  if (state.generatedDraft.styleWarnings.length > 0) {
    const warnings = document.createElement("ul");
    warnings.style.cssText = "font-size:12px;color:#9a6700;";
    for (const warning of state.generatedDraft.styleWarnings) {
      const item = document.createElement("li");
      item.textContent = warning;
      warnings.appendChild(item);
    }
    content.appendChild(warnings);
  }

  const typeButton = createPrimaryButton("Type into Doc");
  typeButton.addEventListener("click", () => {
    const latest = store.getState();
    if (!latest.generatedDraft) return;
    void sendActiveTabMessage({ type: "VERITON_START_LIVE_DRAFT", draftText: latest.generatedDraft.assembledText } satisfies PopupMessage).catch(() => undefined);
  });

  const notesButton = createSecondaryButton("View Reviewer Notes");
  notesButton.addEventListener("click", async () => {
    const latest = store.getState();
    if (!latest.generatedDraft) return;
    store.setState({ status: "loading", errorMessage: null });
    try {
      const result = await postJson<ReviewerNotesResult>("/api/reviewer-notes/generate", {
        draft: latest.generatedDraft,
      });
      store.setState({ reviewerNotes: result.notes, status: "success" });
      router.navigate("reviewerNotes");
    } catch (error) {
      store.setState({ status: "error", errorMessage: error instanceof Error ? error.message : String(error) });
    }
  });

  const citationsButton = createSecondaryButton("View Citations");
  citationsButton.addEventListener("click", () => router.navigate("citations"));
  content.append(typeButton, notesButton, citationsButton);
  appendStatus(content, store, "Generating reviewer notes...");
  return shell;
}
