import type { FormattedCitation, WorksCitedPage } from "../../../lib/citation-manager";

type InsertMessageType = "VERITON_INSERT_INLINE" | "VERITON_INSERT_WORKS_CITED";

function sendInsertMessage(type: InsertMessageType, text: string): void {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;

    if (!tabId) {
      return;
    }

    chrome.tabs.sendMessage(tabId, { type, text });
  });
}

export function insertInlineCitation(citation: FormattedCitation): void {
  sendInsertMessage("VERITON_INSERT_INLINE", citation.inlineCitation);
}

export function insertWorksCited(worksCited: WorksCitedPage): void {
  sendInsertMessage("VERITON_INSERT_WORKS_CITED", `\n\n${worksCited.heading}\n\n${worksCited.formattedBlock}`);
}

export function insertMultipleInline(citations: FormattedCitation[]): void {
  for (const citation of citations) {
    insertInlineCitation(citation);
  }
}
