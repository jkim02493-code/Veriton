export { buildStyleProfile } from "./buildStyleProfile";
export { buildPhraseFingerprint } from "./phraseFingerprint";
export { computeProfileReliability } from "./profileReliability";
export { normalizeText } from "./normalizeText";
export { resolveStyleProfileForTask } from "./resolveStyleProfileForTask";
export { compareDraftToStyleProfile } from "./styleDelta";
export { migrateProfileSchema } from "./types";
export type {
  ArgumentativeStance,
  FrequencyMap,
  LexicalLandscape,
  NumericDistribution,
  PunctuationHabits,
  SemanticVoiceProfile,
  SpellingVariantPreference,
  StyleDomainProfile,
  StyleProfile,
  StyleProfileInput,
  StyleProfileResult,
  SyntacticFingerprint,
  TransitionFingerprint,
  WritingDomain,
  WritingSample,
} from "./types";
export type { NormalizeOptions } from "./normalizeText";
export type { PhraseFingerprint } from "./phraseFingerprint";
export type { ProfileReliability } from "./profileReliability";
export type { ResolvedStyleProfile, WritingDomain as TaskWritingDomain } from "./resolveStyleProfileForTask";
export type { StyleDeltaResult } from "./styleDelta";
