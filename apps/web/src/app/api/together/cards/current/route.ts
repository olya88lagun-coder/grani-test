import { NextResponse, type NextRequest } from "next/server";
import { authorizeTogether, cardErrorStatus, failure } from "@/server/together-route";
import { getCurrentTogetherCard } from "@/server/together-cards-service";

export async function GET(request: NextRequest) {
  const context = await authorizeTogether(request, { mutating: false });
  if (context instanceof NextResponse) return context;
  const outcome = await getCurrentTogetherCard(context.deps, context.user.id);
  if (!outcome.ok) return failure(outcome.error, cardErrorStatus(outcome.error));
  return NextResponse.json({ ok: true, card: outcome.card, progress: outcome.progress }, { headers: { "cache-control": "no-store" } });
}
