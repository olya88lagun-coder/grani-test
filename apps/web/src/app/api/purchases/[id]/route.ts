import { NextResponse, type NextRequest } from "next/server";
import { loginDeps } from "@/server/deps";
import { SESSION_COOKIE } from "@/server/http";
import { getCurrentUser } from "@/server/login-service";
import { paymentsDeps } from "@/server/payments-deps";
import { getPurchaseView } from "@/server/payments-service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const login = loginDeps();
  const user = await getCurrentUser(login, request.cookies.get(SESSION_COOKIE)?.value ?? null);
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const deps = paymentsDeps();
  const { id } = await params;
  const view = deps ? await getPurchaseView(deps, { purchaseId: id, userId: user.id }) : null;
  if (!view) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, ...view }, { headers: { "cache-control": "no-store" } });
}
