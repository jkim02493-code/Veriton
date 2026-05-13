import { generateEssayPlan, type EssayPlannerInput, type EssayType } from "../../../../lib/essay-planner";

const ESSAY_TYPES: EssayType[] = ["argumentative", "expository", "analytical", "compareContrast", "personalStatement"];

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as Partial<EssayPlannerInput>;
    const validationError = validateInput(body);
    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 });
    }
    return Response.json(generateEssayPlan(body as EssayPlannerInput));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate essay plan.";
    return Response.json({ error: message }, { status: 400 });
  }
}

function validateInput(body: Partial<EssayPlannerInput>): string | null {
  if (!Array.isArray(body.evidence)) {
    return "evidence must be an array.";
  }
  if (!body.essayType || !ESSAY_TYPES.includes(body.essayType)) {
    return "essayType must be one of argumentative, expository, analytical, compareContrast, or personalStatement.";
  }
  if (typeof body.targetWordCount !== "number" || body.targetWordCount < 200 || body.targetWordCount > 10000) {
    return "targetWordCount must be between 200 and 10000.";
  }
  if (!body.profile) {
    return "profile is required.";
  }
  return null;
}
