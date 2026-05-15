import type { EvidenceNode } from "../essay-planner";
import type { CitationFormat, FormattedCitation } from "./types";

function clean(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function hasAuthor(node: EvidenceNode): boolean {
  return clean(node.author).length > 0;
}

function titleFragment(title: string): string {
  return clean(title).split(/\s+/).slice(0, 4).join(" ");
}

function authorLastName(author: string): string {
  const parts = clean(author).split(/\s+/).filter((part) => part.length > 0);

  return parts[parts.length - 1] ?? "";
}

function mlaAuthor(author: string): string {
  const parts = clean(author).split(/\s+/).filter((part) => part.length > 0);

  if (parts.length <= 1) {
    return parts[0] ?? "";
  }

  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(" ");

  return `${last}, ${first}`;
}

function apaAuthor(author: string): string {
  const parts = clean(author).split(/\s+/).filter((part) => part.length > 0);

  if (parts.length === 0) {
    return "";
  }

  const last = parts[parts.length - 1];
  const initials = parts
    .slice(0, -1)
    .map((part) => `${part.charAt(0).toUpperCase()}.`)
    .join(" ");

  return initials.length > 0 ? `${last}, ${initials}` : last;
}

function yearText(year: number | null): string {
  return year === null ? "" : String(year);
}

function sourceLabel(sourceType: EvidenceNode["sourceType"], format: CitationFormat): string {
  const labels: Record<EvidenceNode["sourceType"], string> = {
    journal: "Journal Name",
    book: format === "mla" ? "Publisher" : "Publisher",
    governmentReport: "Agency",
    universityPage: "University",
    newsOutlet: "Publication",
    other: "",
  };

  return labels[sourceType];
}

function sentenceJoin(parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(" ");
}

function formatMlaFullCitation(node: EvidenceNode): string {
  const title = clean(node.title);
  const year = yearText(node.year);

  if (!hasAuthor(node)) {
    return sentenceJoin([`"${title}."`, year ? `${year}.` : ""]);
  }

  const author = mlaAuthor(node.author);

  if (node.sourceType === "book") {
    return sentenceJoin([`${author}.`, `${title}.`, `${sourceLabel(node.sourceType, "mla")},`, year ? `${year}.` : ""]);
  }

  const label = sourceLabel(node.sourceType, "mla");

  if (label.length === 0) {
    return sentenceJoin([`${author}.`, `"${title}."`, year ? `${year}.` : ""]);
  }

  return sentenceJoin([`${author}.`, `"${title}."`, `${label},`, year ? `${year}.` : ""]);
}

function formatApaFullCitation(node: EvidenceNode): string {
  const title = clean(node.title);
  const year = node.year === null ? "n.d." : String(node.year);

  if (!hasAuthor(node)) {
    return `(${year}). ${title}.`;
  }

  const author = apaAuthor(node.author);
  const label = sourceLabel(node.sourceType, "apa");

  if (label.length === 0) {
    return `${author} (${year}). ${title}.`;
  }

  return `${author} (${year}). ${title}. ${label}.`;
}

function formatInlineCitation(node: EvidenceNode, format: CitationFormat): string {
  if (format === "mla") {
    return hasAuthor(node) ? `(${authorLastName(node.author)})` : `(${titleFragment(node.title)})`;
  }

  const year = node.year === null ? "n.d." : String(node.year);

  return hasAuthor(node)
    ? `(${authorLastName(node.author)}, ${year})`
    : `(${titleFragment(node.title)}, ${year})`;
}

export function formatCitation(node: EvidenceNode, format: CitationFormat): FormattedCitation {
  return {
    id: node.id,
    format,
    inlineCitation: formatInlineCitation(node, format),
    fullCitation: format === "mla" ? formatMlaFullCitation(node) : formatApaFullCitation(node),
    sourceType: node.sourceType,
    title: node.title,
    author: node.author,
    year: node.year,
  };
}

export function formatCitations(nodes: EvidenceNode[], format: CitationFormat): FormattedCitation[] {
  return nodes.map((node) => formatCitation(node, format));
}
