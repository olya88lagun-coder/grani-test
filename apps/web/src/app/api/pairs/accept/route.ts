import { NextResponse, type NextRequest } from "next/server";
import { loginDeps } from "@/server/deps";
import { expiredCookieOptions, isSameOrigin, PAIR_COOKIE, pairCookieOptions, SESSION_COOKIE } from "@/server/http";
import { getCurrentUser } from "@/server/login-service";
import { acceptPair, type AcceptPairOutcome } from "@/server/pairs-service";
import { enqueueNotify } from "@/server/queue";

const STATUS: Record<Extract<AcceptPairOutcome, { ok: false }>["error"], number> = {
  consent_required: 400,
  no_result: 400,
  not_found: 404,
  own_invite: 409,
  already_used: 409,
  already_paired: 409,
};

export async function POST(request: NextRequest) {
  const deps = loginDeps();
  if (!isSameOrigin(request, deps.env.APP_URL)) return NextResponse.json({ ok: false, error: "bad_origin" }, { status: 403 });
  const user = await getCurrentUser(deps, request.cookies.get(SESSION_COOKIE)?.value ?? null);
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const { token, consent } = typeof body === "object" && body !== null ? (body as { token?: unknown; consent?: unknown }) : {};

  const outcome = await acceptPair(
    { db: deps.db, now: deps.now, enqueueNotify },
    { token: typeof token === "string" ? token : "", userId: user.id, consent: consent === true },
  );
  if (!outcome.ok) return NextResponse.json({ ok: false, error: outcome.error }, { status: STATUS[outcome.error] });
  const response = NextResponse.json({ ok: true, redirect: `/pair/${outcome.pairId}` });
  response.cookies.set(PAIR_COOKIE, "", expiredCookieOptions(pairCookieOptions(deps.env.APP_URL)));
  return response;
}
