import { randomBytes } from "node:crypto";
import { getLatestResultId, getUser, upsertUserFromIdentity, type Database, type IdentityInput, type UserRecord } from "@grani/db";
import { verifyTelegramLoginWidget } from "./auth/telegram";
import { signConsent, signSession, signVkState, verifyConsent, verifySession, verifyVkState } from "./auth/tokens";
import { buildVkAuthorizeUrl, createPkcePair, exchangeVkCode, fetchVkUser, type FetchFn } from "./auth/vk";
import type { AppEnv } from "./env";
import { pairReturnPath } from "./pairs-service";
import { savePendingResult } from "./results-service";

export const CONSENT_VERSION = "2026-09-v1";
const STATE_BYTES = 24;

export type LoginDeps = { db: Database; env: AppEnv; now: () => Date; fetchFn: FetchFn };
export type LoginCookies = { session: string | null; pending: string | null; consent: string | null; pairInvite?: string | null };
export type LoginOutcome = { ok: true; sessionToken: string; redirectTo: string } | { ok: false; error: string };

const vkRedirectUri = (env: AppEnv) => new URL("/api/auth/vk/callback", env.APP_URL).toString();
const fullName = (first: string, last: string | null) => [first, last].filter(Boolean).join(" ");

export async function giveConsent(deps: Pick<LoginDeps, "env" | "now">): Promise<string> {
  return signConsent({ version: CONSENT_VERSION, at: deps.now() }, deps.env.SESSION_SECRET);
}

export async function completeLogin(deps: LoginDeps, identity: IdentityInput, cookies: LoginCookies): Promise<LoginOutcome> {
  const consent = cookies.consent ? await verifyConsent(cookies.consent, deps.env.SESSION_SECRET) : null;
  const upserted = await upsertUserFromIdentity(deps.db, identity, consent);
  if (!upserted.ok) return { ok: false, error: "consent_required" };
  const userId = upserted.user.id;
  const secretDeps = { db: deps.db, secret: deps.env.SESSION_SECRET };
  const resultId = (await savePendingResult(secretDeps, userId, cookies.pending)) ?? (await getLatestResultId(deps.db, userId));
  return {
    ok: true,
    sessionToken: await signSession(userId, deps.env.SESSION_SECRET),
    // Партнёр, пришедший по приглашению, возвращается к согласию; отложенные ответы уже сохранены выше
    redirectTo: pairReturnPath(cookies.pairInvite) ?? (resultId ? `/result/${resultId}` : "/test"),
  };
}

export async function loginWithTelegram(deps: LoginDeps, params: URLSearchParams, cookies: LoginCookies): Promise<LoginOutcome> {
  const verified = verifyTelegramLoginWidget(params, deps.env.TELEGRAM_BOT_TOKEN, deps.now());
  if (!verified.ok) return { ok: false, error: `telegram_${verified.reason}` };
  const { user } = verified;
  return completeLogin(
    deps,
    { provider: "telegram", externalId: String(user.id), displayName: fullName(user.firstName, user.lastName), gender: null },
    cookies,
  );
}

export async function startVkLogin(deps: LoginDeps): Promise<{ redirectUrl: string; stateCookie: string }> {
  const { codeVerifier, codeChallenge } = createPkcePair();
  const state = randomBytes(STATE_BYTES).toString("base64url");
  const stateCookie = await signVkState({ state, codeVerifier }, deps.env.SESSION_SECRET);
  const redirectUrl = buildVkAuthorizeUrl({ clientId: deps.env.VK_CLIENT_ID, redirectUri: vkRedirectUri(deps.env), state, codeChallenge });
  return { redirectUrl, stateCookie };
}

export async function finishVkLogin(
  deps: LoginDeps,
  p: { code: string | null; deviceId: string | null; state: string | null; stateCookie: string | null; cookies: LoginCookies },
): Promise<LoginOutcome> {
  if (!p.code || !p.deviceId || !p.state || !p.stateCookie) return { ok: false, error: "vk_missing_params" };
  const saved = await verifyVkState(p.stateCookie, deps.env.SESSION_SECRET);
  if (!saved || saved.state !== p.state) return { ok: false, error: "vk_state_mismatch" };

  const token = await exchangeVkCode({
    clientId: deps.env.VK_CLIENT_ID,
    redirectUri: vkRedirectUri(deps.env),
    code: p.code,
    codeVerifier: saved.codeVerifier,
    deviceId: p.deviceId,
    state: p.state,
    fetchFn: deps.fetchFn,
  });
  if (!token.ok) return { ok: false, error: `vk_${token.error}` };

  const profile = await fetchVkUser({ clientId: deps.env.VK_CLIENT_ID, accessToken: token.accessToken, fetchFn: deps.fetchFn });
  if (!profile.ok) return { ok: false, error: `vk_${profile.error}` };

  const { user } = profile;
  return completeLogin(
    deps,
    { provider: "vk", externalId: user.id, displayName: fullName(user.firstName, user.lastName), gender: user.gender },
    p.cookies,
  );
}

export async function getCurrentUser(deps: Pick<LoginDeps, "db" | "env">, sessionToken: string | null): Promise<UserRecord | null> {
  if (!sessionToken) return null;
  const userId = await verifySession(sessionToken, deps.env.SESSION_SECRET);
  return userId ? getUser(deps.db, userId) : null;
}
