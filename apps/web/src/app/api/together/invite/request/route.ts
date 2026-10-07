import { NextResponse, type NextRequest } from "next/server";
import { togetherLimiter } from "@/server/rate-limit";
import { requestJoinAdmitting } from "@/server/together-gate";
import { authorizeTogether, failure, readJsonObject } from "@/server/together-route";

export async function POST(request: NextRequest) {
  const context = await authorizeTogether(request, { mutating: true, limiter: togetherLimiter, entry: true });
  if (context instanceof NextResponse) return context;
  const { token, consent } = await readJsonObject(request);
  const outcome = await requestJoinAdmitting(context.gate, context.deps, { token: typeof token === "string" ? token : "", userId: context.user.id, consent });
  if (outcome.ok) return NextResponse.json(outcome);
  return failure(outcome.error, outcome.error === "invalid" ? 404 : outcome.error === "consent_required" ? 400 : 409);
}
