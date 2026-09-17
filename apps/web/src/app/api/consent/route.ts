import { NextResponse, type NextRequest } from "next/server";
import { loginDeps } from "@/server/deps";
import { CONSENT_COOKIE, consentCookieOptions, isSameOrigin } from "@/server/http";
import { giveConsent } from "@/server/login-service";

export async function POST(request: NextRequest) {
  const deps = loginDeps();
  if (!isSameOrigin(request, deps.env.APP_URL)) return NextResponse.json({ ok: false, error: "bad_origin" }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(CONSENT_COOKIE, await giveConsent(deps), consentCookieOptions(deps.env.APP_URL));
  return response;
}
