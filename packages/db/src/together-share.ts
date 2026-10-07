import { eq } from "drizzle-orm";
import { togetherSpaces } from "./schema";
import { findActiveMembership, lockSpace } from "./together";
import { createShareCode } from "./tokens";
import type { Database } from "./types";

// Код-ссылка для друзей есть у активной пары (оба участника получают один и тот же); появляется при первой просьбе и дальше не меняется
export async function ensureShareCode(db: Database, p: { userId: string }): Promise<string | null> {
  return db.transaction(async (tx): Promise<string | null> => {
    const membership = await findActiveMembership(tx, p.userId);
    if (!membership) return null;
    const space = await lockSpace(tx, membership.spaceId);
    if (!space || space.status !== "active") return null;
    if (space.shareCode) return space.shareCode;
    const code = createShareCode();
    await tx.update(togetherSpaces).set({ shareCode: code }).where(eq(togetherSpaces.id, space.id));
    return code;
  });
}
