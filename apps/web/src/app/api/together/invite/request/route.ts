import { NextResponse, type NextRequest } from "next/server";
import { togetherLimiter } from "@/server/rate-limit";
import { authorizeTogether, failure, readJsonObject } from "@/server/together-route";
import { requestTogetherJoin } from "@/server/together-service";

export async function POST(request: NextRequest) {
  const context = await authorizeTogether(request, { mutating: true, limiter: togetherLimiter });
  if (context instanceof NextResponse) return context;
  const { token } = await readJsonObject(request);
  const outcome = await requestTogetherJoin(context.deps, { token: typeof token === "string" ? token : "", userId: context.user.id });
  if (outcome.ok) return NextResponse.json(outcome);
  return failure(outcome.error, outcome.error === "invalid" ? 404 : 409);
}
