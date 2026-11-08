import { NextResponse, type NextRequest } from "next/server";
import { loginDeps } from "@/server/deps";
import { isSameOrigin, SESSION_COOKIE } from "@/server/http";
import { getCurrentUser } from "@/server/login-service";
import { clientKeyFromHeaders, invitesLimiter } from "@/server/rate-limit";
import { createShortPairInviteForOwner } from "@/server/short-pairs-service";

// Ссылка для партнёра по своему сохранённому результату короткого теста
export async function POST(request: NextRequest) {
  const deps = loginDeps();
  if (!isSameOrigin(request, deps.env.APP_URL)) return NextResponse.json({ ok: false, error: "bad_origin" }, { status: 403 });
  if (!invitesLimiter.allow(clientKeyFromHeaders(request.headers))) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  const user = await getCurrentUser(deps, request.cookies.get(SESSION_COOKIE)?.value ?? null);
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const shortResultId = typeof body === "object" && body !== null ? (body as { shortResultId?: unknown }).shortResultId : null;
  const token = typeof shortResultId === "string" ? await createShortPairInviteForOwner(deps.db, { userId: user.id, shortResultId }) : null;
  if (!token) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, url: new URL(`/sp/${token}`, deps.env.APP_URL).toString() });
}
