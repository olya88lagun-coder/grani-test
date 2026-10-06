import type { UserRecord } from "@grani/db";
import { NextResponse, type NextRequest } from "next/server";
import { loginDeps } from "./deps";
import { isSameOrigin, SESSION_COOKIE } from "./http";
import { getCurrentUser } from "./login-service";
import { clientKeyFromHeaders, type RateLimiter } from "./rate-limit";
import { togetherAdmission, type GateDeps } from "./together-gate";
import type { TogetherDeps } from "./together-service";

export type TogetherContext = { user: UserRecord; deps: TogetherDeps; gate: GateDeps };

export const failure = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

// Один набор кодов ошибок карточек для всех маршрутов: нет доступа к карточке — 404, неверный ввод — 400, конфликт состояния — 409
export const cardErrorStatus = (error: string): number => (error === "not_found" ? 404 : error === "invalid" || error === "invalid_field" || error === "field_not_available" ? 400 : 409);

export const pilotErrorStatus = (error: "invalid_code" | "limit_reached" | "unavailable"): number => (error === "invalid_code" ? 403 : error === "limit_reached" ? 409 : 404);

// Общая проверка маршрутов «Вдвоём»: источник запроса для изменяющих, лимит, сессия, допуск к закрытому пилоту.
// Права на данные проверяет сервис по userId. entry — маршруты, которыми в пилот входят (ввод кода, запрос по приглашению):
// им пропуск не нужен, но выключенная функция недоступна и им
export async function authorizeTogether(request: NextRequest, options: { mutating: boolean; limiter?: RateLimiter; entry?: boolean }): Promise<TogetherContext | NextResponse> {
  const login = loginDeps();
  if (options.mutating && !isSameOrigin(request, login.env.APP_URL)) return failure("bad_origin", 403);
  if (options.limiter && !options.limiter.allow(clientKeyFromHeaders(request.headers))) return failure("rate_limited", 429);
  const user = await getCurrentUser(login, request.cookies.get(SESSION_COOKIE)?.value ?? null);
  if (!user) return failure("unauthorized", 401);
  const gate: GateDeps = { db: login.db, now: login.now, together: login.env.together, owner: login.env.owner };
  const admission = await togetherAdmission(gate, user.id);
  if (admission === "unavailable") return failure("not_found", 404);
  if (admission === "needs_pass" && !options.entry) return failure("pilot_closed", 403);
  return { user, deps: { db: login.db, now: login.now, appUrl: login.env.APP_URL }, gate };
}

export async function readJsonObject(request: NextRequest): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => null);
  return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}
