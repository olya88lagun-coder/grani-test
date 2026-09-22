import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/server/env";
import { isYooKassaIp, requestIp } from "@/server/payments/ip";
import { paymentsDeps } from "@/server/payments-deps";
import { syncPayment } from "@/server/payments-service";

// Origin здесь не проверяется: запрос приходит с серверов ЮKassa. Подлинность — IP и повторный запрос статуса
export async function POST(request: NextRequest) {
  if (getEnv().payments?.kind !== "yookassa") return new NextResponse(null, { status: 404 });
  if (!isYooKassaIp(requestIp(request.headers))) return new NextResponse(null, { status: 403 });
  const deps = paymentsDeps();
  if (!deps) return new NextResponse(null, { status: 404 });

  const body: unknown = await request.json().catch(() => null);
  const paymentId = typeof body === "object" && body !== null ? (body as { object?: { id?: unknown } }).object?.id : undefined;
  // Неизвестный формат или платёж — отвечаем 200: повтор ничего не изменит
  if (typeof paymentId !== "string") return new NextResponse(null, { status: 200 });
  try {
    await syncPayment(deps, paymentId);
  } catch (error) {
    console.error("payment notification failed", { paymentId, error: String(error) });
    return new NextResponse(null, { status: 500 });
  }
  return new NextResponse(null, { status: 200 });
}
