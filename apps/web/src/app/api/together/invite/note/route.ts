import { NextResponse, type NextRequest } from "next/server";
import { togetherLimiter } from "@/server/rate-limit";
import { authorizeTogether, failure, noteErrorStatus, readJsonObject } from "@/server/together-route";
import { setTogetherInviteNote } from "@/server/together-service";

// Записка пригласившего: её видит партнёр на странице приглашения. Пустая записка стирает прежнюю
export async function PUT(request: NextRequest) {
  const context = await authorizeTogether(request, { mutating: true, limiter: togetherLimiter });
  if (context instanceof NextResponse) return context;
  const { note } = await readJsonObject(request);
  const outcome = await setTogetherInviteNote(context.deps, { userId: context.user.id, note });
  if (outcome.ok) return NextResponse.json(outcome);
  return failure(outcome.error, noteErrorStatus(outcome.error));
}
