import type { CitationStyle, EvidenceCard } from "../../../shared/types";

export function citationForStyle(card: EvidenceCard, style: CitationStyle): string {
  return style === "APA" ? card.apaCitation : card.mlaCitation;
}
