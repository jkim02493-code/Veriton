import { buildStyleProfile } from "../../../../lib/style-profiler";
import type { StyleProfileInput } from "../../../../lib/style-profiler";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as StyleProfileInput;
    const result = buildStyleProfile({ samples: body.samples ?? [], userId: body.userId });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to build style profile.";
    return Response.json({ error: message, confidence: 0, warnings: [message] }, { status: 400 });
  }
}
