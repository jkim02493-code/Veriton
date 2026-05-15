import type { WritingDomain } from "../style-profiler";
import { compareDraftToStyleProfile, resolveStyleProfileForTask } from "../style-profiler";
import { assembleDraft, extractWordCount } from "./draftAssembler";
import { buildSectionPrompt } from "./sectionPromptBuilder";
import { buildSystemPrompt } from "./systemPromptBuilder";
import type {
  CitationFormat,
  DraftChunk,
  GeneratedDraft,
  GeneratedSection,
  GenerationConfig,
  GenerationInput,
  GenerationResult,
} from "./types";

const DEFAULT_GENERATION_CONFIG: GenerationConfig = {
  citationFormat: "mla",
  model: "claude-sonnet-4-20250514",
  maxTokensPerSection: 1200,
  temperature: 0.85,
  enableStyleDeltaCheck: true,
  deltaWarningThreshold: 0.35,
};

interface AnthropicTextBlock {
  type: "text";
  text: string;
}

interface AnthropicResponse {
  content?: AnthropicTextBlock[];
}

function isAnthropicTextBlock(value: unknown): value is AnthropicTextBlock {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return candidate.type === "text" && typeof candidate.text === "string";
}

function isAnthropicResponse(value: unknown): value is AnthropicResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return Array.isArray(candidate.content);
}

function extractAnthropicText(payload: unknown): string | null {
  if (!isAnthropicResponse(payload)) {
    return null;
  }

  const textBlock = payload.content?.find(isAnthropicTextBlock);

  return textBlock?.text.trim() ?? null;
}

function djb2Hash(value: string): string {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

function createDraftId(planId: string, profileId: string): string {
  return `generated-draft-${djb2Hash(`${planId}:${profileId}`)}`;
}

function extractProfileId(profile: GenerationInput["profile"]): string {
  return profile.profileId;
}

function collectInlineCitations(text: string, citationFormat: CitationFormat): string[] {
  const pattern =
    citationFormat === "mla"
      ? /\([A-Z][a-z]+(?:\s+\d+)?\)/g
      : /\([A-Z][a-z]+,\s*\d{4}(?:,\s*p\.\s*\d+)?\)/g;
  const matches = text.match(pattern) ?? [];

  return [...new Set(matches)];
}

function splitIntoSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g);

  return matches ?? (text.length > 0 ? [text] : []);
}

function getWordGroupSize(globalChunkIndex: number): number {
  return 3 + (globalChunkIndex % 4);
}

function getTextDelay(wordCount: number, chunkIndex: number): number {
  if (wordCount <= 3) {
    return 80 + (chunkIndex % 4) * 20;
  }

  return 150 + (chunkIndex % 5) * 25;
}

function getPauseDelay(chunkIndex: number): number {
  return 400 + (chunkIndex % 5) * 100;
}

function shouldInsertPause(chunkIndex: number): boolean {
  return chunkIndex > 0 && chunkIndex % 5 === 0;
}

function shouldInsertCorrection(chunkIndex: number): boolean {
  return chunkIndex > 0 && chunkIndex % 19 === 0;
}

function getCorrectionText(previousText: string): string {
  const visibleText = previousText.trimEnd();

  return visibleText.slice(Math.max(visibleText.length - 3, 0));
}

export function buildDraftChunks(text: string): DraftChunk[] {
  const chunks: DraftChunk[] = [];
  const sentences = splitIntoSentences(text);

  for (const sentence of sentences) {
    const tokens = sentence.match(/\S+\s*/g) ?? [];
    let tokenIndex = 0;

    while (tokenIndex < tokens.length) {
      const groupSize = getWordGroupSize(chunks.length);
      const groupTokens = tokens.slice(tokenIndex, tokenIndex + groupSize);
      const chunkText = groupTokens.join("");

      chunks.push({
        chunkIndex: chunks.length,
        text: chunkText,
        delayMs: getTextDelay(groupTokens.length, chunks.length),
        isPause: false,
        isCorrection: false,
      });

      if (shouldInsertPause(chunks.length)) {
        chunks.push({
          chunkIndex: chunks.length,
          text: "",
          delayMs: getPauseDelay(chunks.length),
          isPause: true,
          isCorrection: false,
        });
      }

      if (shouldInsertCorrection(chunks.length) && chunkText.trim().length > 0) {
        const correctionText = getCorrectionText(chunkText);

        if (correctionText.length > 0) {
          chunks.push({
            chunkIndex: chunks.length,
            text: correctionText,
            delayMs: 200,
            isPause: false,
            isCorrection: true,
          });
          chunks.push({
            chunkIndex: chunks.length,
            text: correctionText,
            delayMs: 150,
            isPause: false,
            isCorrection: true,
          });
        }
      }

      tokenIndex += groupTokens.length;
    }
  }

  return chunks;
}

