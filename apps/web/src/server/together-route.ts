import type { UserRecord } from "@grani/db";
import { NextResponse, type NextRequest } from "next/server";
import { loginDeps } from "./deps";
import { isSameOrigin, SESSION_COOKIE } from "./http";
import { getCurrentUser } from "./login-service";
import { clientKeyFromHeaders, type RateLimiter } from "./rate-limit";
import type { TogetherDeps } from "./together-service";

export type TogetherContext = { user: UserRecord; deps: TogetherDeps };

export const failure = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

// Общая проверка маршрутов «Вдвоём»: источник запроса для изменяющих, лимит, сессия. Права на данные проверяет сервис по userId
export async function authorizeTogether(request: NextRequest, options: { mutating: boolean; limiter?: RateLimiter }): Promise<TogetherContext | NextResponse> {
  const login = loginDeps();
  if (options.mutating && !isSameOrigin(request, login.env.APP_URL)) return failure("bad_origin", 403);
  if (options.limiter && !options.limiter.allow(clientKeyFromHeaders(request.headers))) return failure("rate_limited", 429);
  const user = await getCurrentUser(login, request.cookies.get(SESSION_COOKIE)?.value ?? null);
  if (!user) return failure("unauthorized", 401);
  return { user, deps: { db: login.db, now: login.now, appUrl: login.env.APP_URL } };
}

export async function readJsonObject(request: NextRequest): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => null);
  return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}
