import { createInviteToken, isInviteToken, saveHandoff, takeHandoff, type Database } from "@grani/db";
import { verifyPending } from "./auth/tokens";

// Ссылка переноса живёт полчаса — хватит, чтобы открыть её в Safari, и не дольше
export const HANDOFF_TTL_MS = 30 * 60 * 1000;

type Deps = { db: Database; secret: string; now: () => number };

export async function createHandoff(deps: Deps, pendingToken: string | null): Promise<{ code: string } | null> {
  if (!pendingToken || !(await verifyPending(pendingToken, deps.secret))) return null;
  const code = createInviteToken();
  const now = deps.now();
  await saveHandoff(deps.db, { code, pendingToken, expiresAt: new Date(now + HANDOFF_TTL_MS) }, new Date(now));
  return { code };
}

// Токен перепроверяется: в базе лежит то, что подписал сервер, но проверка дешёвая и не зависит от доверия к таблице
export async function restoreHandoff(deps: Deps, code: string): Promise<string | null> {
  if (!isInviteToken(code)) return null;
  const pendingToken = await takeHandoff(deps.db, code, new Date(deps.now()));
  if (!pendingToken || !(await verifyPending(pendingToken, deps.secret))) return null;
  return pendingToken;
}
