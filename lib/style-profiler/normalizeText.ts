import type { WritingSample } from "./types";

export const MAX_SAMPLE_CHARACTERS = 50000;

export interface NormalizedWritingSample {
  id: string;
  title?: string;
  text: string;
  paragraphs: string[];
  wasTruncated: boolean;
  warnings: string[];
}

export function normalizeWritingSample(sample: WritingSample): NormalizedWritingSample {
  const warnings: string[] = [];
  const rawText = sample.text.slice(0, MAX_SAMPLE_CHARACTERS);
  const wasTruncated = sample.text.length > MAX_SAMPLE_CHARACTERS;
  if (wasTruncated) {
    warnings.push(`Sample ${sample.id} was capped at ${MAX_SAMPLE_CHARACTERS} characters.`);
  }

  const withoutUrls = rawText.replace(/https?:\/\/\S+|www\.\S+/gi, " ");
  const withoutBibliography = removeBibliographySections(withoutUrls);
  const normalizedBreaks = withoutBibliography.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawParagraphs = normalizedBreaks.split(/\n{2,}/);
  const paragraphs = rawParagraphs
    .map((paragraph) => cleanParagraph(paragraph))
    .filter((paragraph) => paragraph.length > 0)
    .filter((paragraph) => !isLikelyCitationListEntry(paragraph))
    .filter((paragraph) => !isLikelyLongQuote(paragraph))
    .filter((paragraph) => !isLikelyHeading(paragraph));

  const text = paragraphs.join("\n\n");
  return {
    id: sample.id,
    title: sample.title,
    text,
    paragraphs,
    wasTruncated,
    warnings,
  };
}

function removeBibliographySections(text: string): string {
  const match = text.match(/\n\s*(works cited|references|bibliography|sources cited)\s*\n/i);
  if (!match || match.index === undefined) {
    return text;
  }
  return text.slice(0, match.index);
}

function cleanParagraph(paragraph: string): string {
  return paragraph
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => !isPageNumber(line))
    .filter((line) => !isLikelyCitationListEntry(line))
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function isPageNumber(line: string): boolean {
  return /^(page\s*)?\d{1,4}$/i.test(line.trim());
}

function isLikelyCitationListEntry(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return true;
  }
  return (
    /^\[\d+\]/.test(trimmed) ||
    /^\d+\.\s+[A-Z][^.]+,\s+[A-Z]/.test(trimmed) ||
    /\bdoi:\s*\S+/i.test(trimmed) ||
    /^https?:\/\//i.test(trimmed) ||
    /\(\d{4}\)\.\s+.+\.\s+[A-Z]/.test(trimmed)
  );
}

function isLikelyLongQuote(paragraph: string): boolean {
  const trimmed = paragraph.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  return wordCount > 45 && ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || trimmed.startsWith(">"));
}

function isLikelyHeading(paragraph: string): boolean {
  const words = paragraph.split(/\s+/).filter(Boolean);
  if (words.length > 8 || /[.!?]$/.test(paragraph)) {
    return false;
  }
  const letters = paragraph.replace(/[^a-z]/gi, "");
  const uppercaseLetters = paragraph.replace(/[^A-Z]/g, "");
  const mostlyUppercase = letters.length > 0 && uppercaseLetters.length / letters.length > 0.7;
  const titleCase = words.length <= 6 && words.every((word) => /^[A-Z0-9]/.test(word) || /^(and|or|of|the|a|an|in|to)$/i.test(word));
  return mostlyUppercase || titleCase;
}
