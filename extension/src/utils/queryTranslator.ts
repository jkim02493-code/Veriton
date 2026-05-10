const JAPANESE_TRANSLATIONS: Record<string, string> = {
  "\u7D4C\u6E08": "economics",
  "\u5E02\u5834": "market",
  "\u6295\u8CC7": "investment",
  "\u91D1\u878D": "finance",
  "\u682A\u5F0F": "stock",
  "\u64CD\u4F5C": "manipulation",
  "\u5FC3\u7406": "psychology",
  "\u898F\u5236": "regulation",
  "\u6280\u8853": "technology",
  "\u793E\u4F1A": "society",
  "\u653F\u7B56": "policy",
  "\u74B0\u5883": "environment",
  "\u6559\u80B2": "education",
  "\u7814\u7A76": "research",
  "\u5206\u6790": "analysis",
  "\u5F71\u97FF": "impact",
  "\u767A\u5C55": "development",
  "\u884C\u52D5": "behavior",
  "\u60C5\u5831": "information",
  "\u30B7\u30B9\u30C6\u30E0": "system",
};

const SPANISH_TRANSLATIONS: Record<string, string> = {
  "mercado": "market",
  "inversi\u00F3n": "investment",
  "econom\u00EDa": "economy",
  "manipulaci\u00F3n": "manipulation",
  "psicolog\u00EDa": "psychology",
  "regulaci\u00F3n": "regulation",
  "tecnolog\u00EDa": "technology",
  "sociedad": "society",
  "pol\u00EDtica": "policy",
  "ambiente": "environment",
  "educaci\u00F3n": "education",
  "investigaci\u00F3n": "research",
  "an\u00E1lisis": "analysis",
  "impacto": "impact",
  "desarrollo": "development",
  "comportamiento": "behavior",
  "informaci\u00F3n": "information",
  "sistema": "system",
  "finanzas": "finance",
  "acciones": "stocks",
};

const CHINESE_TRANSLATIONS: Record<string, string> = {
  "\u5E02\u573A": "market",
  "\u6295\u8D44": "investment",
  "\u7ECF\u6D4E": "economics",
  "\u91D1\u878D": "finance",
  "\u80A1\u7968": "stock",
  "\u64CD\u7EB5": "manipulation",
  "\u5FC3\u7406": "psychology",
  "\u76D1\u7BA1": "regulation",
  "\u6280\u672F": "technology",
  "\u793E\u4F1A": "society",
  "\u653F\u7B56": "policy",
  "\u73AF\u5883": "environment",
  "\u6559\u80B2": "education",
  "\u7814\u7A76": "research",
  "\u5206\u6790": "analysis",
  "\u5F71\u54CD": "impact",
  "\u53D1\u5C55": "development",
  "\u884C\u4E3A": "behavior",
  "\u4FE1\u606F": "information",
  "\u7CFB\u7EDF": "system",
};

function translationMapForLanguage(sourceLang: string): Record<string, string> {
  if (sourceLang === "ja") {
    return JAPANESE_TRANSLATIONS;
  }
  if (sourceLang === "es") {
    return SPANISH_TRANSLATIONS;
  }
  if (sourceLang === "zh") {
    return CHINESE_TRANSLATIONS;
  }
  return {};
}

function translateQuery(query: string, translations: Record<string, string>, sourceLang: string): string {
  if (sourceLang === "ja" || sourceLang === "zh") {
    let translated = query;
    for (const [source, target] of Object.entries(translations)) {
      translated = translated.split(source).join(` ${target} `);
    }
    return translated.replace(/\s+/g, " ").trim();
  }

  return query
    .split(/(\s+)/)
    .map((part) => translations[part.toLowerCase()] ?? part)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function translateQueriesToEnglish(queries: string[], sourceLang: string): string[] {
  if (sourceLang === "en" || sourceLang === "unknown") {
    return queries;
  }

  const translations = translationMapForLanguage(sourceLang);
  if (Object.keys(translations).length === 0) {
    return queries;
  }

  return queries.map((query) => translateQuery(query, translations, sourceLang) || query);
}
