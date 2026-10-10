import type { PairMapOutcome } from "@grani/core";
import type { Database, UserRecord } from "@grani/db";
import { NextResponse, type NextRequest } from "next/server";
import { loginDeps } from "./deps";
import { isSameOrigin, SESSION_COOKIE } from "./http";
import { getCurrentUser } from "./login-service";
import { clientKeyFromHeaders, type RateLimiter } from "./rate-limit";

export const PAIR_MAP_HEADERS = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
export const pairMapFailure = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: PAIR_MAP_HEADERS });
export function pairMapResponse(outcome: PairMapOutcome): NextResponse {
  const status = outcome.ok ? 200 : ({ not_found: 404, access_required: 403, consent_required: 409, invalid: 400, stale_version: 409, unavailable: 503 } as const)[outcome.error];
  return NextResponse.json(outcome, { status, headers: PAIR_MAP_HEADERS });
}
export async function authorizePairMap(request: NextRequest, options: { mutating: boolean; limiter?: RateLimiter }): Promise<{ user: UserRecord; db: Database; now: () => Date } | NextResponse> {
  try {
    const login = loginDeps();
    if (options.mutating && !isSameOrigin(request, login.env.APP_URL)) return pairMapFailure("bad_origin", 403);
    if (options.limiter && !options.limiter.allow(clientKeyFromHeaders(request.headers))) return pairMapFailure("rate_limited", 429);
    const user = await getCurrentUser(login, request.cookies.get(SESSION_COOKIE)?.value ?? null);
    if (!user) return pairMapFailure("unauthorized", 401);
    return { user, db: login.db, now: login.now };
  } catch { return pairMapFailure("unavailable", 503); }
}
export async function readPairMapBody(request: NextRequest): Promise<Record<string, unknown> | NextResponse> {
  const max = 64 * 1024;
  if (Number(request.headers.get("content-length")) > max) return pairMapFailure("too_large", 413);
  const reader = request.body?.getReader();
  if (!reader) return pairMapFailure("invalid", 400);
  try {
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > max) { await reader.cancel(); return pairMapFailure("too_large", 413); }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const body: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : pairMapFailure("invalid", 400);
  } catch { return pairMapFailure("invalid", 400); }
  finally { reader.releaseLock(); }
}
