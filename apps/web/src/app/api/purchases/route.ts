import { NextResponse, type NextRequest } from "next/server";
import { loginDeps } from "@/server/deps";
import { isSameOrigin, SESSION_COOKIE } from "@/server/http";
import { getCurrentUser } from "@/server/login-service";
import { paymentsDeps } from "@/server/payments-deps";
import { startPurchase, type StartPurchaseOutcome } from "@/server/payments-service";
import { clientKeyFromHeaders, purchasesLimiter } from "@/server/rate-limit";

const STATUS: Record<Extract<StartPurchaseOutcome, { ok: false }>["error"], number> = {
  not_found: 404,
  not_available: 409,
  payment_failed: 502,
};

export async function POST(request: NextRequest) {
  const login = loginDeps();
  if (!isSameOrigin(request, login.env.APP_URL)) return NextResponse.json({ ok: false, error: "bad_origin" }, { status: 403 });
  if (!purchasesLimiter.allow(clientKeyFromHeaders(request.headers))) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  const user = await getCurrentUser(login, request.cookies.get(SESSION_COOKIE)?.value ?? null);
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const deps = paymentsDeps();
  if (!deps) return NextResponse.json({ ok: false, error: "payments_unavailable" }, { status: 503 });

  const body: unknown = await request.json().catch(() => null);
  const { product, targetId } = typeof body === "object" && body !== null ? (body as { product?: unknown; targetId?: unknown }) : {};
  const outcome = await startPurchase(deps, { userId: user.id, product, targetId });
  if (!outcome.ok) return NextResponse.json({ ok: false, error: outcome.error }, { status: STATUS[outcome.error] });
  return NextResponse.json(outcome);
}
