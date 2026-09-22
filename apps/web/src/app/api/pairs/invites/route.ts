import { NextResponse, type NextRequest } from "next/server";
import { loginDeps } from "@/server/deps";
import { isSameOrigin, SESSION_COOKIE } from "@/server/http";
import { getCurrentUser } from "@/server/login-service";
import { createPairInviteForOwner } from "@/server/pairs-service";
import { clientKeyFromHeaders, invitesLimiter } from "@/server/rate-limit";

export async function POST(request: NextRequest) {
  const deps = loginDeps();
  if (!isSameOrigin(request, deps.env.APP_URL)) return NextResponse.json({ ok: false, error: "bad_origin" }, { status: 403 });
  if (!invitesLimiter.allow(clientKeyFromHeaders(request.headers))) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }
  const user = await getCurrentUser(deps, request.cookies.get(SESSION_COOKIE)?.value ?? null);
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const resultId = typeof body === "object" && body !== null ? (body as { resultId?: unknown }).resultId : null;
  const token = typeof resultId === "string" ? await createPairInviteForOwner(deps.db, { userId: user.id, resultId }) : null;
  if (!token) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, url: new URL(`/p/${token}`, deps.env.APP_URL).toString() });
}
