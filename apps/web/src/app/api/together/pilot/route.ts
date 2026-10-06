import { NextResponse, type NextRequest } from "next/server";
import { pilotCodeLimiter } from "@/server/rate-limit";
import { redeemPilotCode } from "@/server/together-gate";
import { authorizeTogether, failure, pilotErrorStatus, readJsonObject } from "@/server/together-route";

// Ввод общего кода закрытого пилота: человек входит в «Вдвоём» без приглашения. Без пропуска этот маршрут — единственный, что ему доступен
export async function POST(request: NextRequest) {
  const context = await authorizeTogether(request, { mutating: true, limiter: pilotCodeLimiter, entry: true });
  if (context instanceof NextResponse) return context;
  // Кроме лимита по адресу, подбор ограничен и по человеку: с разных адресов под одним аккаунтом код не перебрать
  if (!pilotCodeLimiter.allow(`user:${context.user.id}`)) return failure("rate_limited", 429);
  const { code } = await readJsonObject(request);
  const outcome = await redeemPilotCode(context.gate, { userId: context.user.id, code: typeof code === "string" ? code : "" });
  if (outcome.ok) return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  return failure(outcome.error, pilotErrorStatus(outcome.error));
}
