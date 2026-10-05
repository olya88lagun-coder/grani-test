import { listClosedWithRemaining, listPaidWithoutAccess } from "@grani/db";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/server/db";
import { loginDeps } from "@/server/deps";
import { SESSION_COOKIE } from "@/server/http";
import { getCurrentUser } from "@/server/login-service";
import { isOwnerUser } from "@/server/owner";

// Что требует ручного решения владелицы: оплачено без доступа и закрытые пространства с остатком оплаченного срока
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(loginDeps(), request.cookies.get(SESSION_COOKIE)?.value ?? null);
  if (!user || !(await isOwnerUser(user))) return new NextResponse(null, { status: 404 });
  const db = getDb();
  const [paidWithoutAccess, closedWithRemaining] = await Promise.all([listPaidWithoutAccess(db), listClosedWithRemaining(db)]);
  return NextResponse.json({ ok: true, paidWithoutAccess, closedWithRemaining }, { headers: { "cache-control": "no-store" } });
}
