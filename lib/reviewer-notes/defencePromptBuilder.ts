import type { SectionNote } from "./types";

function flowVerbForEssayType(essayType: string): string {
  if (essayType === "analytical") {
    return "traces";
  }

  if (essayType === "compareContrast") {
    return "compares";
  }

  return "is built from";
}

function logicalFlowForRoles(roles: string[]): string {
  if (roles.includes("counterArgument")) {
    return "moves from context to claims, addresses an opposing view, and then resolves the argument.";
  }

  if (roles.includes("synthesis") || roles.includes("conclusion")) {
    return "moves from setup through supporting sections toward a final synthesis.";
  }

  return "develops its ideas section by section so the reader can follow the reasoning.";
}

export function buildOverallSummary(sectionNotes: SectionNote[], essayType: string): string {
  const totalClaims = sectionNotes.reduce((total, note) => total + note.keyClaims.length, 0);
  const sourceCount = new Set(
    sectionNotes.flatMap((note) =>
      note.keyClaims
        .map((claim) => claim.supportingSource)
        .filter((source) => source !== "No citation"),
    ),
  ).size;
  const roles = sectionNotes.map((note) => note.role);

  return `This ${essayType} essay makes ${totalClaims} key claims across ${sectionNotes.length} sections, drawing on ${sourceCount} sources. The central argument ${flowVerbForEssayType(essayType)} the section-level claims and evidence. Overall the essay ${logicalFlowForRoles(roles)}`;
}

export function computeNotesId(draftId: string): string {
  const input = `reviewer-notes-${draftId}`;
  let hash = 5381;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33 + input.charCodeAt(index)) >>> 0;
  }

  return hash.toString(16);
}
