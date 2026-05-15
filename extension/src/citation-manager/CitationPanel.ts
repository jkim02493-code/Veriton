import { buildWorksCited, CitationStore } from "../../../lib/citation-manager";
import type { CitationFormat, FormattedCitation, WorksCitedPage } from "../../../lib/citation-manager";
import { createCitationCard } from "./CitationCard";

let stylesInjected = false;

function injectPanelStyles(): void {
  if (stylesInjected) {
    return;
  }

  const style = document.createElement("style");
  style.textContent = `
    .veriton-citation-panel {
      box-sizing: border-box;
      display: grid;
      gap: 12px;
      max-width: 380px;
      min-width: 320px;
      padding: 12px;
      color: #17212b;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .veriton-citation-header,
    .veriton-citation-footer,
    .veriton-format-row {
      align-items: center;
      display: flex;
      gap: 8px;
      justify-content: space-between;
    }
    .veriton-citation-header h2 {
      font-size: 16px;
      line-height: 1.2;
      margin: 0;
    }
    .veriton-count-badge {
      background: #1d7f68;
      border-radius: 999px;
      color: white;
      font-size: 12px;
      font-weight: 700;
      padding: 3px 8px;
    }
    .veriton-format-row {
      justify-content: flex-start;
      font-size: 12px;
    }
    .veriton-citation-list {
      display: grid;
      gap: 8px;
      max-height: 430px;
      overflow-y: auto;
    }
    .veriton-citation-footer {
      flex-wrap: wrap;
      justify-content: flex-start;
    }
    .veriton-citation-footer button {
      border: 1px solid #b9c8d6;
      border-radius: 6px;
      background: #f8fafc;
      color: #1f2d3d;
      cursor: pointer;
      font-size: 12px;
      padding: 7px 9px;
    }
    .veriton-citation-footer button:first-child {
      background: #1d7f68;
      border-color: #1d7f68;
      color: white;
    }
  `;
  document.head.appendChild(style);
  stylesInjected = true;
}

function copyFeedback(_text: string): void {
  return;
}

export function createCitationPanel(
  store: CitationStore,
  onInsertSelected: (citations: FormattedCitation[]) => void,
  onInsertWorksCited: (worksCited: WorksCitedPage) => void,
): HTMLElement {
  injectPanelStyles();

  const panel = document.createElement("section");
  panel.className = "veriton-citation-panel";

  function render(): void {
    const state = store.getState();
    const citations = store.getCitations();
    panel.replaceChildren();

    const header = document.createElement("div");
    header.className = "veriton-citation-header";
    const heading = document.createElement("h2");
    heading.textContent = "Citations";
    const countBadge = document.createElement("span");
    countBadge.className = "veriton-count-badge";
    countBadge.textContent = String(citations.length);
    header.append(heading, countBadge);

    const formatRow = document.createElement("div");
    formatRow.className = "veriton-format-row";
    const mlaLabel = createFormatOption("MLA", "mla", state.format, store, render);
    const apaLabel = createFormatOption("APA", "apa", state.format, store, render);
    formatRow.append(mlaLabel, apaLabel);

    const list = document.createElement("div");
    list.className = "veriton-citation-list";
    for (const citation of citations) {
      list.append(
        createCitationCard(
          citation,
          (id) => {
            if (store.getState().selectedIds.includes(id)) {
              store.deselectCitation(id);
            } else {
              store.selectCitation(id);
            }
            render();
          },
          copyFeedback,
          copyFeedback,
        ),
      );
    }

    const footer = document.createElement("div");
    footer.className = "veriton-citation-footer";
    const selectedCount = state.selectedIds.length;
    const insertSelected = document.createElement("button");
    insertSelected.type = "button";
    insertSelected.textContent = `Insert Selected (${selectedCount})`;
    insertSelected.addEventListener("click", () => onInsertSelected(store.getSelected()));

    const insertWorksCited = document.createElement("button");
    insertWorksCited.type = "button";
    insertWorksCited.textContent = "Insert Works Cited";
    insertWorksCited.addEventListener("click", () =>
      onInsertWorksCited(buildWorksCited(store.getCitations(), store.getState().format)),
    );

    const selectToggle = document.createElement("button");
    selectToggle.type = "button";
    selectToggle.textContent = selectedCount === citations.length && citations.length > 0 ? "Deselect All" : "Select All";
    selectToggle.addEventListener("click", () => {
      if (store.getState().selectedIds.length === store.getCitations().length) {
        store.deselectAll();
      } else {
        store.selectAll();
      }
      render();
    });

    footer.append(insertSelected, insertWorksCited, selectToggle);
    panel.append(header, formatRow, list, footer);
  }

  render();

  return panel;
}

function createFormatOption(
  label: string,
  value: CitationFormat,
  currentFormat: CitationFormat,
  store: CitationStore,
  rerender: () => void,
): HTMLLabelElement {
  const wrapper = document.createElement("label");
  const input = document.createElement("input");
  input.type = "radio";
  input.name = "veriton-citation-format";
  input.value = value;
  input.checked = value === currentFormat;
  input.addEventListener("change", () => {
    store.setFormat(value);
    rerender();
  });
  wrapper.append(input, label);

  return wrapper;
}

export function renderCitationPanel(
  container: HTMLElement,
  citations: FormattedCitation[],
  format: CitationFormat,
): CitationStore {
  const store = new CitationStore(format);
  store.loadCitations(citations);
  container.replaceChildren(
    createCitationPanel(store, () => undefined, () => undefined),
  );

  return store;
}
