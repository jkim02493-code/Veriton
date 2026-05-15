import type { EssayType } from "../essay-planner";
import type { ResolvedStyleProfile, StyleProfile } from "../style-profiler";
import type { CitationFormat } from "./types";

interface PromptStyleProfile {
  syntax?: {
    avgWordsPerSentence?: number;
    burstinessScore?: number;
    passiveVoiceRate?: number;
  };
  lexical?: {
    typeTokenRatio?: number;
  };
  voice?: {
    hedgeRatio?: number;
    firstPersonRate?: number;
  };
}

const ESSAY_TYPE_INSTRUCTIONS: Record<EssayType, string> = {
  argumentative:
    "Build clear arguments. Each section should advance a distinct claim supported by the provided evidence.",
  expository: "Explain clearly and logically. Present evidence as factual grounding, not argument.",
  analytical: "Prioritise interpretation over description. Evidence should support analysis, not replace it.",
  compareContrast:
    "Maintain parallel structure between subjects. Transitions between subjects must be explicit.",
  personalStatement:
    "Write in an authentic narrative voice. Evidence should feel integrated, not cited mechanically.",
};

function getSentenceLengthInstruction(avgWordsPerSentence: number): string {
  if (avgWordsPerSentence > 20) {
    return "Write predominantly long, developed sentences with embedded clauses.";
  }

  if (avgWordsPerSentence >= 13) {
    return "Alternate between moderate and longer sentences.";
  }

  return "Favour short, direct sentences. Keep prose punchy.";
}

function getBurstinessInstruction(burstinessScore: number): string {
  if (burstinessScore >= 0.6) {
    return "Deliberately vary sentence length. Include occasional one-clause sentences alongside long multi-clause sentences. Avoid uniform rhythm.";
  }

  if (burstinessScore < 0.35) {
    return "Keep sentence length consistent. Avoid jarring variation.";
  }

  return "Use a measured rhythm with moderate sentence-length variation.";
}

function getLexicalInstruction(typeTokenRatio: number): string {
  if (typeTokenRatio >= 0.55) {
    return "Use a wide and varied vocabulary. Avoid repeating the same words.";
  }

  if (typeTokenRatio < 0.4) {
    return "Keep vocabulary accessible. Do not over-diversify.";
  }

  return "Use clear academic vocabulary without forcing unusual diction.";
}

function getHedgingInstruction(hedgeRatio: number): string {
  if (hedgeRatio >= 0.6) {
    return "Qualify claims where appropriate. Use phrases like 'suggests', 'indicates', 'appears to'. Avoid overconfident assertions.";
  }

  if (hedgeRatio < 0.4) {
    return "Write assertively. State conclusions directly.";
  }

  return "Balance qualification with direct claims.";
}

function getPassiveVoiceInstruction(passiveVoiceRate: number): string {
  if (passiveVoiceRate > 4) {
    return "Use passive voice frequently where academic convention allows.";
  }

  if (passiveVoiceRate < 2) {
    return "Prefer active constructions.";
  }

  return "Use passive voice selectively when it improves academic flow.";
}

function getFirstPersonInstruction(firstPersonRate: number): string {
  if (firstPersonRate > 1) {
    return "First person is acceptable in this writer's style.";
  }

  return "Avoid first person unless the essay type specifically requires it.";
}

function getCitationInstruction(citationFormat: CitationFormat): string {
  if (citationFormat === "mla") {
    return "Embed inline citations in MLA format: (Author Page) or (Author).";
  }

  return "Embed inline citations in APA format: (Author, Year) or (Author, Year, p. X).";
}

export function buildSystemPrompt(
  profile: StyleProfile,
  resolvedProfile: ResolvedStyleProfile,
  essayType: EssayType,
  citationFormat: CitationFormat,
): string {
  void profile;

  const styleProfile = resolvedProfile as PromptStyleProfile;
  const avgWordsPerSentence = styleProfile.syntax?.avgWordsPerSentence ?? 15;
  const burstinessScore = styleProfile.syntax?.burstinessScore ?? 0.5;
  const typeTokenRatio = styleProfile.lexical?.typeTokenRatio ?? 0.45;
  const hedgeRatio = styleProfile.voice?.hedgeRatio ?? 0.5;
  const passiveVoiceRate = styleProfile.syntax?.passiveVoiceRate ?? 2;
  const firstPersonRate = styleProfile.voice?.firstPersonRate ?? 0;

  return [
    "ROLE BLOCK",
    "You are an academic writing assistant. Your task is to write essay sections that match the style of a specific writer based on their writing profile. You must follow every constraint below exactly.",
    "",
    "STYLE CONSTRAINTS BLOCK",
    getSentenceLengthInstruction(avgWordsPerSentence),
    getBurstinessInstruction(burstinessScore),
    getLexicalInstruction(typeTokenRatio),
    getHedgingInstruction(hedgeRatio),
    getPassiveVoiceInstruction(passiveVoiceRate),
    getFirstPersonInstruction(firstPersonRate),
    "",
    "ESSAY TYPE BLOCK",
    ESSAY_TYPE_INSTRUCTIONS[essayType],
    "",
    "EVIDENCE-FIRST CONSTRAINT BLOCK",
    "You will be given specific evidence nodes for each section.",
    "You MUST use the provided evidence as the foundation for every claim.",
    "Do NOT fabricate statistics, studies, quotes, or sources.",
    "If no evidence is provided for a section, write from logical reasoning only and do not invent citations.",
    "",
    "CITATION FORMAT BLOCK",
    getCitationInstruction(citationFormat),
    "",
    "OUTPUT FORMAT BLOCK",
    "Write only the prose for the section requested. Do not include section headings, labels, or titles unless specifically asked. Do not add a preamble or explanation. Begin writing immediately.",
  ].join("\n");
}
