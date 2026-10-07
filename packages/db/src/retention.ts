import { and, eq, inArray, isNotNull, isNull, lt, ne, notExists, sql } from "drizzle-orm";
import { deleteUserData } from "./delete-user";
import { purchases, togetherAccessPeriods, togetherSpaces, users } from "./schema";
import type { Database } from "./types";

// Сроки из политики конфиденциальности: данные стираются через 3 года после последнего входа,
// записи об оплатах без ответов теста хранятся 3 года после оплаты (срок исковой давности)
export const DATA_RETENTION_YEARS = 3;
export const RETENTION_BATCH_SIZE = 100;

export type PurgeOutcome = { usersDeleted: number; purchasesDeleted: number; failedUserIds: string[] };

export function retentionCutoff(now: Date): Date {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - DATA_RETENTION_YEARS);
  return cutoff;
}

// Одна порция работы: пачка людей без входов дольше срока и пачка просроченных записей об оплатах удалённых людей.
// Остаток доберёт следующий запуск, поэтому порция ограничена
export async function purgeExpiredData(db: Database, p: { now: Date; batchSize?: number }): Promise<PurgeOutcome> {
  const cutoff = retentionCutoff(p.now);
  const batchSize = p.batchSize ?? RETENTION_BATCH_SIZE;
  const { usersDeleted, failedUserIds } = await eraseInactiveUsers(db, cutoff, p.now, batchSize);
  const purchasesDeleted = await removeExpiredPurchases(db, cutoff, batchSize);
  return { usersDeleted, purchasesDeleted, failedUserIds };
}

async function eraseInactiveUsers(db: Database, cutoff: Date, now: Date, batchSize: number) {
  const due = await db
    .select({ id: users.id })
    .from(users)
    .where(and(isNull(users.deletedAt), lt(users.lastLoginAt, cutoff)))
    .orderBy(users.lastLoginAt)
    .limit(batchSize);
  let usersDeleted = 0;
  const failedUserIds: string[] = [];
  for (const { id } of due) {
    // Сбой на одном человеке не должен останавливать остальных; его id попадает в итог, а работа повторится при следующем запуске
    try {
      if ((await deleteUserData(db, id, now)).deleted) usersDeleted += 1;
    } catch {
      failedUserIds.push(id);
    }
  }
  return { usersDeleted, failedUserIds };
}

// Только записи уже удалённых людей: у действующего человека покупка открывает доступ к разбору.
// Запись, на которой держится доступ живого пространства, остаётся; у закрытого пространства период доступа уходит вместе с ней
async function removeExpiredPurchases(db: Database, cutoff: Date, batchSize: number): Promise<number> {
  const heldByLiveSpace = db
    .select({ one: sql`1` })
    .from(togetherAccessPeriods)
    .innerJoin(togetherSpaces, eq(togetherSpaces.id, togetherAccessPeriods.spaceId))
    .where(and(eq(togetherAccessPeriods.purchaseId, purchases.id), ne(togetherSpaces.status, "closed")));
  const due = await db
    .select({ id: purchases.id })
    .from(purchases)
    .innerJoin(users, eq(users.id, purchases.userId))
    .where(and(isNotNull(users.deletedAt), lt(sql`coalesce(${purchases.paidAt}, ${purchases.createdAt})`, cutoff), notExists(heldByLiveSpace)))
    .limit(batchSize);
  if (due.length === 0) return 0;
  const ids = due.map((row) => row.id);
  return db.transaction(async (tx) => {
    await tx.delete(togetherAccessPeriods).where(inArray(togetherAccessPeriods.purchaseId, ids));
    const removed = await tx.delete(purchases).where(inArray(purchases.id, ids)).returning({ id: purchases.id });
    return removed.length;
  });
}
