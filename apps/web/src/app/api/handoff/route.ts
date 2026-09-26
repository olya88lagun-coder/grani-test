import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { createHandoff } from "@/server/handoff-service";
import { isSameOrigin, PENDING_COOKIE } from "@/server/http";
import { clientKeyFromHeaders, handoffLimiter } from "@/server/rate-limit";

// Ссылка, по которой посчитанный результат откроется в другом браузере
export async function POST(request: NextRequest) {
  const env = getEnv();
  if (!isSameOrigin(request, env.APP_URL)) return NextResponse.json({ ok: false, error: "bad_origin" }, { status: 403 });
  if (!handoffLimiter.allow(clientKeyFromHeaders(request.headers))) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }
  const created = await createHandoff({ db: getDb(), secret: env.SESSION_SECRET, now: Date.now }, request.cookies.get(PENDING_COOKIE)?.value ?? null);
  if (!created) return NextResponse.json({ ok: false, error: "no_pending" }, { status: 404 });
  return NextResponse.json({ ok: true, url: new URL(`/continue/${created.code}`, env.APP_URL).toString() });
}
