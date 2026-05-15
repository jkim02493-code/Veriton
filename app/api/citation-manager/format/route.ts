import { NextResponse } from "next/server";
import { buildWorksCited, formatCitations } from "../../../../lib/citation-manager";
import type { CitationFormat, FormatCitationInput, FormatCitationResult } from "../../../../lib/citation-manager";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCitationFormat(value: unknown): value is CitationFormat {
  return value === "mla" || value === "apa";
}

function validationError(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return validationError("Request body must be valid JSON.");
  }

  if (!isObject(body)) {
    return validationError("Request body must be a JSON object.");
  }

  if (!Array.isArray(body.nodes) || body.nodes.length === 0) {
    return validationError("Field 'nodes' must be a non-empty array.");
  }

  if (!isCitationFormat(body.format)) {
    return validationError("Field 'format' must be either 'mla' or 'apa'.");
  }

  const input = body as unknown as FormatCitationInput;
  const citations = formatCitations(input.nodes, input.format);
  const result: FormatCitationResult = {
    citations,
    worksCited: buildWorksCited(citations, input.format),
  };

  return NextResponse.json(result, { status: 200 });
}
