import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { restoreHandoff } from "@/server/handoff-service";
import { PENDING_COOKIE, pendingCookieOptions } from "@/server/http";

// Открыта в новом браузере: кладём посчитанный результат в его cookie и ведём ко входу
export async function GET(_request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const env = getEnv();
  const { code } = await params;
  const pendingToken = await restoreHandoff({ db: getDb(), secret: env.SESSION_SECRET, now: Date.now }, code);
  if (!pendingToken) return NextResponse.redirect(new URL("/login?error=handoff_expired", env.APP_URL), 303);
  const response = NextResponse.redirect(new URL("/login", env.APP_URL), 303);
  response.cookies.set(PENDING_COOKIE, pendingToken, pendingCookieOptions(env.APP_URL));
  return response;
}
