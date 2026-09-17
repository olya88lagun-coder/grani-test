import type { Answers } from "@grani/core";
import type { Consent } from "@grani/db";
import { jwtVerify, SignJWT, type JWTPayload } from "jose";

const SESSION_TTL = "30d";
const VK_STATE_TTL = "10m";
const PENDING_TTL = "1d";
const CONSENT_TTL = "1h";

const AUDIENCE = { session: "session", vkState: "vk-state", pending: "pending-answers", consent: "consent" } as const;

const key = (secret: string) => new TextEncoder().encode(secret);

async function sign(payload: JWTPayload, audience: string, ttl: string, secret: string, subject?: string): Promise<string> {
  const jwt = new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setAudience(audience).setIssuedAt().setExpirationTime(ttl);
  return (subject ? jwt.setSubject(subject) : jwt).sign(key(secret));
}

async function verify(token: string, audience: string, secret: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { audience, algorithms: ["HS256"] });
    return payload;
  } catch {
    return null;
  }
}

export async function signSession(userId: string, secret: string): Promise<string> {
  return sign({}, AUDIENCE.session, SESSION_TTL, secret, userId);
}

export async function verifySession(token: string, secret: string): Promise<string | null> {
  const payload = await verify(token, AUDIENCE.session, secret);
  return typeof payload?.sub === "string" ? payload.sub : null;
}

export type VkState = { state: string; codeVerifier: string };

export async function signVkState(state: VkState, secret: string): Promise<string> {
  return sign({ ...state }, AUDIENCE.vkState, VK_STATE_TTL, secret);
}

export async function verifyVkState(token: string, secret: string): Promise<VkState | null> {
  const payload = await verify(token, AUDIENCE.vkState, secret);
  if (typeof payload?.state !== "string" || typeof payload.codeVerifier !== "string") return null;
  return { state: payload.state, codeVerifier: payload.codeVerifier };
}

export async function signPending(answers: Answers, secret: string): Promise<string> {
  return sign({ answers }, AUDIENCE.pending, PENDING_TTL, secret);
}

export async function verifyPending(token: string, secret: string): Promise<Record<string, number> | null> {
  const payload = await verify(token, AUDIENCE.pending, secret);
  const answers = payload?.answers;
  if (typeof answers !== "object" || answers === null || Array.isArray(answers)) return null;
  return answers as Record<string, number>;
}

export async function signConsent(consent: Consent, secret: string): Promise<string> {
  const iat = Math.floor(consent.at.getTime() / 1000);
  return new SignJWT({ version: consent.version })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUDIENCE.consent)
    .setIssuedAt(iat)
    .setExpirationTime(CONSENT_TTL)
    .sign(key(secret));
}

export async function verifyConsent(token: string, secret: string): Promise<Consent | null> {
  const payload = await verify(token, AUDIENCE.consent, secret);
  if (typeof payload?.version !== "string" || typeof payload.iat !== "number") return null;
  return { version: payload.version, at: new Date(payload.iat * 1000) };
}
