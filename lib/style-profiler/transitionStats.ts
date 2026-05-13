import type { FrequencyMap, TransitionFingerprint } from "./types";

const TRANSITION_GROUPS = {
  contrastTransitions: ["however", "in contrast", "on the other hand", "nevertheless", "although", "yet", "despite this"],
  additionTransitions: ["furthermore", "moreover", "also", "in addition", "additionally", "similarly"],
  causationTransitions: ["therefore", "as a result", "because of this", "consequently", "thus", "this suggests", "in light of this"],
  conclusionTransitions: ["in conclusion", "ultimately", "overall", "therefore", "as a result", "to conclude"],
  evidenceIntroductionPhrases: ["for example", "for instance", "according to", "the evidence shows", "research suggests", "as shown by"],
  explanationPhrases: ["this means", "this suggests", "this indicates", "in other words", "the reason is", "this reveals"],
  counterargumentPhrases: ["critics argue", "some may argue", "on the other hand", "although", "while this may be true", "despite this"],
};

export function buildTransitionStats(text: string): TransitionFingerprint {
  const groups = Object.fromEntries(
    Object.entries(TRANSITION_GROUPS).map(([group, phrases]) => [group, countPhrases(text, phrases)])
  ) as Omit<TransitionFingerprint, "commonTransitions" | "transitionFrequencyMap">;
  const transitionFrequencyMap = mergeMaps(Object.values(groups));
  const commonTransitions = Object.entries(transitionFrequencyMap)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([phrase]) => phrase);

  return {
    commonTransitions,
    transitionFrequencyMap,
    ...groups,
  };
}

export function countPhrases(text: string, phrases: string[]): FrequencyMap {
  const result: FrequencyMap = {};
  for (const phrase of phrases) {
    const count = text.match(new RegExp(`\\b${escapeRegex(phrase)}\\b`, "gi"))?.length ?? 0;
    if (count > 0) {
      result[phrase] = count;
    }
  }
  return result;
}

function mergeMaps(maps: FrequencyMap[]): FrequencyMap {
  const merged: FrequencyMap = {};
  for (const map of maps) {
    for (const [key, value] of Object.entries(map)) {
      merged[key] = (merged[key] ?? 0) + value;
    }
  }
  return Object.fromEntries(Object.entries(merged).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
