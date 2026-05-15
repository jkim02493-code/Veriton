import type { EssayType } from "../essay-planner";
import type { GeneratedSection } from "./types";

export function assembleDraft(sections: GeneratedSection[], essayType: EssayType): string {
  void essayType;

  return sections
    .map((section) => section.generatedText.trim())
    .filter((sectionText) => sectionText.length > 0)
    .join("\n\n")
    .trim();
}

export function extractWordCount(text: string): number {
  const trimmedText = text.trim();

  if (trimmedText.length === 0) {
    return 0;
  }

  return trimmedText.split(/\s+/).filter((word) => word.length > 0).length;
}
