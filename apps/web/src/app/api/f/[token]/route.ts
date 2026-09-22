import { NextResponse, type NextRequest } from "next/server";
import { loginDeps } from "@/server/deps";
import { DEVICE_COOKIE, deviceCookieOptions, isDeviceId, newDeviceId } from "@/server/device";
import { submitFriendAnswers, type FriendSubmitOutcome } from "@/server/friends-service";
import { isSameOrigin, SESSION_COOKIE } from "@/server/http";
import { getCurrentUser } from "@/server/login-service";
import { enqueueGenerate, enqueueNotify } from "@/server/queue";
import { clientKeyFromHeaders, friendsLimiter } from "@/server/rate-limit";

const ERRORS: Record<Exclude<FriendSubmitOutcome["kind"], "added">, { error: string; status: number }> = {
  invalid: { error: "invalid_answers", status: 400 },
  not_found: { error: "not_found", status: 404 },
  duplicate: { error: "already_answered", status: 409 },
  own_invite: { error: "own_invite", status: 403 },
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const deps = loginDeps();
  if (!isSameOrigin(request, deps.env.APP_URL)) return NextResponse.json({ ok: false, error: "bad_origin" }, { status: 403 });
  if (!friendsLimiter.allow(clientKeyFromHeaders(request.headers))) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }
  const { token } = await params;
  const stored = request.cookies.get(DEVICE_COOKIE)?.value;
  const deviceId = isDeviceId(stored) ? stored : newDeviceId();
  const viewer = await getCurrentUser(deps, request.cookies.get(SESSION_COOKIE)?.value ?? null);
  const body: unknown = await request.json().catch(() => null);
  const raw = typeof body === "object" && body !== null ? (body as { answers?: unknown }).answers : null;

  const outcome = await submitFriendAnswers(
    { db: deps.db, secret: deps.env.SESSION_SECRET, enqueueNotify, enqueueGenerate },
    { token, raw, deviceId, viewerUserId: viewer?.id ?? null },
  );
  const response =
    outcome.kind === "added"
      ? NextResponse.json({ ok: true, redirect: `/f/${token}/done` })
      : NextResponse.json({ ok: false, error: ERRORS[outcome.kind].error }, { status: ERRORS[outcome.kind].status });
  if (stored !== deviceId) response.cookies.set(DEVICE_COOKIE, deviceId, deviceCookieOptions(deps.env.APP_URL));
  return response;
}
