import { NextResponse, type NextRequest } from "next/server";
import type { AppEnv } from "./env";
import {
  CONSENT_COOKIE,
  consentCookieOptions,
  expiredCookieOptions,
  PENDING_COOKIE,
  pendingCookieOptions,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "./http";
import type { LoginCookies, LoginOutcome } from "./login-service";

export function readLoginCookies(request: NextRequest): LoginCookies {
  return {
    session: request.cookies.get(SESSION_COOKIE)?.value ?? null,
    pending: request.cookies.get(PENDING_COOKIE)?.value ?? null,
    consent: request.cookies.get(CONSENT_COOKIE)?.value ?? null,
  };
}

export function loginResponse(env: AppEnv, outcome: LoginOutcome): NextResponse {
  if (!outcome.ok) {
    console.warn("login failed", outcome.error);
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(outcome.error)}`, env.APP_URL), 303);
  }
  const response = NextResponse.redirect(new URL(outcome.redirectTo, env.APP_URL), 303);
  response.cookies.set(SESSION_COOKIE, outcome.sessionToken, sessionCookieOptions(env.APP_URL));
  response.cookies.set(PENDING_COOKIE, "", expiredCookieOptions(pendingCookieOptions(env.APP_URL)));
  response.cookies.set(CONSENT_COOKIE, "", expiredCookieOptions(consentCookieOptions(env.APP_URL)));
  return response;
}
