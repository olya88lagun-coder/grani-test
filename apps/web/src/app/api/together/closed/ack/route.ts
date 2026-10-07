import { NextResponse, type NextRequest } from "next/server";
import { togetherLimiter } from "@/server/rate-limit";
import { authorizeTogether } from "@/server/together-route";
import { acknowledgeTogetherClosedNotice } from "@/server/together-service";

// Человек прочитал сообщение о закрытии пространства: больше его не показываем
export async function POST(request: NextRequest) {
  const context = await authorizeTogether(request, { mutating: true, limiter: togetherLimiter });
  if (context instanceof NextResponse) return context;
  await acknowledgeTogetherClosedNotice(context.deps, { userId: context.user.id });
  return NextResponse.json({ ok: true });
}
