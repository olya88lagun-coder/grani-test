import { NextResponse, type NextRequest } from "next/server";
import { authorizeTogether, cardErrorStatus, failure } from "@/server/together-route";
import { getTogetherHistory } from "@/server/together-cards-service";

export async function GET(request: NextRequest) {
  const context = await authorizeTogether(request, { mutating: false });
  if (context instanceof NextResponse) return context;
  const outcome = await getTogetherHistory(context.deps, { userId: context.user.id, before: request.nextUrl.searchParams.get("before") ?? undefined });
  if (!outcome.ok) return failure(outcome.error, cardErrorStatus(outcome.error));
  return NextResponse.json({ ok: true, items: outcome.items, next: outcome.next }, { headers: { "cache-control": "no-store" } });
}
