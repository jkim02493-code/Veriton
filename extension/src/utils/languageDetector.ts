export type SupportedLanguage = "en" | "ja" | "es" | "zh" | "unknown";

export function detectLanguage(text: string): SupportedLanguage {
  const hiraganaMatches = text.match(/[\u3040-\u309F]/g) ?? [];
  const katakanaMatches = text.match(/[\u30A0-\u30FF]/g) ?? [];
  const cjkMatches = text.match(/[\u4E00-\u9FAF]/g) ?? [];
  const kanaCount = hiraganaMatches.length + katakanaMatches.length;
  const japaneseCharacterCount = kanaCount + cjkMatches.length;

  if (kanaCount > 0 && japaneseCharacterCount > 5) {
    return "ja";
  }

  if (cjkMatches.length > 5 && kanaCount === 0) {
    return "zh";
  }

  if (japaneseCharacterCount > 5) {
    return "ja";
  }

  const spanishMarkerMatches = text.match(/[áéíóúñü¿¡]/gi) ?? [];
  const spanishWords = new Set(["para", "este", "como", "pero", "también", "porque", "cuando", "tiene", "están", "según"]);
  const normalizedWords = text.toLowerCase().match(/\b[\p{L}]+\b/gu) ?? [];
  const spanishWordCount = normalizedWords.filter((word) => spanishWords.has(word)).length;

  if (spanishMarkerMatches.length >= 3 || spanishWordCount >= 2) {
    return "es";
  }

  return "en";
}
