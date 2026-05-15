import type { EssayPlan, PlannedSection } from "../essay-planner";
import type { CitationFormat } from "./types";

const DENSITY_INSTRUCTIONS: Record<"high" | "medium" | "low", string> = {
  high: "Use complex, multi-clause sentences in this section. Allow structural depth.",
  medium: "Balance complexity and clarity.",
  low: "Keep this section clear and direct. Shorter sentences are appropriate here.",
};

function buildEvidenceBlock(section: PlannedSection, citationFormat: CitationFormat): string {
  if (section.assignedEvidence.length === 0) {
    return [
      "No specific sources are assigned to this section.",
      "Write from logical reasoning. Do not fabricate citations.",
    ].join("\n");
  }

  const sourceBlocks = section.assignedEvidence.map((assignment) => {
    const node = assignment.node;
    const roleLabel = assignment.role.toUpperCase();

    return [
      `Source [${roleLabel}]:`,
      `Title: ${node.title}`,
      `Author: ${node.author}`,
      `Year: ${node.year ?? "n.d."}`,
      `Key points: ${node.abstract}`,
      `Citation (MLA): ${node.citationMla}`,
      `Citation (APA): ${node.citationApa}`,
    ].join("\n");
  });

  return [
    "Use the following sources as the evidence foundation for this section.",
    `Cite them using ${citationFormat} format inline.`,
    ...sourceBlocks,
  ].join("\n");
}

function buildRoleSpecificInstruction(section: PlannedSection): string {
  if (section.role === "introduction") {
    return "Include a thesis statement slot near the end of the introduction. The thesis should reflect the overall argument direction of the full essay.";
  }

  if (section.role === "counterArgument") {
    return "Steelman the opposing view before refuting it.";
  }

  if (section.role === "synthesis" || section.role === "conclusion") {
    return "Do not introduce new evidence. Synthesise what has been argued.";
  }

  return "";
}

export function buildSectionPrompt(
  section: PlannedSection,
  plan: EssayPlan,
  citationFormat: CitationFormat,
  sectionIndex: number,
  totalSections: number,
): string {
  void plan;

  const minimumWordCount = Math.max(section.targetWordCount - 50, 0);
  const maximumWordCount = section.targetWordCount + 50;
  const promptParts = [
    `This is section ${sectionIndex + 1} of ${totalSections}: ${section.label}.`,
    "",
    `Target word count: ${section.targetWordCount} words.`,
    `Write between ${minimumWordCount} and ${maximumWordCount} words.`,
    "",
    DENSITY_INSTRUCTIONS[section.targetSyntacticDensity],
  ];

  if (section.role !== "introduction") {
    promptParts.push("", `Open this section with a ${section.suggestedTransitionType}.`);
  }

  promptParts.push("", buildEvidenceBlock(section, citationFormat));

  if (section.conflictFlags.length > 0) {
    promptParts.push(
      "",
      "Note: some assigned sources may present contrasting views.",
      "Handle the tension explicitly rather than blending them.",
    );
  }

  const roleSpecificInstruction = buildRoleSpecificInstruction(section);

  if (roleSpecificInstruction.length > 0) {
    promptParts.push("", roleSpecificInstruction);
  }

  return promptParts.join("\n");
}
