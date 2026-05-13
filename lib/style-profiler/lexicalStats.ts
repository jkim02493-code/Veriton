import type { FrequencyMap, LexicalLandscape } from "./types";
import { DOMAIN_KEYWORDS } from "./domainClassifier";
import { round, tokenizeWords, topFrequencyMap } from "./sentenceStats";

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "can",
  "not",
  "from",
  "by",
  "as",
  "into",
  "through",
  "there",
  "their",
  "they",
  "we",
  "you",
  "i",
  "my",
  "our",
]);

const COMMON_WORDS = new Set([...STOP_WORDS, "also", "more", "most", "many", "some", "such", "than", "then", "when", "where", "which", "while", "who", "how", "all", "any", "each", "very"]);

const ACADEMIC_TERMS = new Set([
  "analysis",
  "argument",
  "context",
  "evidence",
  "research",
  "significant",
  "demonstrates",
  "suggests",
  "indicates",
  "therefore",
  "however",
  "concept",
  "theory",
  "method",
  "process",
  "factor",
  "impact",
  "structure",
  "policy",
  "development",
  "interpretation",
  "relationship",
  "perspective",
  "implication",
  "consequence",
]);

const SYNONYM_GROUPS: Record<string, string[]> = {
  shows: ["shows", "demonstrates", "reveals", "indicates", "suggests", "implies"],
  important: ["important", "significant", "meaningful", "notable", "central", "crucial"],
  because: ["because", "since", "as", "therefore", "consequently"],
  change: ["change", "shift", "transform", "alter", "develop"],
  supports: ["supports", "confirms", "strengthens", "reinforces", "validates"],
};

const OVERUSED_WORDS = ["very", "really", "thing", "stuff", "good", "bad", "nice", "a lot", "important"];
const DOMAIN_VOCABULARY = Object.fromEntries(Object.entries(DOMAIN_KEYWORDS).map(([domain, words]) => [domain, new Set(words)]));

export function buildLexicalStats(text: string): LexicalLandscape {
  const words = tokenizeWords(text);
  const meaningfulWords = words.filter((word) => !STOP_WORDS.has(word) && word.length > 2);
  const vocabularyFrequencyMap = topFrequencyMap(meaningfulWords, 100);
  const uniqueWords = new Set(words);
  const hapaxCount = Object.values(countWords(words)).filter((count) => count === 1).length;
  const domainSpecificWords = new Set(Object.values(DOMAIN_KEYWORDS).flat());
  const tierCounts = { common: 0, academic: 0, domainSpecific: 0, rare: 0 };

  for (const word of words) {
    if (COMMON_WORDS.has(word)) {
      tierCounts.common += 1;
    } else if (ACADEMIC_TERMS.has(word)) {
      tierCounts.academic += 1;
    } else if (domainSpecificWords.has(word)) {
      tierCounts.domainSpecific += 1;
    } else if (word.length >= 10 || (vocabularyFrequencyMap[word] ?? 0) === 1) {
      tierCounts.rare += 1;
    }
  }

  return {
    vocabularyFrequencyMap,
    topAcademicTerms: Object.keys(vocabularyFrequencyMap).filter((word) => ACADEMIC_TERMS.has(word)).slice(0, 15),
    repeatedAcademicPhrases: repeatedPhrases(meaningfulWords),
    lexicalDiversityScore: words.length ? round(uniqueWords.size / Math.sqrt(words.length), 3) : 0,
    typeTokenRatio: words.length ? round(uniqueWords.size / words.length, 3) : 0,
    hapaxLegomenaRate: words.length ? round(hapaxCount / words.length, 3) : 0,
    vocabularyTierDistribution: normalizeTierCounts(tierCounts, Math.max(words.length, 1)),
    preferredSynonyms: buildPreferredSynonyms(words),
    avoidedOverusedWords: OVERUSED_WORDS.filter((word) => vocabularyFrequencyMap[word] && vocabularyFrequencyMap[word] >= 3),
    domainVocabularyByCategory: buildDomainVocabulary(meaningfulWords),
  };
}

function countWords(words: string[]): FrequencyMap {
  const counts: FrequencyMap = {};
  for (const word of words) {
    counts[word] = (counts[word] ?? 0) + 1;
  }
  return counts;
}

function repeatedPhrases(words: string[]): FrequencyMap {
  const phrases: string[] = [];
  for (const size of [2, 3, 4]) {
    for (let index = 0; index <= words.length - size; index += 1) {
      const phrase = words.slice(index, index + size).join(" ");
      if (phrase.length >= 9) {
        phrases.push(phrase);
      }
    }
  }
  return Object.fromEntries(Object.entries(topFrequencyMap(phrases, 25)).filter(([, count]) => count > 1));
}

function normalizeTierCounts(tierCounts: { common: number; academic: number; domainSpecific: number; rare: number }, total: number): LexicalLandscape["vocabularyTierDistribution"] {
  return {
    common: round(tierCounts.common / total, 3),
    academic: round(tierCounts.academic / total, 3),
    domainSpecific: round(tierCounts.domainSpecific / total, 3),
    rare: round(tierCounts.rare / total, 3),
  };
}

function buildPreferredSynonyms(words: string[]): LexicalLandscape["preferredSynonyms"] {
  const counts = countWords(words);
  const result: LexicalLandscape["preferredSynonyms"] = {};
  for (const [concept, alternatives] of Object.entries(SYNONYM_GROUPS)) {
    const present: FrequencyMap = {};
    for (const word of alternatives) {
      const count = counts[word] ?? 0;
      if (count > 0) {
        present[word] = count;
      }
    }
    const preferred = Object.entries(present).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (preferred) {
      result[concept] = { preferred, alternatives: present };
    }
  }
  return result;
}

function buildDomainVocabulary(words: string[]): Record<string, FrequencyMap> {
  const result: Record<string, FrequencyMap> = {};
  for (const [domain, vocabulary] of Object.entries(DOMAIN_VOCABULARY)) {
    const matches = words.filter((word) => vocabulary.has(word));
    if (matches.length) {
      result[domain] = topFrequencyMap(matches, 20);
    }
  }
  return result;
}