async function callAnthropicApi(
  systemPrompt: string,
  sectionPrompt: string,
  config: GenerationConfig,
): Promise<string | null> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokensPerSection,
      temperature: config.temperature,
      system: systemPrompt,
      messages: [{ role: "user", content: sectionPrompt }],
    }),
  });

  if (!response.ok) {
    return null;
  }

  return extractAnthropicText(await response.json());
}

export async function runGenerationPipeline(input: GenerationInput): Promise<GenerationResult> {
  const config: GenerationConfig = {
    ...DEFAULT_GENERATION_CONFIG,
    ...input.config,
  };
  const resolvedProfile = resolveStyleProfileForTask(
    input.profile,
    input.plan.resolvedProfileDomain as WritingDomain,
  );
  const systemPrompt = buildSystemPrompt(
    input.profile,
    resolvedProfile,
    input.plan.essayType,
    config.citationFormat,
  );
  const errors: string[] = [];
  const styleWarnings: string[] = [];
  const sections: GeneratedSection[] = [];
  const totalSections = input.plan.sections.length;

  for (let index = 0; index < totalSections; index += 1) {
    const plannedSection = input.plan.sections[index];
    const sectionPrompt = buildSectionPrompt(
      plannedSection,
      input.plan,
      config.citationFormat,
      index,
      totalSections,
    );

    let generatedText = "";

    try {
      generatedText = (await callAnthropicApi(systemPrompt, sectionPrompt, config)) ?? "";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Section '${plannedSection.label}' generation failed: ${message}`);
    }

    if (generatedText.length === 0) {
      errors.push(`Section '${plannedSection.label}' returned no text content.`);
    }

    const styleDeltaResult = config.enableStyleDeltaCheck
      ? compareDraftToStyleProfile(
          generatedText,
          input.profile,
          input.plan.resolvedProfileDomain as WritingDomain,
        )
      : null;
    const wordCount = extractWordCount(generatedText);
    const citationsUsed = collectInlineCitations(generatedText, config.citationFormat);

    if (
      styleDeltaResult &&
      styleDeltaResult.overallSimilarityScore < config.deltaWarningThreshold
    ) {
      styleWarnings.push(
        `Section '${plannedSection.label}' style similarity is ${styleDeltaResult.overallSimilarityScore}. Review for stylistic drift.`,
      );
    }

    sections.push({
      sectionIndex: plannedSection.sectionIndex,
      role: plannedSection.role,
      label: plannedSection.label,
      generatedText,
      wordCount,
      targetWordCount: plannedSection.targetWordCount,
      wordCountDelta: wordCount - plannedSection.targetWordCount,
      styleDeltaResult,
      citationsUsed,
      draftChunks: buildDraftChunks(generatedText),
    });
  }

  const assembledText = assembleDraft(sections, input.plan.essayType);
  const styleScores = sections
    .map((section) => section.styleDeltaResult?.overallSimilarityScore)
    .filter((score): score is number => typeof score === "number");
  const overallStyleSimilarity =
    styleScores.length === 0
      ? 0
      : styleScores.reduce((sum, score) => sum + score, 0) / styleScores.length;
  const worksСited = [...new Set(sections.flatMap((section) => section.citationsUsed))].sort((left, right) =>
    left.localeCompare(right),
  );
  const profileId = extractProfileId(input.profile);
  const draft: GeneratedDraft = {
    schemaVersion: "3.0.0",
    draftId: createDraftId(input.plan.planId, profileId),
    planId: input.plan.planId,
    profileId,
    essayType: input.plan.essayType,
    citationFormat: config.citationFormat,
    sections,
    assembledText,
    totalWordCount: extractWordCount(assembledText),
    targetWordCount: input.plan.targetWordCount,
    totalAssignedEvidence: input.plan.totalAssignedEvidence,
    overallStyleSimilarity,
    worksСited,
    styleWarnings,
    generatedAt: new Date().toISOString(),
  };

  return {
    draft,
    errors,
    totalApiCalls: totalSections,
  };
}
