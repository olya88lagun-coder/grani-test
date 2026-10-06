import { NextResponse, type NextRequest } from "next/server";
import { loginDeps } from "@/server/deps";
import { clientKeyFromHeaders, togetherLimiter } from "@/server/rate-limit";
import { failure } from "@/server/together-route";
import { peekTogetherInvite } from "@/server/together-service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!togetherLimiter.allow(clientKeyFromHeaders(request.headers))) return failure("rate_limited", 429);
  const login = loginDeps();
  const { token } = await params;
  const outcome = await peekTogetherInvite({ db: login.db, now: login.now, appUrl: login.env.APP_URL }, token);
  return NextResponse.json({ ok: true, ...outcome }, { headers: { "cache-control": "no-store" } });
}
