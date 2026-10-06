import { NextResponse, type NextRequest } from "next/server";
import { togetherLimiter } from "@/server/rate-limit";
import { authorizeTogether, cardErrorStatus, failure, readJsonObject } from "@/server/together-route";
import { answerTogetherCard, deleteTogetherDraft } from "@/server/together-cards-service";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await authorizeTogether(request, { mutating: true, limiter: togetherLimiter });
  if (context instanceof NextResponse) return context;
  const { id } = await params;
  const { fields } = await readJsonObject(request);
  const outcome = await answerTogetherCard(context.deps, { userId: context.user.id, cardId: id, fields });
  if (!outcome.ok) return failure(outcome.error, cardErrorStatus(outcome.error));
  return NextResponse.json(outcome);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await authorizeTogether(request, { mutating: true, limiter: togetherLimiter });
  if (context instanceof NextResponse) return context;
  const { id } = await params;
  const outcome = await deleteTogetherDraft(context.deps, { userId: context.user.id, cardId: id });
  return outcome.ok ? NextResponse.json(outcome) : failure(outcome.error, cardErrorStatus(outcome.error));
}
