import { NextResponse, type NextRequest } from "next/server";
import { togetherLimiter } from "@/server/rate-limit";
import { authorizeTogether, failure, readJsonObject } from "@/server/together-route";
import { respondTogetherRequest } from "@/server/together-service";

const STATUS = { invalid: 400, not_found: 404, no_request: 409, requester_unavailable: 409 } as const;

export async function POST(request: NextRequest) {
  const context = await authorizeTogether(request, { mutating: true, limiter: togetherLimiter });
  if (context instanceof NextResponse) return context;
  const { accept } = await readJsonObject(request);
  const outcome = await respondTogetherRequest(context.deps, { userId: context.user.id, accept });
  return outcome.ok ? NextResponse.json(outcome) : failure(outcome.error, STATUS[outcome.error]);
}
