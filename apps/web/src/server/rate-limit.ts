export type RateLimiter = { allow(key: string): boolean };

const MAX_TRACKED_KEYS = 10_000;
const MINUTE_MS = 60_000;
const RESULTS_PER_MINUTE = 20;

export function createRateLimiter(p: { limit: number; windowMs: number; now?: () => number }): RateLimiter {
  const now = p.now ?? Date.now;
  const windows = new Map<string, { startedAt: number; count: number }>();
  return {
    allow(key) {
      const current = now();
      if (windows.size > MAX_TRACKED_KEYS) windows.clear();
      const window = windows.get(key);
      if (!window || current - window.startedAt >= p.windowMs) {
        windows.set(key, { startedAt: current, count: 1 });
        return true;
      }
      if (window.count >= p.limit) return false;
      windows.set(key, { startedAt: window.startedAt, count: window.count + 1 });
      return true;
    },
  };
}

const FRIEND_ANSWERS_PER_MINUTE = 10;
const INVITES_PER_MINUTE = 20;

export const friendsLimiter = createRateLimiter({ limit: FRIEND_ANSWERS_PER_MINUTE, windowMs: MINUTE_MS });
export const invitesLimiter = createRateLimiter({ limit: INVITES_PER_MINUTE, windowMs: MINUTE_MS });

export const resultsLimiter = createRateLimiter({ limit: RESULTS_PER_MINUTE, windowMs: MINUTE_MS });

export function clientKeyFromHeaders(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

const PURCHASES_PER_MINUTE = 10;

export const purchasesLimiter = createRateLimiter({ limit: PURCHASES_PER_MINUTE, windowMs: MINUTE_MS });
