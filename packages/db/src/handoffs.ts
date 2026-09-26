import { and, eq, gt, lte } from "drizzle-orm";
import { pendingHandoffs } from "./schema";
import type { Database } from "./types";

// Перенос посчитанного, но ещё не сохранённого результата в другой браузер: код в ссылке → подписанный токен ответов.
// Строка не привязана к пользователю и живёт минуты; истёкшие удаляются при каждой новой записи
export async function saveHandoff(db: Database, p: { code: string; pendingToken: string; expiresAt: Date }, now: Date): Promise<void> {
  await db.delete(pendingHandoffs).where(lte(pendingHandoffs.expiresAt, now));
  await db.insert(pendingHandoffs).values(p);
}

export async function takeHandoff(db: Database, code: string, now: Date): Promise<string | null> {
  const [row] = await db
    .select({ pendingToken: pendingHandoffs.pendingToken })
    .from(pendingHandoffs)
    .where(and(eq(pendingHandoffs.code, code), gt(pendingHandoffs.expiresAt, now)))
    .limit(1);
  return row?.pendingToken ?? null;
}
