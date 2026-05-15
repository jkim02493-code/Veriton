import { CitationStore } from "../../../../lib/citation-manager";
import { createCitationPanel } from "../../citation-manager";
import { insertMultipleInline, insertWorksCited } from "../../citation-manager/docsInserter";
import { createHeader } from "../components/Header";
import { Router } from "../router";
import { AppStateStore } from "../state";
import { createContent, createViewShell } from "./viewUtils";

export function createCitationView(store: AppStateStore, router: Router): HTMLElement {
  const shell = createViewShell();
  const content = createContent();
  const state = store.getState();
  shell.append(createHeader("Citations", () => router.navigate("draft")), content);

  if (state.citations.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No citations available yet.";
    empty.style.cssText = "font-size:13px;color:#627d98;";
    content.appendChild(empty);
    return shell;
  }

  const panelContainer = document.createElement("div");
  const citationStore = new CitationStore(state.config.citationFormat);
  citationStore.loadCitations(state.citations);
  panelContainer.appendChild(createCitationPanel(citationStore, insertMultipleInline, insertWorksCited));
  content.appendChild(panelContainer);

  return shell;
}
