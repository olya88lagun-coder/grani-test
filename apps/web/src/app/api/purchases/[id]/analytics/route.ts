import { NextResponse, type NextRequest } from "next/server";
import { metrikaCounterId, METRIKA_ID } from "@/lib/analytics";
import { SITE_URL } from "@/lib/site";
import { loginDeps } from "@/server/deps";
import { SESSION_COOKIE } from "@/server/http";
import { getCurrentUser } from "@/server/login-service";
import { paymentsDeps } from "@/server/payments-deps";
import { readPurchaseAnalytics } from "@/server/purchase-analytics";
import { purchaseAnalyticsLimiter } from "@/server/rate-limit";

const PRIVATE_HEADERS = { "cache-control": "private, no-store" };

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(loginDeps(), request.cookies.get(SESSION_COOKIE)?.value ?? null);
  if (!user) return NextResponse.json({ ok: false }, { status: 401, headers: PRIVATE_HEADERS });
  if (!purchaseAnalyticsLimiter.allow(user.id)) return NextResponse.json({ ok: false }, { status: 429, headers: PRIVATE_HEADERS });
  const deps = paymentsDeps();
  if (!deps) return NextResponse.json({ ok: false }, { status: 503, headers: PRIVATE_HEADERS });
  const { id } = await params;
  try {
    const origin = new URL(deps.appUrl).origin;
    const counter = metrikaCounterId(origin);
    if (!counter) return NextResponse.json({ ok: true, purchase: null }, { headers: PRIVATE_HEADERS });
    const result = await readPurchaseAnalytics(deps, { purchaseId: id, userId: user.id }, {
      sandbox: counter !== METRIKA_ID,
      together: origin === SITE_URL && process.env.METRIKA_TOGETHER_PURCHASES === "1",
    });
    if (!result.found) return NextResponse.json({ ok: false }, { status: 404, headers: PRIVATE_HEADERS });
    return NextResponse.json({ ok: true, purchase: result.purchase }, { headers: PRIVATE_HEADERS });
  } catch {
    // Ошибка аналитики не меняет оплату и не мешает открытию уже купленного отчёта.
    return NextResponse.json({ ok: false }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
