import type { AssignedEvidenceBlock, ConflictFlag, EvidenceNode, GenreSectionTemplate, GenreSkeleton } from "./types";

const OPPOSING_SIGNAL_PAIRS: Array<[string, string]> = [
  ["supports", "refutes"],
  ["increases", "decreases"],
  ["positive", "negative"],
  ["effective", "ineffective"],
  ["beneficial", "harmful"],
  ["proves", "disproves"],
];

export function scoreEvidenceForSection(node: EvidenceNode, section: GenreSectionTemplate): number {
  if (!section.goalKeywords.length) {
    return clampRound(node.credibilityScore * 0.2 + sourceTypeBoost(node), 0, 1, 3);
  }
  const nodeText = `${node.keywords.join(" ")} ${node.abstract}`.toLowerCase();
  const matchCount = section.goalKeywords.filter((keyword) => nodeText.includes(keyword.toLowerCase())).length;
  const baseScore = matchCount / section.goalKeywords.length;
  return clampRound(baseScore + node.credibilityScore * 0.2 + sourceTypeBoost(node), 0, 1, 3);
}

export function computeSourceDiversityScore(nodes: EvidenceNode[]): number {
  if (nodes.length <= 1) {
    return 0;
  }
  const uniqueSourceTypes = new Set(nodes.map((node) => node.sourceType)).size;
  const uniqueAuthors = new Set(nodes.map((node) => node.author.toLowerCase())).size;
  let diversityScore = (uniqueSourceTypes / Math.min(nodes.length, 5)) * 0.5 + (uniqueAuthors / nodes.length) * 0.5;
  if (uniqueSourceTypes === 1 && uniqueAuthors === 1) {
    diversityScore -= 0.01;
  }
  return clampRound(diversityScore, 0, 1, 2);
}

export function computeBlockStrength(assignedNodes: EvidenceNode[], diversityScore: number, avgRelevanceScore: number): number {
  if (!assignedNodes.length) {
    return 0;
  }
  const nodeCountScore = Math.min(assignedNodes.length / 3, 1);
  return clampRound(nodeCountScore * 0.4 + diversityScore * 0.3 + avgRelevanceScore * 0.3, 0, 1, 2);
}

export function detectConflicts(nodes: EvidenceNode[]): ConflictFlag[] {
  const conflicts: ConflictFlag[] = [];
  for (let a = 0; a < nodes.length; a += 1) {
    for (let b = a + 1; b < nodes.length; b += 1) {
      const sharedKeyword = nodes[a].keywords.find((keyword) => nodes[b].keywords.map((value) => value.toLowerCase()).includes(keyword.toLowerCase()));
      if (!sharedKeyword) {
        continue;
      }
      const pair = OPPOSING_SIGNAL_PAIRS.find(([first, second]) => hasSignal(nodes[a].abstract, first) && hasSignal(nodes[b].abstract, second)) ??
        OPPOSING_SIGNAL_PAIRS.find(([first, second]) => hasSignal(nodes[a].abstract, second) && hasSignal(nodes[b].abstract, first));
      if (pair) {
        conflicts.push({
          nodeIdA: nodes[a].id,
          nodeIdB: nodes[b].id,
          reason: `Nodes share keyword '${sharedKeyword}' but abstract signals suggest opposing conclusions.`,
        });
      }
    }
  }
  return conflicts;
}

export function mapEvidenceToSections(
  evidence: EvidenceNode[],
  skeleton: GenreSkeleton
): {
  assignments: Map<string, AssignedEvidenceBlock[]>;
  unusedEvidence: EvidenceNode[];
} {
  const assignments = new Map<string, AssignedEvidenceBlock[]>();
  const assignedNodeIds = new Set<string>();

  for (const section of skeleton.sections.filter((item) => item.requiresEvidence)) {
    const scored = evidence
      .map((node) => ({ node, score: scoreEvidenceForSection(node, section) }))
      .sort((a, b) => b.score - a.score || a.node.id.localeCompare(b.node.id));
    const blocks: AssignedEvidenceBlock[] = [];
    const primary = scored.find((item) => item.score >= 0.1);
    if (primary) {
      blocks.push({ node: primary.node, relevanceScore: primary.score, role: "primary" });
    }
    if (section.allowsMultipleSources) {
      const supporting = scored
        .filter((item) => item.node.id !== primary?.node.id && item.score >= 0.05)
        .slice(0, 2)
        .map((item): AssignedEvidenceBlock => ({ node: item.node, relevanceScore: item.score, role: "supporting" }));
      blocks.push(...supporting);
    }
    const diversified = diversifyAuthors(blocks, scored, section.allowsMultipleSources);
    for (const block of diversified) {
      assignedNodeIds.add(block.node.id);
    }
    assignments.set(section.label, diversified);
  }

  return {
    assignments,
    unusedEvidence: evidence.filter((node) => !assignedNodeIds.has(node.id)),
  };
}

function diversifyAuthors(blocks: AssignedEvidenceBlock[], scored: Array<{ node: EvidenceNode; score: number }>, allowsMultipleSources: boolean): AssignedEvidenceBlock[] {
  if (!allowsMultipleSources || blocks.length < 2) {
    return blocks;
  }
  const targetCount = blocks.length;
  const result: AssignedEvidenceBlock[] = [];
  const authors = new Set<string>();
  for (const block of blocks) {
    const author = normalizeAuthor(block.node.author);
    if (!authors.has(author)) {
      result.push(block);
      authors.add(author);
    }
  }
  for (const item of scored) {
    if (result.length >= targetCount) {
      break;
    }
    if (item.score < 0.05 || result.some((block) => block.node.id === item.node.id)) {
      continue;
    }
    const author = normalizeAuthor(item.node.author);
    if (!authors.has(author)) {
      result.push({ node: item.node, relevanceScore: item.score, role: result.length === 0 ? "primary" : "supporting" });
      authors.add(author);
    }
  }
  return result;
}

function sourceTypeBoost(node: EvidenceNode): number {
  if (node.sourceType === "journal" || node.sourceType === "book") {
    return 0.1;
  }
  if (node.sourceType === "governmentReport" || node.sourceType === "universityPage") {
    return 0.05;
  }
  return 0;
}

function hasSignal(text: string, signal: string): boolean {
  return text.toLowerCase().includes(signal.toLowerCase());
}

function normalizeAuthor(author: string): string {
  return author.trim().toLowerCase();
}

function clampRound(value: number, min: number, max: number, places: number): number {
  const clamped = Math.max(min, Math.min(max, value));
  const factor = 10 ** places;
  return Math.round(clamped * factor) / factor;
}
