import type { FormattedCitation } from "../../../lib/citation-manager";

let stylesInjected = false;

function injectCitationCardStyles(): void {
  if (stylesInjected) {
    return;
  }

  const style = document.createElement("style");
  style.textContent = `
    .veriton-citation-card {
      border: 1px solid #d9e2ec;
      border-radius: 8px;
      background: #ffffff;
      padding: 10px;
      display: grid;
      gap: 8px;
      color: #16202a;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      width: 100%;
      box-sizing: border-box;
    }
    .veriton-citation-card[data-selected="true"] {
      border-color: #1d7f68;
      background: #effaf6;
    }
    .veriton-citation-title {
      font-size: 13px;
      font-weight: 700;
      line-height: 1.3;
      overflow-wrap: anywhere;
    }
    .veriton-citation-meta,
    .veriton-citation-inline {
      color: #5c6f82;
      font-size: 12px;
      line-height: 1.35;
    }
    .veriton-citation-badge {
      background: #e9f2ff;
      border-radius: 999px;
      color: #20466f;
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 7px;
      width: fit-content;
    }
    .veriton-citation-actions {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: space-between;
    }
    .veriton-citation-actions button {
      border: 1px solid #b9c8d6;
      border-radius: 6px;
      background: #f8fafc;
      color: #1f2d3d;
      cursor: pointer;
      font-size: 12px;
      padding: 6px 8px;
    }
    .veriton-citation-select {
      align-items: center;
      display: inline-flex;
      gap: 5px;
      font-size: 12px;
    }
  `;
  document.head.appendChild(style);
  stylesInjected = true;
}

function truncateTitle(title: string): string {
  return title.length <= 60 ? title : `${title.slice(0, 57)}...`;
}

function sourceTypeLabel(sourceType: string): string {
  return sourceType
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function copyToClipboard(text: string, callback: (text: string) => void): void {
  void navigator.clipboard?.writeText(text);
  callback(text);
}

export function createCitationCard(
  citation: FormattedCitation,
  onSelect: (id: string) => void,
  onCopyInline: (text: string) => void,
  onCopyFull: (text: string) => void,
): HTMLElement {
  injectCitationCardStyles();

  const card = document.createElement("article");
  card.className = "veriton-citation-card";
  card.dataset.selected = "false";

  const title = document.createElement("div");
  title.className = "veriton-citation-title";
  title.textContent = truncateTitle(citation.title);

  const meta = document.createElement("div");
  meta.className = "veriton-citation-meta";
  meta.textContent = `${citation.author || "Unknown author"} · ${citation.year ?? "n.d."}`;

  const badge = document.createElement("span");
  badge.className = "veriton-citation-badge";
  badge.textContent = sourceTypeLabel(citation.sourceType);

  const inlinePreview = document.createElement("div");
  inlinePreview.className = "veriton-citation-inline";
  inlinePreview.textContent = citation.inlineCitation;

  const actions = document.createElement("div");
  actions.className = "veriton-citation-actions";

  const checkboxLabel = document.createElement("label");
  checkboxLabel.className = "veriton-citation-select";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.addEventListener("change", () => {
    card.dataset.selected = checkbox.checked ? "true" : "false";
    onSelect(citation.id);
  });
  checkboxLabel.append(checkbox, "Select");

  const copyInline = document.createElement("button");
  copyInline.type = "button";
  copyInline.textContent = "Copy Inline";
  copyInline.addEventListener("click", () => copyToClipboard(citation.inlineCitation, onCopyInline));

  const copyFull = document.createElement("button");
  copyFull.type = "button";
  copyFull.textContent = "Copy Full";
  copyFull.addEventListener("click", () => copyToClipboard(citation.fullCitation, onCopyFull));

  actions.append(checkboxLabel, copyInline, copyFull);
  card.append(title, meta, badge, inlinePreview, actions);

  return card;
}
