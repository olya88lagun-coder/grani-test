import { NextResponse, type NextRequest } from "next/server";
import { togetherLimiter } from "@/server/rate-limit";
import { authorizeTogether, failure } from "@/server/together-route";
import { getTogetherShareUrl } from "@/server/together-service";

// Ссылка для друзей: только у активной пары. Код один на пару и не меняется
export async function POST(request: NextRequest) {
  const context = await authorizeTogether(request, { mutating: true, limiter: togetherLimiter });
  if (context instanceof NextResponse) return context;
  const outcome = await getTogetherShareUrl(context.deps, { userId: context.user.id });
  return outcome.ok ? NextResponse.json(outcome, { headers: { "cache-control": "no-store" } }) : failure(outcome.error, 404);
}
