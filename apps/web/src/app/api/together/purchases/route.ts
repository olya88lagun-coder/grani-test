import { NextResponse, type NextRequest } from "next/server";
import { paymentsDeps } from "@/server/payments-deps";
import { purchasesLimiter } from "@/server/rate-limit";
import { startTogetherPurchase, type StartTogetherOutcome } from "@/server/together-payments";
import { authorizeTogether, failure, readJsonObject } from "@/server/together-route";

const STATUS: Record<Extract<StartTogetherOutcome, { ok: false }>["error"], number> = {
  invalid_email: 400,
  not_found: 404,
  not_available: 409,
  payment_failed: 502,
};

export async function POST(request: NextRequest) {
  const context = await authorizeTogether(request, { mutating: true, limiter: purchasesLimiter });
  if (context instanceof NextResponse) return context;
  const deps = paymentsDeps();
  if (!deps) return failure("payments_unavailable", 503);
  const { email } = await readJsonObject(request);
  const outcome = await startTogetherPurchase(deps, { userId: context.user.id, email });
  return outcome.ok ? NextResponse.json(outcome) : failure(outcome.error, STATUS[outcome.error]);
}
