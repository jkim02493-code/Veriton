import { createHeader } from "../components/Header";
import { Router } from "../router";
import { AppStateStore } from "../state";
import { createContent, createViewShell } from "./viewUtils";

export function createReviewerNotesView(store: AppStateStore, router: Router): HTMLElement {
  const shell = createViewShell();
  const content = createContent();
  const state = store.getState();
  let openIndex = 0;
  shell.append(createHeader("Reviewer Notes", () => router.navigate("draft")), content);

  function renderAccordion(): void {
    if (!state.reviewerNotes) {
      return;
    }
    content.replaceChildren();
    const summary = document.createElement("p");
    summary.textContent = state.reviewerNotes.overallSummary;
    summary.style.cssText = "font-size:13px;line-height:1.45;margin:0;";
    const stats = document.createElement("div");
    stats.style.cssText = "font-size:12px;color:#52606d;";
    stats.textContent = `${state.reviewerNotes.totalKeyClaims} claims · ${state.reviewerNotes.totalKeyTerms} terms · ${state.reviewerNotes.totalDefenceQuestions} questions`;
    content.append(summary, stats);

    state.reviewerNotes.sectionNotes.forEach((note, index) => {
      const section = document.createElement("section");
      section.style.cssText = "background:white;border:1px solid #d9e2ec;border-radius:8px;overflow:hidden;";
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = note.sectionLabel;
      button.style.cssText = "width:100%;border:0;background:#f8fafc;text-align:left;font-weight:700;padding:10px;cursor:pointer;";
      button.addEventListener("click", () => {
        openIndex = index;
        renderAccordion();
      });
      section.appendChild(button);
      if (openIndex === index) {
        const detail = document.createElement("div");
        detail.style.cssText = "display:grid;gap:8px;padding:10px;font-size:12px;line-height:1.4;";
        detail.append(paragraph(note.plainSummary), list("Key claims", note.keyClaims.map((claim) => `${claim.claimText} (${claim.claimStrength})`)), list("Key terms", note.keyTerms.map((term) => `${term.term}: ${term.definition}`)), list("Defence questions", note.defenceQuestions.map((question) => `${question.question} ${question.suggestedAnswer}`)));
        section.appendChild(detail);
      }
      content.appendChild(section);
    });
  }

  if (!state.reviewerNotes) {
    const empty = document.createElement("p");
    empty.textContent = "No reviewer notes generated yet.";
    content.appendChild(empty);
  } else {
    renderAccordion();
  }

  return shell;
}

function paragraph(text: string): HTMLElement {
  const element = document.createElement("p");
  element.textContent = text;
  element.style.margin = "0";
  return element;
}

function list(label: string, items: string[]): HTMLElement {
  const wrapper = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = label;
  const listElement = document.createElement("ul");
  listElement.style.margin = "6px 0 0";
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    listElement.appendChild(li);
  }
  wrapper.append(heading, listElement);
  return wrapper;
}
