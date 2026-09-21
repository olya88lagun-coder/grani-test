import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { isSameOrigin, PAIR_COOKIE, PENDING_COOKIE, pendingCookieOptions, SESSION_COOKIE } from "@/server/http";
import { pairReturnPath } from "@/server/pairs-service";
import { clientKeyFromHeaders, resultsLimiter } from "@/server/rate-limit";
import { submitAnswers } from "@/server/results-service";

export async function POST(request: NextRequest) {
  const env = getEnv();
  if (!isSameOrigin(request, env.APP_URL)) return NextResponse.json({ ok: false, error: "bad_origin" }, { status: 403 });
  if (!resultsLimiter.allow(clientKeyFromHeaders(request.headers))) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }
  const body: unknown = await request.json().catch(() => null);
  const answers = typeof body === "object" && body !== null ? (body as { answers?: unknown }).answers : null;
  const outcome = await submitAnswers(
    { db: getDb(), secret: env.SESSION_SECRET },
    answers,
    request.cookies.get(SESSION_COOKIE)?.value ?? null,
  );
  if (outcome.kind === "invalid") return NextResponse.json({ ok: false, error: "invalid_answers" }, { status: 400 });
  if (outcome.kind === "saved") {
    const redirect = pairReturnPath(request.cookies.get(PAIR_COOKIE)?.value) ?? `/result/${outcome.resultId}`;
    return NextResponse.json({ ok: true, redirect });
  }
  const response = NextResponse.json({ ok: true, redirect: "/login" });
  response.cookies.set(PENDING_COOKIE, outcome.pendingToken, pendingCookieOptions(env.APP_URL));
  return response;
}
