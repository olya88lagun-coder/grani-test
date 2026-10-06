import { NextResponse, type NextRequest } from "next/server";
import { authorizeTogether, failure } from "@/server/together-route";
import { getTogetherCareCard } from "@/server/together-care-service";

// Итог месяца 1 для обоих участников; пока месяц не пройден, отвечает ready: false
export async function GET(request: NextRequest) {
  const context = await authorizeTogether(request, { mutating: false });
  if (context instanceof NextResponse) return context;
  const outcome = await getTogetherCareCard(context.deps, { userId: context.user.id });
  return outcome.ok ? NextResponse.json(outcome, { headers: { "cache-control": "no-store" } }) : failure(outcome.error, 404);
}
