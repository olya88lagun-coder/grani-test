import { createHash, timingSafeEqual } from "node:crypto";
import { grantPilotPass, hasIdentity, hasPilotPass, type Database } from "@grani/db";
import type { OwnerIdentity, TogetherConfig } from "./env";
import { requestTogetherJoin, type TogetherDeps } from "./together-service";

export type GateDeps = { db: Database; now: () => Date; together: TogetherConfig; owner: OwnerIdentity | null };

// allowed — «Вдвоём» открыто этому человеку; needs_pass — закрытый пилот, нужен код или приглашение; unavailable — функция выключена
export type Admission = "allowed" | "needs_pass" | "unavailable";
export type RedeemOutcome = { ok: true } | { ok: false; error: "invalid_code" | "limit_reached" | "unavailable" };

export async function togetherAdmission(deps: GateDeps, userId: string | null): Promise<Admission> {
  if (deps.together.mode === "off") return "unavailable";
  if (deps.together.mode === "open") return "allowed";
  if (userId === null) return "needs_pass";
  if (deps.owner && (await hasIdentity(deps.db, userId, deps.owner))) return "allowed";
  return (await hasPilotPass(deps.db, userId)) ? "allowed" : "needs_pass";
}

// Хеши одной длины и сравнение без раннего выхода: по времени ответа длину и начало кода не угадать
function sameCode(given: string, expected: string): boolean {
  const normalize = (value: string) => createHash("sha256").update(value.trim().toLowerCase()).digest();
  return timingSafeEqual(normalize(given), normalize(expected));
}

export async function redeemPilotCode(deps: GateDeps, p: { userId: string; code: string }): Promise<RedeemOutcome> {
  const { mode, pilotCode, pilotLimit } = deps.together;
  if (mode !== "pilot" || pilotCode === null) return { ok: false, error: "unavailable" };
  if (!sameCode(p.code, pilotCode)) return { ok: false, error: "invalid_code" };
  const outcome = await grantPilotPass(deps.db, { userId: p.userId, source: "code", limit: pilotLimit, now: deps.now() });
  return outcome === "limit_reached" ? { ok: false, error: "limit_reached" } : { ok: true };
}

// Партнёр, пришедший по живой ссылке пары, входит без кода: ссылка секретная и живёт 7 дней. Такие пропуска в лимит кода не входят
export async function admitInvitedPartner(deps: GateDeps, userId: string): Promise<void> {
  if (deps.together.mode !== "pilot") return;
  await grantPilotPass(deps.db, { userId, source: "invite", limit: deps.together.pilotLimit, now: deps.now() });
}

// Запрос на участие по ссылке: пропуск выдаётся, когда запрос по живой ссылке принят к рассмотрению (отправлен), а не когда инициатор его подтвердил:
// партнёру нужен доступ к ожиданию. Отклонённый запрос пропуск не отзывает; значимо только в режиме pilot
export async function requestJoinAdmitting(gate: GateDeps, deps: TogetherDeps, p: { token: string; userId: string; consent?: unknown }): ReturnType<typeof requestTogetherJoin> {
  const outcome = await requestTogetherJoin(deps, p);
  if (outcome.ok) await admitInvitedPartner(gate, p.userId);
  return outcome;
}
