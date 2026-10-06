import { NextResponse, type NextRequest } from "next/server";
import { paymentsDeps } from "@/server/payments-deps";
import { getTogetherPurchaseStatus } from "@/server/together-payments";
import { authorizeTogether, failure } from "@/server/together-route";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await authorizeTogether(request, { mutating: false });
  if (context instanceof NextResponse) return context;
  const deps = paymentsDeps();
  const { id } = await params;
  const view = deps ? await getTogetherPurchaseStatus(deps, { purchaseId: id, userId: context.user.id }) : null;
  if (!view) return failure("not_found", 404);
  return NextResponse.json({ ok: true, ...view }, { headers: { "cache-control": "no-store" } });
}
