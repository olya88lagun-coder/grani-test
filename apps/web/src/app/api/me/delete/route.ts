import { NextResponse, type NextRequest } from "next/server";
import { deleteAccount } from "@/server/account-service";
import { loginDeps } from "@/server/deps";
import { expiredCookieOptions, isSameOrigin, SESSION_COOKIE, sessionCookieOptions } from "@/server/http";

export async function POST(request: NextRequest) {
  const deps = loginDeps();
  if (!isSameOrigin(request, deps.env.APP_URL)) return NextResponse.json({ ok: false, error: "bad_origin" }, { status: 403 });
  const outcome = await deleteAccount(deps, { sessionToken: request.cookies.get(SESSION_COOKIE)?.value ?? null });
  if (!outcome.ok) return NextResponse.json(outcome, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", expiredCookieOptions(sessionCookieOptions(deps.env.APP_URL)));
  return response;
}
