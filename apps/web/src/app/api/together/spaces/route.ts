import { NextResponse, type NextRequest } from "next/server";
import { expiredCookieOptions, TOGETHER_FROM_COOKIE, togetherFromCookieOptions } from "@/server/http";
import { togetherLimiter } from "@/server/rate-limit";
import { authorizeTogether, failure, pickReferralCode, readJsonObject } from "@/server/together-route";
import { createTogetherSpace } from "@/server/together-service";

export async function POST(request: NextRequest) {
  const context = await authorizeTogether(request, { mutating: true, limiter: togetherLimiter });
  if (context instanceof NextResponse) return context;
  const { consent, from } = await readJsonObject(request);
  const referredByCode = pickReferralCode(from, request.cookies.get(TOGETHER_FROM_COOKIE)?.value);
  const outcome = await createTogetherSpace(context.deps, { userId: context.user.id, referredByCode, consent });
  const response = outcome.ok ? NextResponse.json(outcome) : failure(outcome.error, outcome.error === "consent_required" ? 400 : 409);
  // Код нужен один раз: после создания пространства он больше не нужен. При отказе (например, без согласия) остаётся для повтора
  if (outcome.ok && request.cookies.has(TOGETHER_FROM_COOKIE)) response.cookies.set(TOGETHER_FROM_COOKIE, "", expiredCookieOptions(togetherFromCookieOptions(context.deps.appUrl)));
  return response;
}
