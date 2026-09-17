import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/server/env";
import { expiredCookieOptions, isSameOrigin, SESSION_COOKIE, sessionCookieOptions } from "@/server/http";

export async function POST(request: NextRequest) {
  const env = getEnv();
  if (!isSameOrigin(request, env.APP_URL)) return NextResponse.json({ ok: false, error: "bad_origin" }, { status: 403 });
  const response = NextResponse.redirect(new URL("/", env.APP_URL), 303);
  response.cookies.set(SESSION_COOKIE, "", expiredCookieOptions(sessionCookieOptions(env.APP_URL)));
  return response;
}
