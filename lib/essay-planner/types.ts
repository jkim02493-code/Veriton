import type { StyleProfile, TaskWritingDomain as WritingDomain } from "../style-profiler";

export type EssayType = "argumentative" | "expository" | "analytical" | "compareContrast" | "personalStatement";

export interface EvidenceNode {
  id: string;
  title: string;
  author: string;
  year: number | null;
  keywords: string[];
  abstract: string;
  credibilityScore: number;
  citationMla: string;
  citationApa: string;
  sourceType: "journal" | "book" | "governmentReport" | "universityPage" | "newsOutlet" | "other";
}

export type SectionRole = "introduction" | "claim" | "counterArgument" | "synthesis" | "conclusion" | "layer";

export interface GenreSectionTemplate {
  role: SectionRole;
  label: string;
  goalKeywords: string[];
  requiresEvidence: boolean;
  allowsMultipleSources: boolean;
  baseWordCountWeight: number;
  hookStrategy?: string;
  synthesisStrategy?: string;
}

export interface GenreSkeleton {
  essayType: EssayType;
  sections: GenreSectionTemplate[];
  minimumEvidenceNodes: number;
  supportsCounterArgument: boolean;
}

export interface AssignedEvidenceBlock {
  node: EvidenceNode;
  relevanceScore: number;
  role: "primary" | "supporting";
}

export interface ConflictFlag {
  nodeIdA: string;
  nodeIdB: string;
  reason: string;
}

export interface PlannedSection {
  sectionIndex: number;
  role: SectionRole;
  label: string;
  targetWordCount: number;
  assignedEvidence: AssignedEvidenceBlock[];
  blockStrength: number;
  sourceDiversityScore: number;
  suggestedTransitionType: string;
  conflictFlags: ConflictFlag[];
  targetSyntacticDensity: "high" | "medium" | "low";
  hookStrategy?: string;
  synthesisStrategy?: string;
  thesisSlot?: boolean;
}

export interface PlanValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface EssayPlan {
  schemaVersion: "2.0.0";
  planId: string;
  createdAt: string;
  essayType: EssayType;
  targetWordCount: number;
  resolvedProfileDomain: string;
  sections: PlannedSection[];
  unusedEvidence: EvidenceNode[];
  totalAssignedEvidence: number;
  wordBudgetBreakdown: Record<string, number>;
  validation: PlanValidationResult;
  plannerMeta: {
    syntacticDensityMode: "high" | "medium" | "low";
    bodyBlockCount: number;
    profileBurstinessScore: number;
    profileAvgSentenceLength: number;
    evidenceNodeCount: number;
  };
}

export interface EssayPlannerInput {
  evidence: EvidenceNode[];
  profile: StyleProfile;
  essayType: EssayType;
  targetWordCount: number;
  targetDomain?: WritingDomain;
}

export type { WritingDomain };
