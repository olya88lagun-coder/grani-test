import { NextResponse, type NextRequest } from "next/server";
import { expiredCookieOptions, TOGETHER_FROM_COOKIE, togetherFromCookieOptions } from "@/server/http";
import { togetherLimiter } from "@/server/rate-limit";
import { authorizeTogether, failure, readJsonObject } from "@/server/together-route";
import { createTogetherSpace } from "@/server/together-service";

export async function POST(request: NextRequest) {
  const context = await authorizeTogether(request, { mutating: true, limiter: togetherLimiter });
  if (context instanceof NextResponse) return context;
  const referredByCode = request.cookies.get(TOGETHER_FROM_COOKIE)?.value;
  const { consent } = await readJsonObject(request);
  const outcome = await createTogetherSpace(context.deps, { userId: context.user.id, referredByCode, consent });
  const response = outcome.ok ? NextResponse.json(outcome) : failure(outcome.error, outcome.error === "consent_required" ? 400 : 409);
  // Код нужен один раз: после создания пространства (или отказа) он больше не нужен
  if (referredByCode !== undefined) response.cookies.set(TOGETHER_FROM_COOKIE, "", expiredCookieOptions(togetherFromCookieOptions(context.deps.appUrl)));
  return response;
}
