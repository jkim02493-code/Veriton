import type { EssayPlan, PlanValidationResult } from "./types";

export function validatePlan(plan: EssayPlan): PlanValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (plan.sections.length === 0) {
    errors.push("Plan has no sections.");
  }

  for (const section of plan.sections) {
    if (plan.plannerMeta.evidenceNodeCount > 0 && requiresEvidence(section.role, section.label) && section.assignedEvidence.length === 0) {
      errors.push(`Section '${section.label}' requires evidence but has none assigned.`);
    }
  }

  const totalWords = plan.sections.reduce((sum, section) => sum + section.targetWordCount, 0);
  if (Math.abs(totalWords - plan.targetWordCount) > plan.targetWordCount * 0.1) {
    errors.push("Total word count deviates from targetWordCount by more than 10%.");
  }

  if (plan.plannerMeta.evidenceNodeCount > 0 && plan.totalAssignedEvidence === 0) {
    errors.push("Evidence was provided but no evidence nodes were assigned.");
  }

  for (const section of plan.sections) {
    if ((section.role === "claim" || section.role === "layer") && section.blockStrength < 0.3) {
      warnings.push(`Section '${section.label}' has low block strength. Consider adding more evidence.`);
    }
    if ((section.role === "claim" || section.role === "layer") && section.sourceDiversityScore < 0.3 && section.assignedEvidence.length >= 2) {
      warnings.push(`Section '${section.label}' relies heavily on a single source type.`);
    }
    if (section.conflictFlags.length > 0) {
      warnings.push(`Section '${section.label}' contains ${section.conflictFlags.length} potential evidence conflict(s). Review before drafting.`);
    }
  }

  if (plan.unusedEvidence.length > 0) {
    warnings.push(`${plan.unusedEvidence.length} evidence node(s) were not assigned to any section.`);
  }

  return { isValid: errors.length === 0, errors, warnings };
}

function requiresEvidence(role: string, label: string): boolean {
  return role === "claim" || role === "counterArgument" || (role === "layer" && !/narrative/i.test(label)) || /comparison synthesis/i.test(label);
}
