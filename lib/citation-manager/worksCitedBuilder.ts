import type { CitationFormat, FormattedCitation, WorksCitedPage } from "./types";

export function buildWorksCited(citations: FormattedCitation[], format: CitationFormat): WorksCitedPage {
  const entries = citations
    .map((citation) => citation.fullCitation)
    .sort((left, right) => left.localeCompare(right));

  return {
    format,
    heading: format === "mla" ? "Works Cited" : "References",
    entries,
    formattedBlock: entries.join("\n\n"),
  };
}

export function appendWorksCitedToText(essayText: string, worksCited: WorksCitedPage): string {
  return `${essayText}\n\n${worksCited.heading}\n\n${worksCited.formattedBlock}`;
}
