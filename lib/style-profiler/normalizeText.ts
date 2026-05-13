import type { WritingSample } from "./types";

export const MAX_SAMPLE_CHARACTERS = 50000;

export interface NormalizeOptions {
  removeBibliography: boolean;
  removeUrls: boolean;
  removePageNumbers: boolean;
  removeHeadings: boolean;
  removeBlockQuotes: boolean;
  removeCitationLines: boolean;
  removeFootnotes: boolean;
  maxLength: number;
}

export interface NormalizedWritingSample {
  id: string;
  title?: string;
  text: string;
  paragraphs: string[];
  wasTruncated: boolean;
  warnings: string[];
}

const DEFAULT_NORMALIZE_OPTIONS: NormalizeOptions = {
  removeBibliography: true,
  removeUrls: true,
  removePageNumbers: true,
  removeHeadings: true,
  removeBlockQuotes: true,
  removeCitationLines: true,
  removeFootnotes: true,
  maxLength: MAX_SAMPLE_CHARACTERS,
};

export function normalizeText(rawText: string, options?: Partial<NormalizeOptions>): string {
  if (!rawText) {
    return "";
  }

  const config = { ...DEFAULT_NORMALIZE_OPTIONS, ...options };
  let text = rawText.slice(0, config.maxLength);
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  if (config.removeUrls) {
    text = text.replace(/https?:\/\/\S+/gi, " ").replace(/www\.\S+/gi, " ");
  }
  text = text.replace(/\([A-Z][A-Za-z-]+(?:\s+(?:and|&)\s+[A-Z][A-Za-z-]+|,\s*(?:et\s+al\.)?)?,\s*\d{4}(?:,\s*p\.?\s*\d+)?\)/g, " ");

  const lines = text.split("\n");
  const keptLines: string[] = [];
  for (const line of lines) {
    if (config.removeBibliography && isBibliographyHeader(line)) {
      break;
    }
    keptLines.push(line);
  }

  const paragraphs: string[] = [];
  let currentParagraph: string[] = [];

  for (const originalLine of keptLines) {
    const line = originalLine.trim();
    if (!line) {
      flushParagraph(currentParagraph, paragraphs);
      currentParagraph = [];
      continue;
    }
    if (shouldRemoveLine(originalLine, line, config)) {
      continue;
    }
    currentParagraph.push(line);
  }
  flushParagraph(currentParagraph, paragraphs);

  return paragraphs
    .map((paragraph) =>
      paragraph
        .replace(/\[\d+\]/g, " ")
        .replace(/\bet\s+al\.\s*/gi, " ")
        .replace(/\s+/g, " ")
        .replace(/\s+([,.;:!?])/g, "$1")
        .trim()
    )
    .filter(Boolean)
    .join("\n\n");
}

export function normalizeWritingSample(sample: WritingSample): NormalizedWritingSample {
  const warnings: string[] = [];
  const wasTruncated = sample.text.length > MAX_SAMPLE_CHARACTERS;
  if (wasTruncated) {
    warnings.push(`Sample ${sample.id} was capped at ${MAX_SAMPLE_CHARACTERS} characters.`);
  }

  const text = normalizeText(sample.text);
  const paragraphs = text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  return {
    id: sample.id,
    title: sample.title,
    text,
    paragraphs,
    wasTruncated,
    warnings,
  };
}

function shouldRemoveLine(originalLine: string, line: string, config: NormalizeOptions): boolean {
  if (config.removeBlockQuotes && (/^\s{4,}\S/.test(originalLine) || line.startsWith(">"))) {
    return true;
  }
  if (config.removePageNumbers && isPageNumber(line)) {
    return true;
  }
  if (config.removeHeadings && isLikelyHeading(line)) {
    return true;
  }
  if (config.removeFootnotes && isFootnoteLine(line)) {
    return true;
  }
  if (config.removeCitationLines && isLikelyCitationLine(line)) {
    return true;
  }
  return isTeacherComment(line);
}

function flushParagraph(lines: string[], paragraphs: string[]): void {
  const paragraph = lines.join(" ").replace(/\s+/g, " ").trim();
  if (paragraph) {
    paragraphs.push(paragraph);
  }
}

function isBibliographyHeader(line: string): boolean {
  return /^\s*(works cited|bibliography|references|sources|sources cited|endnotes|footnotes|appendix)\s*$/i.test(line);
}

function isPageNumber(line: string): boolean {
  return /^(\d{1,4}|p\.?\s*\d{1,4}|page\s+\d{1,4})$/i.test(line);
}

function isLikelyHeading(line: string): boolean {
  if (/^#{1,6}\s+\S/.test(line)) {
    return true;
  }
  if (/^(chapter|section)\s+\d+/i.test(line) && line.length < 80) {
    return true;
  }
  if (/^[IVXLCDM]+\.?\s+[A-Z]/.test(line) && line.length < 80) {
    return true;
  }
  const letters = line.replace(/[^A-Za-z]/g, "");
  const upper = line.replace(/[^A-Z]/g, "");
  return line.length < 80 && letters.length > 4 && upper.length / letters.length > 0.8;
}

function isFootnoteLine(line: string): boolean {
  return /^(\[\d+\]|\d+\)|\*)\s+/.test(line);
}

function isTeacherComment(line: string): boolean {
  return /^(\[(comment|note|instructor):|good point\b|see me\b|revise\b|unclear\b)/i.test(line);
}

function isLikelyCitationLine(line: string): boolean {
  return (
    /^\d+\.\s+[A-Z][^.]+,\s+[A-Z]/.test(line) ||
    /\bdoi:\s*\S+/i.test(line) ||
    /\(\d{4}\)\.\s+.+\.\s+[A-Z]/.test(line) ||
    /^[A-Z][A-Za-z-]+,\s+[A-Z][^.]+\. .+\. .+\.$/.test(line)
  );
}
