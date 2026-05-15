import { NextResponse } from "next/server";
import { runGenerationPipeline } from "../../../../lib/generation";
import type { GenerationInput } from "../../../../lib/generation";

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

  if (!isObject(body.plan) || body.plan.schemaVersion !== "2.0.0") {
    return validationError("Field 'plan' is required and must have schemaVersion '2.0.0'.");
  }

  if (!Array.isArray(body.plan.sections) || body.plan.sections.length === 0) {
    return validationError("Field 'plan.sections' must be a non-empty array.");
  }

  if (!isObject(body.profile) || body.profile.schemaVersion !== "1.1.0") {
    return validationError("Field 'profile' is required and must have schemaVersion '1.1.0'.");
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured." }, { status: 500 });
  }

  try {
    const result = await runGenerationPipeline(body as unknown as GenerationInput);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected generation failure.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
