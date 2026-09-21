import { isInviteToken } from "@grani/db";
import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/server/env";
import { PAIR_COOKIE, pairCookieOptions } from "@/server/http";

const NEXT_PATHS: Readonly<Record<string, string>> = { test: "/test", login: "/login" };

export async function GET(request: NextRequest) {
  const env = getEnv();
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const next = NEXT_PATHS[request.nextUrl.searchParams.get("next") ?? ""];
  if (!isInviteToken(token) || !next) {
    return NextResponse.redirect(new URL(`/p/${encodeURIComponent(token)}`, env.APP_URL), 303);
  }
  const response = NextResponse.redirect(new URL(next, env.APP_URL), 303);
  response.cookies.set(PAIR_COOKIE, token, pairCookieOptions(env.APP_URL));
  return response;
}
