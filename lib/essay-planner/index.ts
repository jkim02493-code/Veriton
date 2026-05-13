export { EssayPlanner, generateEssayPlan } from "./essayPlanner";
export { computeBlockStrength, computeSourceDiversityScore, detectConflicts, mapEvidenceToSections, scoreEvidenceForSection } from "./evidenceMapper";
export { GENRE_SKELETONS, getGenreSkeleton } from "./genreSkeletons";
export { validatePlan } from "./planValidator";
export { computeWordBudget, resolveBodyBlockCount, resolveSyntacticDensityMode } from "./wordBudget";
export type {
  AssignedEvidenceBlock,
  ConflictFlag,
  EssayPlan,
  EssayPlannerInput,
  EssayType,
  EvidenceNode,
  GenreSectionTemplate,
  GenreSkeleton,
  PlanValidationResult,
  PlannedSection,
  SectionRole,
  WritingDomain,
} from "./types";
