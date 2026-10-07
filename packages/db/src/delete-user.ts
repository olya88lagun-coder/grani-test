import { and, eq, isNull } from "drizzle-orm";
import { authIdentities, purchases, results, togetherInvites, togetherPilotPasses, users } from "./schema";
import { closeSpaceForUser } from "./together";
import { deleteUserAnswers } from "./together-cards";
import type { Database } from "./types";
import { isUuid } from "./uuid";

// Каскады схемы уносят от результатов ссылки для друзей, ответы друзей, приглашения, пары и разборы.
// Покупки остаются для налогового учёта: их ссылки на результат и пару обнуляются (on delete set null), почта для чека стирается
export async function deleteUserData(db: Database, userId: string, now: Date = new Date()): Promise<{ deleted: boolean }> {
  if (!isUuid(userId)) return { deleted: false };
  return db.transaction(async (tx) => {
    const [marked] = await tx
      .update(users)
      .set({ deletedAt: now, gender: null, togetherConsentVersion: null, togetherConsentedAt: null })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning({ id: users.id });
    if (!marked) return { deleted: false };
    await tx.delete(results).where(eq(results.userId, userId));
    // Совместное пространство закрывается: партнёр освобождается, записи об оплатах остаются
    await closeSpaceForUser(tx, { userId, now, reason: "account_deleted" });
    // Пользователь помечается удалённым, а не удаляется, поэтому каскад ответов не сработает сам
    await deleteUserAnswers(tx, userId);
    // Записка в приглашении — тоже текст человека: приглашения остаются в журнале, записки стираются
    await tx.update(togetherInvites).set({ note: null }).where(eq(togetherInvites.inviterId, userId));
    // Пользователь только помечается удалённым, каскад пропуска не сработает сам
    await tx.delete(togetherPilotPasses).where(eq(togetherPilotPasses.userId, userId));
    await tx.delete(authIdentities).where(eq(authIdentities.userId, userId));
    // Записи об оплатах остаются для налогового учёта, но без почты покупателя
    await tx.update(purchases).set({ receiptEmail: null }).where(eq(purchases.userId, userId));
    return { deleted: true };
  });
}
