import { NextResponse } from "next/server";
import { runLiveDrafting } from "../../../../lib/live-drafting";
import type { LiveDraftingInput } from "../../../../lib/live-drafting";

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

  if (!isObject(body.config)) {
    return validationError("Field 'config' is required.");
  }

  if (typeof body.config.documentId !== "string" || body.config.documentId.trim().length === 0) {
    return validationError("Field 'config.documentId' must be a non-empty string.");
  }

  if (typeof body.config.accessToken !== "string" || body.config.accessToken.trim().length === 0) {
    return validationError("Field 'config.accessToken' must be a non-empty string.");
  }

  try {
    // Development-only synchronous playback. In production, move this to a background job or streaming response.
    const result = await runLiveDrafting(body as unknown as LiveDraftingInput);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected live drafting failure.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
