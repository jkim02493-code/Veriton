import { buildStyleProfile, type WritingSample } from "../lib/style-profiler";

const samples: WritingSample[] = [
  {
    id: "sample_1",
    title: "History Essay",
    domain: "history",
    text: `The rise of industrial warfare changed the relationship between governments and civilians. Although military leaders often described the conflict as a matter of strategy, the war also depended on factories, railroads, and public morale. This suggests that modern conflict cannot be understood only through battles. It must also be studied through the social systems that made those battles possible.

However, the public did not simply accept these pressures. Workers, families, and local officials negotiated the meaning of sacrifice in different ways. As a result, the state became more powerful, but it also became more dependent on ordinary people.`,
  },
  {
    id: "sample_2",
    title: "Literary Analysis",
    domain: "literaryAnalysis",
    text: `In the novel, the narrator's uncertainty reveals a larger conflict between memory and identity. The repeated image of the locked room might suggest that the character is afraid of confronting the past. Furthermore, the quiet setting makes the emotional tension feel more controlled and more painful.

This does not prove that the character is dishonest. Instead, it demonstrates how the text uses hesitation as a form of self-protection. In light of this, the ending feels balanced rather than final.`,
  },
  {
    id: "sample_3",
    title: "Science Reflection",
    domain: "scientific",
    text: `The experiment shows that small changes in method can strongly affect the result. Because the sample size was limited, the conclusion should be treated carefully. The data may indicate a useful pattern, but it does not clearly prove a universal rule.

Therefore, future research should compare the same variable across multiple groups. This approach would make the analysis more reliable and would reduce the chance that one unusual sample controls the interpretation.`,
  },
];

const result = buildStyleProfile({ samples });
const global = result.profile.globalProfile;

console.log("confidence score:", result.confidence);
console.log("average sentence length:", global.syntacticFingerprint.averageSentenceLength);
console.log("burstiness score:", global.syntacticFingerprint.burstinessScore);
console.log("top vocabulary terms:", Object.keys(global.lexicalLandscape.vocabularyFrequencyMap).slice(0, 10));
console.log("common transitions:", global.transitionFingerprint.commonTransitions);
console.log("punctuation density:", {
  comma: global.punctuationHabits.commaDensity,
  semicolon: global.punctuationHabits.semicolonDensity,
  colon: global.punctuationHabits.colonDensity,
  dash: global.punctuationHabits.dashDensity,
});
console.log("hedge-to-boost ratio:", global.semanticVoiceProfile.hedgeToBoostRatio);
console.log("detected domain profile keys:", Object.keys(result.profile.domainProfiles));
console.log("warnings:", result.warnings);
