export const SESSION_COOKIE = "grani_session";
export const PENDING_COOKIE = "grani_pending";
export const CONSENT_COOKIE = "grani_consent";
export const VK_STATE_COOKIE = "grani_vk_oauth";

const DAY_SECONDS = 86400;
const SESSION_MAX_AGE_SECONDS = 30 * DAY_SECONDS;
const PENDING_MAX_AGE_SECONDS = DAY_SECONDS;
const CONSENT_MAX_AGE_SECONDS = 3600;
const VK_STATE_MAX_AGE_SECONDS = 600;

export type CookieOptions = { httpOnly: true; secure: boolean; sameSite: "lax"; path: string; maxAge: number };

function options(appUrl: string, maxAge: number, path = "/"): CookieOptions {
  return { httpOnly: true, secure: appUrl.startsWith("https://"), sameSite: "lax", path, maxAge };
}

export const sessionCookieOptions = (appUrl: string) => options(appUrl, SESSION_MAX_AGE_SECONDS);
export const pendingCookieOptions = (appUrl: string) => options(appUrl, PENDING_MAX_AGE_SECONDS);
export const consentCookieOptions = (appUrl: string) => options(appUrl, CONSENT_MAX_AGE_SECONDS);
export const vkStateCookieOptions = (appUrl: string) => options(appUrl, VK_STATE_MAX_AGE_SECONDS, "/api/auth/vk");

export function expiredCookieOptions(cookie: CookieOptions): CookieOptions {
  return { ...cookie, maxAge: 0 };
}

export function isSameOrigin(request: Request, appUrl: string): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(appUrl).origin;
}
