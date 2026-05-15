import { NextResponse } from "next/server";
import { generateReviewerNotes } from "../../../../lib/reviewer-notes";
import type { ReviewerNotesInput } from "../../../../lib/reviewer-notes";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

  if (!isObject(body.draft) || body.draft.schemaVersion !== "3.0.0") {
    return validationError("Field 'draft' is required and must have schemaVersion '3.0.0'.");
  }

  if (!Array.isArray(body.draft.sections) || body.draft.sections.length === 0) {
    return validationError("Field 'draft.sections' must be a non-empty array.");
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured." }, { status: 500 });
  }

  try {
    const result = await generateReviewerNotes(body as unknown as ReviewerNotesInput);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected reviewer notes failure.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
