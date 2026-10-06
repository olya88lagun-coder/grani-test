import { NextResponse, type NextRequest } from "next/server";
import { togetherLimiter } from "@/server/rate-limit";
import { authorizeTogether, failure, readJsonObject } from "@/server/together-route";
import { leaveTogether } from "@/server/together-service";

export async function POST(request: NextRequest) {
  const context = await authorizeTogether(request, { mutating: true, limiter: togetherLimiter });
  if (context instanceof NextResponse) return context;
  const { acknowledged } = await readJsonObject(request);
  const outcome = await leaveTogether(context.deps, { userId: context.user.id, acknowledged });
  if (outcome.ok) return NextResponse.json(outcome);
  return failure(outcome.error, outcome.error === "not_found" ? 404 : 400);
}
