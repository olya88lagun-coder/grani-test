import { and, eq, isNull } from "drizzle-orm";
import { authIdentities, results, users } from "./schema";
import type { Database } from "./types";
import { isUuid } from "./uuid";

// Каскады схемы уносят от результатов ссылки для друзей, ответы друзей, приглашения, пары и разборы.
// Покупки остаются для налогового учёта: их ссылки на результат и пару обнуляются (on delete set null)
export async function deleteUserData(db: Database, userId: string): Promise<{ deleted: boolean }> {
  if (!isUuid(userId)) return { deleted: false };
  return db.transaction(async (tx) => {
    const [marked] = await tx
      .update(users)
      .set({ deletedAt: new Date(), gender: null })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning({ id: users.id });
    if (!marked) return { deleted: false };
    await tx.delete(results).where(eq(results.userId, userId));
    await tx.delete(authIdentities).where(eq(authIdentities.userId, userId));
    return { deleted: true };
  });
}
