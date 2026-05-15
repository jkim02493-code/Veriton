import type { GeneratedSection } from "../generation";
import type { DefenceQuestion, KeyTerm, ReviewerNotesConfig } from "./types";

interface SummariserResponse {
  plainSummary?: unknown;
  keyTermDefinitions?: unknown;
  evidenceSummary?: unknown;
  defenceQuestions?: unknown;
}

type SectionSummaryResult = {
  plainSummary: string;
  filledKeyTerms: KeyTerm[];
  defenceQuestions: DefenceQuestion[];
  evidenceSummary: string;
};

const SYSTEM_PROMPT =
  "You are an academic study assistant. Explain essay sections in plain language so a student can understand and verbally defend their work. Be clear and concise. Never add information that is not in the original text.";

const READING_LEVEL_INSTRUCTIONS: Record<ReviewerNotesConfig["readingLevel"], string> = {
  simple: "Explain as if to a 14-year-old. Use short sentences and everyday words.",
  standard: "Explain clearly for a high school or early university student.",
  academic: "Explain for an advanced student. You may use academic terminology.",
};

function buildUserPrompt(
  section: GeneratedSection,
  keyTerms: KeyTerm[],
  config: ReviewerNotesConfig,
): string {
  const promptParts = [
    READING_LEVEL_INSTRUCTIONS[config.readingLevel],
    "",
    `Here is the essay section: ${section.generatedText}`,
    "",
    "Task A: Write a plain-language summary of this section in 3-5 sentences. Explain what the section argues and why it matters. Do not copy sentences from the original. Rephrase everything.",
  ];

  if (keyTerms.length > 0) {
    promptParts.push(
      "",
      "Task B: Define each of the following terms as they are used in this section. Write one plain-language definition per term, 1-2 sentences each.",
      keyTerms.map((term) => `- ${term.term}`).join("\n"),
    );
  }

  if (section.citationsUsed.length > 0) {
    promptParts.push(
      "",
      "Task C: In one sentence per citation, explain what each citation contributes to the argument.",
      section.citationsUsed.map((citation) => `- ${citation}`).join("\n"),
    );
  }

  if (config.includeDefenceQuestions) {
    promptParts.push(
      "",
      "Task D: Write 2 likely examiner questions about this section with 2-3 sentence model answers each.",
    );
  }

  promptParts.push(
    "",
    "Respond only in this JSON format with no preamble or markdown fences:",
    "{",
    "  'plainSummary': '...',",
    "  'keyTermDefinitions': { 'term': 'definition' },",
    "  'evidenceSummary': '...',",
    "  'defenceQuestions': [{ 'question': '...', 'suggestedAnswer': '...' }]",
    "}",
  );

  return promptParts.join("\n");
}

function stripMarkdownFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDefenceQuestion(value: unknown): value is DefenceQuestion {
  return (
    isRecord(value) &&
    typeof value.question === "string" &&
    typeof value.suggestedAnswer === "string"
  );
}

function parseSummariserJson(rawText: string): SummariserResponse {
  return JSON.parse(stripMarkdownFences(rawText)) as SummariserResponse;
}

function fillKeyTermDefinitions(keyTerms: KeyTerm[], definitions: unknown): KeyTerm[] {
  const definitionMap = isRecord(definitions) ? definitions : {};

  return keyTerms.map((term) => ({
    term: term.term,
    definition: typeof definitionMap[term.term] === "string" ? definitionMap[term.term] : "",
  }));
}

function parseDefenceQuestions(value: unknown): DefenceQuestion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isDefenceQuestion);
}

interface AnthropicTextBlock {
  type: "text";
  text: string;
}

interface AnthropicResponse {
  content?: AnthropicTextBlock[];
}

function isAnthropicTextBlock(value: unknown): value is AnthropicTextBlock {
  return (
    isRecord(value) &&
    value.type === "text" &&
    typeof value.text === "string"
  );
}

function extractTextFromResponse(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.content)) {
    return "";
  }

  const textBlock = value.content.find(isAnthropicTextBlock);

  return textBlock?.text ?? "";
}

export async function summariseSection(
  section: GeneratedSection,
  keyTerms: KeyTerm[],
  config: ReviewerNotesConfig,
): Promise<SectionSummaryResult> {
  const userPrompt = buildUserPrompt(section, keyTerms, config);
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokensPerSection,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Reviewer notes summarisation failed with ${response.status}: ${await response.text()}`);
  }

  const payload = (await response.json()) as AnthropicResponse;
  const rawText = extractTextFromResponse(payload);

  try {
    const parsed = parseSummariserJson(rawText);

    return {
      plainSummary: typeof parsed.plainSummary === "string" ? parsed.plainSummary : "",
      filledKeyTerms: fillKeyTermDefinitions(keyTerms, parsed.keyTermDefinitions),
      defenceQuestions: parseDefenceQuestions(parsed.defenceQuestions),
      evidenceSummary: typeof parsed.evidenceSummary === "string" ? parsed.evidenceSummary : "",
    };
  } catch {
    return {
      plainSummary: rawText,
      filledKeyTerms: [],
      defenceQuestions: [],
      evidenceSummary: "",
    };
  }
}
