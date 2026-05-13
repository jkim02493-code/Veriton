import type { FrequencyMap, WritingDomain } from "./types";
import { tokenizeWords } from "./sentenceStats";

export const VALID_DOMAINS: WritingDomain[] = [
  "humanities",
  "scientific",
  "business",
  "literaryAnalysis",
  "history",
  "personalStatement",
  "generalAcademic",
  "unknown",
];

export const DOMAIN_KEYWORDS: Record<Exclude<WritingDomain, "unknown">, string[]> = {
  humanities: ["culture", "identity", "ethics", "society", "philosophy", "meaning", "human", "moral", "social"],
  scientific: ["experiment", "data", "method", "result", "hypothesis", "biology", "chemical", "physics", "variable", "evidence"],
  business: ["market", "revenue", "strategy", "consumer", "investment", "finance", "management", "brand", "profit"],
  literaryAnalysis: ["novel", "poem", "character", "symbol", "theme", "narrator", "imagery", "metaphor", "literary"],
  history: ["war", "empire", "revolution", "government", "century", "regime", "historical", "colonial", "political"],
  personalStatement: ["i", "my", "me", "experience", "learned", "goal", "passion", "community", "challenge"],
  generalAcademic: ["argument", "evidence", "research", "analysis", "claim", "study", "concept", "issue", "context"],
};

export function normalizeDomain(domain?: string): WritingDomain | undefined {
  return VALID_DOMAINS.includes(domain as WritingDomain) ? (domain as WritingDomain) : undefined;
}

export function inferDomain(text: string): WritingDomain {
  const words = tokenizeWords(text);
  const counts: FrequencyMap = {};
  for (const word of words) {
    counts[word] = (counts[word] ?? 0) + 1;
  }

  let bestDomain: WritingDomain = "unknown";
  let bestScore = 0;
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS) as Array<[Exclude<WritingDomain, "unknown">, string[]]>) {
    const score = keywords.reduce((sum, keyword) => sum + (counts[keyword] ?? 0), 0);
    if (score > bestScore) {
      bestDomain = domain;
      bestScore = score;
    }
  }

  return bestScore >= 2 ? bestDomain : "generalAcademic";
}

export function classifyDomain(text: string, providedDomain?: string): WritingDomain {
  return normalizeDomain(providedDomain) ?? inferDomain(text);
}
