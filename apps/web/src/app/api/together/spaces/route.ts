import { NextResponse, type NextRequest } from "next/server";
import { createTogetherSpace } from "@/server/together-service";
import { togetherLimiter } from "@/server/rate-limit";
import { authorizeTogether, failure } from "@/server/together-route";

export async function POST(request: NextRequest) {
  const context = await authorizeTogether(request, { mutating: true, limiter: togetherLimiter });
  if (context instanceof NextResponse) return context;
  const outcome = await createTogetherSpace(context.deps, { userId: context.user.id });
  return outcome.ok ? NextResponse.json(outcome) : failure(outcome.error, 409);
}
