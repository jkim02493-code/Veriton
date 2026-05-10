const JAPANESE_TRANSLATIONS: Record<string, string> = {
  "経済": "economics",
  "市場": "market",
  "投資": "investment",
  "金融": "finance",
  "株式": "stock",
  "操作": "manipulation",
  "心理": "psychology",
  "規制": "regulation",
  "技術": "technology",
  "社会": "society",
  "政策": "policy",
  "環境": "environment",
  "教育": "education",
  "研究": "research",
  "分析": "analysis",
  "影響": "impact",
  "発展": "development",
  "行動": "behavior",
  "情報": "information",
  "システム": "system",
};

const SPANISH_TRANSLATIONS: Record<string, string> = {
  "mercado": "market",
  "inversión": "investment",
  "economía": "economy",
  "manipulación": "manipulation",
  "psicología": "psychology",
  "regulación": "regulation",
  "tecnología": "technology",
  "sociedad": "society",
  "política": "policy",
  "ambiente": "environment",
  "educación": "education",
  "investigación": "research",
  "análisis": "analysis",
  "impacto": "impact",
  "desarrollo": "development",
  "comportamiento": "behavior",
  "información": "information",
  "sistema": "system",
  "finanzas": "finance",
  "acciones": "stocks",
};

const CHINESE_TRANSLATIONS: Record<string, string> = {
  "市场": "market",
  "投资": "investment",
  "经济": "economics",
  "金融": "finance",
  "股票": "stock",
  "操纵": "manipulation",
  "心理": "psychology",
  "监管": "regulation",
  "技术": "technology",
  "社会": "society",
  "政策": "policy",
  "环境": "environment",
  "教育": "education",
  "研究": "research",
  "分析": "analysis",
  "影响": "impact",
  "发展": "development",
  "行为": "behavior",
  "信息": "information",
  "系统": "system",
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

export function translateQueriesToEnglish(queries: string[], sourceLang: string): string[] {
  if (sourceLang === "en" || sourceLang === "unknown") {
    return queries;
  }

  const translations = translationMapForLanguage(sourceLang);
  if (Object.keys(translations).length === 0) {
    return queries;
  }

  return queries.map((query) => translateQuery(query, translations, sourceLang) || query);
}
