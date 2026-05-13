import type { EssayType, GenreSkeleton } from "./types";

export const GENRE_SKELETONS: Record<EssayType, GenreSkeleton> = {
  argumentative: {
    essayType: "argumentative",
    minimumEvidenceNodes: 4,
    supportsCounterArgument: true,
    sections: [
      section("introduction", "Introduction", [], false, false, 0.1, "statistical or rhetorical"),
      section("claim", "Claim 1", ["supports", "argues", "demonstrates", "evidence", "proves"], true, true, 0.2),
      section("claim", "Claim 2", ["supports", "argues", "demonstrates", "evidence", "proves"], true, true, 0.2),
      section("claim", "Claim 3", ["supports", "argues", "demonstrates", "evidence", "proves"], true, true, 0.2),
      section("counterArgument", "Counter-Perspective", ["however", "critics", "counterargument", "refutes", "opposes"], true, true, 0.1),
      section("synthesis", "Synthesis", [], false, false, 0.2, undefined, "restate-and-elevate"),
    ],
  },
  expository: {
    essayType: "expository",
    minimumEvidenceNodes: 3,
    supportsCounterArgument: false,
    sections: [
      section("introduction", "Introduction", [], false, false, 0.1),
      section("layer", "Layer 1", ["explains", "describes", "illustrates", "defines", "shows"], true, true, 0.175),
      section("layer", "Layer 2", ["explains", "describes", "illustrates", "defines", "shows"], true, true, 0.175),
      section("layer", "Layer 3", ["explains", "describes", "illustrates", "defines", "shows"], true, true, 0.175),
      section("layer", "Layer 4", ["explains", "describes", "illustrates", "defines", "shows"], true, true, 0.175),
      section("conclusion", "Conclusion", [], false, false, 0.2, undefined, "summary-and-implication"),
    ],
  },
  analytical: {
    essayType: "analytical",
    minimumEvidenceNodes: 3,
    supportsCounterArgument: false,
    sections: [
      section("introduction", "Introduction", [], false, false, 0.1, "contextual framing"),
      section("layer", "Analytical Layer 1", ["analysis", "pattern", "significance", "reveals", "implies", "underlying"], true, true, 0.25),
      section("layer", "Analytical Layer 2", ["analysis", "pattern", "significance", "reveals", "implies", "underlying"], true, true, 0.25),
      section("layer", "Analytical Layer 3", ["analysis", "pattern", "significance", "reveals", "implies", "underlying"], true, true, 0.25),
      section("conclusion", "Conclusion", [], false, false, 0.15, undefined, "insight-forward"),
    ],
  },
  compareContrast: {
    essayType: "compareContrast",
    minimumEvidenceNodes: 4,
    supportsCounterArgument: false,
    sections: [
      section("introduction", "Introduction", [], false, false, 0.1, "juxtaposition"),
      section("claim", "Subject A", ["first", "subject a", "primary", "original", "former"], true, true, 0.25),
      section("claim", "Subject B", ["second", "subject b", "secondary", "latter", "alternative"], true, true, 0.25),
      section("synthesis", "Comparison Synthesis", ["both", "similarly", "contrast", "difference", "comparison"], true, true, 0.25, undefined, "convergence-or-divergence"),
      section("conclusion", "Conclusion", [], false, false, 0.15),
    ],
  },
  personalStatement: {
    essayType: "personalStatement",
    minimumEvidenceNodes: 0,
    supportsCounterArgument: false,
    sections: [
      section("introduction", "Introduction", [], false, false, 0.15, "narrative-hook"),
      section("layer", "Narrative Layer", ["experience", "personal", "journey", "growth", "challenge"], false, false, 0.3),
      section("layer", "Evidence Layer", ["research", "achievement", "demonstrates", "supported by", "evidence"], true, false, 0.3),
      section("conclusion", "Conclusion", [], false, false, 0.25, undefined, "forward-looking"),
    ],
  },
};

export function getGenreSkeleton(type: EssayType): GenreSkeleton {
  const skeleton = GENRE_SKELETONS[type];
  if (!skeleton) {
    throw new Error(`Unknown essay type: ${String(type)}`);
  }
  return skeleton;
}

function section(
  role: GenreSkeleton["sections"][number]["role"],
  label: string,
  goalKeywords: string[],
  requiresEvidence: boolean,
  allowsMultipleSources: boolean,
  baseWordCountWeight: number,
  hookStrategy?: string,
  synthesisStrategy?: string
): GenreSkeleton["sections"][number] {
  return { role, label, goalKeywords, requiresEvidence, allowsMultipleSources, baseWordCountWeight, hookStrategy, synthesisStrategy };
}
