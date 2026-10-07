import { and, eq } from "drizzle-orm";
import { users } from "./schema";
import type { Database } from "./types";
import { isUuid } from "./uuid";

export async function hasTogetherConsent(db: Database, userId: string, version: string): Promise<boolean> {
  if (!isUuid(userId)) return false;
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.togetherConsentVersion, version)))
    .limit(1);
  return row !== undefined;
}

export async function recordTogetherConsent(db: Database, p: { userId: string; version: string; at: Date }): Promise<void> {
  await db.update(users).set({ togetherConsentVersion: p.version, togetherConsentedAt: p.at }).where(eq(users.id, p.userId));
}
