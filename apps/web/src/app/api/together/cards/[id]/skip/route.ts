import { NextResponse, type NextRequest } from "next/server";
import { togetherLimiter } from "@/server/rate-limit";
import { authorizeTogether, cardErrorStatus, failure } from "@/server/together-route";
import { skipTogetherCard } from "@/server/together-cards-service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await authorizeTogether(request, { mutating: true, limiter: togetherLimiter });
  if (context instanceof NextResponse) return context;
  const { id } = await params;
  const outcome = await skipTogetherCard(context.deps, { userId: context.user.id, cardId: id });
  return outcome.ok ? NextResponse.json(outcome) : failure(outcome.error, cardErrorStatus(outcome.error));
}
