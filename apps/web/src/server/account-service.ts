import { deleteUserData, type Database } from "@grani/db";
import type { AppEnv } from "./env";
import { getCurrentUser } from "./login-service";

export type AccountDeps = { db: Database; env: AppEnv };
export type DeleteAccountOutcome = { ok: true } | { ok: false; error: "unauthorized" };

// Удалить можно только свои данные: пользователь берётся из сессии, а не из запроса
export async function deleteAccount(deps: AccountDeps, p: { sessionToken: string | null }): Promise<DeleteAccountOutcome> {
  const user = await getCurrentUser(deps, p.sessionToken);
  if (!user) return { ok: false, error: "unauthorized" };
  await deleteUserData(deps.db, user.id);
  return { ok: true };
}
