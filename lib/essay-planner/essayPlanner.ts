import { resolveStyleProfileForTask } from "../style-profiler";
import type { ResolvedStyleProfile } from "../style-profiler";
import { computeBlockStrength, computeSourceDiversityScore, detectConflicts, mapEvidenceToSections } from "./evidenceMapper";
import { getGenreSkeleton } from "./genreSkeletons";
import { validatePlan } from "./planValidator";
import type { EssayPlan, EssayPlannerInput, PlannedSection, SectionRole } from "./types";
import { computeWordBudget, resolveBodyBlockCount, resolveSyntacticDensityMode } from "./wordBudget";

export class EssayPlanner {
  generatePlan(input: EssayPlannerInput): EssayPlan {
    return generateEssayPlan(input);
  }
}

export function generateEssayPlan(input: EssayPlannerInput): EssayPlan {
  const resolvedProfile = resolveStyleProfileForTask(input.profile, input.targetDomain);
  const burstinessScore = numberFrom(resolvedProfile.syntax, ["burstinessScore", "burstiness"], 0.5);
  const avgSentenceLength = numberFrom(resolvedProfile.syntax, ["avgWordsPerSentence", "averageSentenceLength"], 15);
  const transitionsByCategory = transitionCategoriesFromProfile(resolvedProfile);
  const densityMode = resolveSyntacticDensityMode(burstinessScore, avgSentenceLength);
  const skeleton = getGenreSkeleton(input.essayType);
  const { assignments, unusedEvidence } = mapEvidenceToSections(input.evidence, skeleton);
  const wordBudget = computeWordBudget(skeleton, input.targetWordCount, densityMode, burstinessScore);
  const bodyBlockCount = resolveBodyBlockCount(densityMode, input.evidence.length, skeleton);

  const sections: PlannedSection[] = skeleton.sections.map((section, index) => {
    const assignedEvidence = assignments.get(section.label) ?? [];
    const assignedNodes = assignedEvidence.map((block) => block.node);
    const sourceDiversityScore = computeSourceDiversityScore(assignedNodes);
    const avgRelevanceScore = assignedEvidence.length
      ? assignedEvidence.reduce((sum, block) => sum + block.relevanceScore, 0) / assignedEvidence.length
      : 0;
    return {
      sectionIndex: index,
      role: section.role,
      label: section.label,
      targetWordCount: wordBudget[section.label] ?? 0,
      assignedEvidence,
      blockStrength: computeBlockStrength(assignedNodes, sourceDiversityScore, avgRelevanceScore),
      sourceDiversityScore,
      suggestedTransitionType: resolveTransitionType(section.role, transitionsByCategory),
      conflictFlags: detectConflicts(assignedNodes),
      targetSyntacticDensity: targetDensityForSection(section.role, densityMode),
      hookStrategy: section.hookStrategy,
      synthesisStrategy: section.synthesisStrategy,
      thesisSlot: section.role === "introduction" ? true : undefined,
    };
  });

  const uniqueAssignedIds = new Set(sections.flatMap((section) => section.assignedEvidence.map((block) => block.node.id)));
  const planWithoutValidation: EssayPlan = {
    schemaVersion: "2.0.0",
    planId: buildPlanId(input),
    createdAt: new Date().toISOString(),
    essayType: input.essayType,
    targetWordCount: input.targetWordCount,
    resolvedProfileDomain: String(resolvedProfile.resolutionMeta.targetDomain),
    sections,
    unusedEvidence,
    totalAssignedEvidence: uniqueAssignedIds.size,
    wordBudgetBreakdown: wordBudget,
    validation: { isValid: true, errors: [], warnings: [] },
    plannerMeta: {
      syntacticDensityMode: densityMode,
      bodyBlockCount,
      profileBurstinessScore: burstinessScore,
      profileAvgSentenceLength: avgSentenceLength,
      evidenceNodeCount: input.evidence.length,
    },
  };

  const validation = validatePlan(planWithoutValidation);
  if (input.evidence.length < skeleton.minimumEvidenceNodes) {
    validation.warnings.push(`Essay type '${input.essayType}' usually works best with at least ${skeleton.minimumEvidenceNodes} evidence node(s).`);
  }
  return { ...planWithoutValidation, validation };
}

function resolveTransitionType(role: SectionRole, transitionProfile: Record<string, number>): string {
  if (role === "introduction") {
    return "no transition needed";
  }
  if (role === "counterArgument") {
    return "contrastive transition (e.g. however, in contrast)";
  }
  if (role === "conclusion" || role === "synthesis") {
    return "conclusive transition (e.g. in conclusion, ultimately)";
  }

  const topCategory = Object.entries(transitionProfile).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "addition";
  const labels: Record<string, string> = {
    contrast: "contrastive transition (e.g. however, in contrast)",
    addition: "additive transition (e.g. furthermore, in addition)",
    causation: "causal transition (e.g. therefore, as a result)",
    exemplification: "illustrative transition (e.g. for example, specifically)",
    conclusion: "conclusive transition (e.g. in conclusion, ultimately)",
    temporal: "temporal transition (e.g. subsequently, following this)",
    concession: "concessive transition (e.g. although, nevertheless)",
  };
  return labels[topCategory] ?? labels.addition;
}

function transitionCategoriesFromProfile(resolvedProfile: ResolvedStyleProfile): Record<string, number> {
  const byCategory = resolvedProfile.transitions.byCategory;
  if (isNumberRecord(byCategory)) {
    return byCategory;
  }
  return {
    contrast: sumMap(resolvedProfile.transitions.contrastTransitions),
    addition: sumMap(resolvedProfile.transitions.additionTransitions),
    causation: sumMap(resolvedProfile.transitions.causationTransitions),
    conclusion: sumMap(resolvedProfile.transitions.conclusionTransitions),
    exemplification: sumMap(resolvedProfile.transitions.evidenceIntroductionPhrases),
    concession: sumMap(resolvedProfile.transitions.counterargumentPhrases),
    temporal: 0,
  };
}

function targetDensityForSection(role: SectionRole, densityMode: "high" | "medium" | "low"): "high" | "medium" | "low" {
  if (role === "introduction" || role === "conclusion") {
    return "low";
  }
  if (role === "counterArgument") {
    return densityMode === "high" ? "medium" : "low";
  }
  return densityMode;
}

function buildPlanId(input: EssayPlannerInput): string {
  const seed = `${input.essayType}|${input.targetWordCount}|${input.evidence.map((node) => node.id).join(",")}|${input.profile.profileId}`;
  let hash = 5381;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 33) ^ seed.charCodeAt(index);
  }
  return `plan_${(hash >>> 0).toString(16)}`;
}

function numberFrom(source: Record<string, unknown>, keys: string[], fallback: number): number {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return fallback;
}

function sumMap(value: unknown): number {
  if (!isNumberRecord(value)) {
    return 0;
  }
  return Object.values(value).reduce((sum, count) => sum + count, 0);
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((item) => typeof item === "number");
}
