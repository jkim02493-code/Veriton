import { buildOverallSummary, computeNotesId } from "./defencePromptBuilder";
import { extractKeyClaims, extractKeyTerms } from "./keyClaimExtractor";
import { summariseSection } from "./sectionSummariser";
import type {
  KeyTerm,
  ReviewerNotesConfig,
  ReviewerNotesInput,
  ReviewerNotesResult,
  SectionNote,
} from "./types";

const DEFAULT_CONFIG: ReviewerNotesConfig = {
  model: "claude-sonnet-4-20250514",
  maxTokensPerSection: 600,
  includeDefenceQuestions: true,
  includeKeyTerms: true,
  includeEvidenceSummary: true,
  readingLevel: "standard",
};

function firstSentences(text: string, count: number): string {
  return (text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [])
    .slice(0, count)
    .map((sentence) => sentence.trim())
    .join(" ");
}

export async function generateReviewerNotes(input: ReviewerNotesInput): Promise<ReviewerNotesResult> {
  const config: ReviewerNotesConfig = {
    ...DEFAULT_CONFIG,
    ...input.config,
  };
  const errors: string[] = [];
  const sectionNotes: SectionNote[] = [];
  let totalApiCalls = 0;

  for (const section of input.draft.sections) {
    const keyClaims = extractKeyClaims(section.generatedText, section.citationsUsed);
    const keyTerms: KeyTerm[] = config.includeKeyTerms ? extractKeyTerms(section.generatedText) : [];
    let plainSummary = "";
    let filledKeyTerms: KeyTerm[] = [];
    let defenceQuestions: SectionNote["defenceQuestions"] = [];
    let evidenceSummary = "";

    try {
      const summary = await summariseSection(section, keyTerms, config);
      totalApiCalls += 1;
      plainSummary = summary.plainSummary;
      filledKeyTerms = summary.filledKeyTerms;
      defenceQuestions = summary.defenceQuestions;
      evidenceSummary = summary.evidenceSummary;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Section '${section.label}' reviewer notes failed: ${message}`);
      plainSummary = firstSentences(section.generatedText, 3);
    }

    sectionNotes.push({
      sectionIndex: section.sectionIndex,
      sectionLabel: section.label,
      role: section.role,
      plainSummary,
      keyClaims,
      keyTerms: config.includeKeyTerms ? filledKeyTerms : [],
      evidenceSummary: config.includeEvidenceSummary ? evidenceSummary : "",
      defenceQuestions: config.includeDefenceQuestions ? defenceQuestions : [],
      wordCount: section.wordCount,
    });
  }

  const totalKeyClaims = sectionNotes.reduce((total, note) => total + note.keyClaims.length, 0);
  const totalDefenceQuestions = sectionNotes.reduce(
    (total, note) => total + note.defenceQuestions.length,
    0,
  );
  const totalKeyTerms = sectionNotes.reduce((total, note) => total + note.keyTerms.length, 0);

  return {
    notes: {
      schemaVersion: "5.0.0",
      notesId: computeNotesId(input.draft.draftId),
      draftId: input.draft.draftId,
      essayType: input.draft.essayType,
      generatedAt: new Date().toISOString(),
      config,
      sectionNotes,
      overallSummary: buildOverallSummary(sectionNotes, input.draft.essayType),
      totalKeyClaims,
      totalDefenceQuestions,
      totalKeyTerms,
    },
    errors,
    totalApiCalls,
  };
}
