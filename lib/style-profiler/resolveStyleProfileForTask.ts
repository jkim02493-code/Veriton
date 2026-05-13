import type { StyleDomainProfile, StyleProfile, WritingDomain as ProfileWritingDomain } from "./types";

export type WritingDomain = "history" | "science" | "literature" | "philosophy" | "business" | "personalStatement" | "general";

export interface ResolvedStyleProfile {
  syntax: Record<string, unknown>;
  lexical: Record<string, unknown>;
  transitions: Record<string, unknown>;
  punctuation: Record<string, unknown>;
  semanticVoice: Record<string, unknown>;
  resolutionMeta: {
    targetDomain: WritingDomain | "global";
    domainWeight: number;
    globalWeight: number;
    explanation: string;
  };
}

const DOMAIN_ALIASES: Record<WritingDomain, ProfileWritingDomain> = {
  history: "history",
  science: "scientific",
  literature: "literaryAnalysis",
  philosophy: "humanities",
  business: "business",
  personalStatement: "personalStatement",
  general: "generalAcademic",
};

export function resolveStyleProfileForTask(profile: StyleProfile, targetDomain?: WritingDomain): ResolvedStyleProfile {
  const globalProfile = profile.globalProfile;
  const domainKey = targetDomain ? DOMAIN_ALIASES[targetDomain] : undefined;
  const domainProfile = domainKey ? profile.domainProfiles[domainKey] : undefined;

  if (targetDomain && domainProfile) {
    return buildResolvedProfile(
      blendDomainProfiles(domainProfile, globalProfile, 0.7, 0.3),
      {
        targetDomain,
        domainWeight: 0.7,
        globalWeight: 0.3,
        explanation: `Using ${targetDomain} domain profile (70%) blended with global profile (30%).`,
      }
    );
  }

  return buildResolvedProfile(globalProfile, {
    targetDomain: "global",
    domainWeight: 0,
    globalWeight: 1,
    explanation: targetDomain
      ? `No ${targetDomain} domain profile found; using global profile at 100%.`
      : "No target domain specified; using global profile at 100%.",
  });
}

function buildResolvedProfile(profile: StyleDomainProfile, resolutionMeta: ResolvedStyleProfile["resolutionMeta"]): ResolvedStyleProfile {
  const syntax = {
    ...profile.syntacticFingerprint,
    avgWordsPerSentence: profile.syntacticFingerprint.averageSentenceLength,
    sentenceLengthStdDev: profile.syntacticFingerprint.sentenceLengthStandardDeviation,
    burstiness: profile.syntacticFingerprint.burstinessScore,
  };
  const lexical = {
    ...profile.lexicalLandscape,
    uniqueWordRatio: profile.lexicalLandscape.typeTokenRatio,
  };
  const transitionTotal = Object.values(profile.transitionFingerprint.transitionFrequencyMap).reduce((sum, count) => sum + count, 0);
  const transitions = {
    ...profile.transitionFingerprint,
    transitionRate: profile.wordCount ? (transitionTotal / profile.wordCount) * 100 : 0,
  };
  const punctuation = {
    ...profile.punctuationHabits,
    commaSemicolonRate: profile.punctuationHabits.commaDensity + profile.punctuationHabits.semicolonDensity,
  };
  const hedgeTotal = Object.values(profile.semanticVoiceProfile.hedgePhraseFrequency).reduce((sum, count) => sum + count, 0);
  const boostTotal = Object.values(profile.semanticVoiceProfile.boostPhraseFrequency).reduce((sum, count) => sum + count, 0);
  const semanticVoice = {
    ...profile.semanticVoiceProfile,
    hedgeRatio: hedgeTotal + boostTotal > 0 ? hedgeTotal / (hedgeTotal + boostTotal) : 0.6,
    passiveVoiceRate: profile.wordCount ? profile.syntacticFingerprint.passiveVoiceEstimate * 100 : 3,
    firstPersonRate: profile.semanticVoiceProfile.firstPersonUsageFrequency * 100,
  };

  return { syntax, lexical, transitions, punctuation, semanticVoice, resolutionMeta };
}

function blendDomainProfiles(domainProfile: StyleDomainProfile, globalProfile: StyleDomainProfile, domainWeight: number, globalWeight: number): StyleDomainProfile {
  return {
    ...domainProfile,
    wordCount: blendNumber(domainProfile.wordCount, globalProfile.wordCount, domainWeight, globalWeight),
    sentenceCount: blendNumber(domainProfile.sentenceCount, globalProfile.sentenceCount, domainWeight, globalWeight),
    paragraphCount: blendNumber(domainProfile.paragraphCount, globalProfile.paragraphCount, domainWeight, globalWeight),
    syntacticFingerprint: blendObjects(domainProfile.syntacticFingerprint, globalProfile.syntacticFingerprint, domainWeight, globalWeight) as StyleDomainProfile["syntacticFingerprint"],
    lexicalLandscape: blendObjects(domainProfile.lexicalLandscape, globalProfile.lexicalLandscape, domainWeight, globalWeight) as StyleDomainProfile["lexicalLandscape"],
    transitionFingerprint: blendObjects(domainProfile.transitionFingerprint, globalProfile.transitionFingerprint, domainWeight, globalWeight) as StyleDomainProfile["transitionFingerprint"],
    punctuationHabits: blendObjects(domainProfile.punctuationHabits, globalProfile.punctuationHabits, domainWeight, globalWeight) as StyleDomainProfile["punctuationHabits"],
    semanticVoiceProfile: blendObjects(domainProfile.semanticVoiceProfile, globalProfile.semanticVoiceProfile, domainWeight, globalWeight) as StyleDomainProfile["semanticVoiceProfile"],
  };
}

function blendObjects(domainValue: unknown, globalValue: unknown, domainWeight: number, globalWeight: number): unknown {
  if (typeof domainValue === "number" && typeof globalValue === "number") {
    return blendNumber(domainValue, globalValue, domainWeight, globalWeight);
  }
  if (Array.isArray(domainValue) || Array.isArray(globalValue)) {
    return domainValue;
  }
  if (isRecord(domainValue) && isRecord(globalValue)) {
    const keys = new Set([...Object.keys(domainValue), ...Object.keys(globalValue)]);
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      result[key] = blendObjects(domainValue[key], globalValue[key], domainWeight, globalWeight);
    }
    return result;
  }
  return domainValue ?? globalValue;
}

function blendNumber(domainValue: number, globalValue: number, domainWeight: number, globalWeight: number): number {
  return Math.round((domainValue * domainWeight + globalValue * globalWeight) * 1000) / 1000;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
