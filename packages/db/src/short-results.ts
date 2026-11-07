import { and, eq } from "drizzle-orm";
import { purchases, shortTestResults } from "./schema";
import type { Database } from "./types";
import { isUuid } from "./uuid";

export type ShortResultRecord = {
  id: string;
  userId: string;
  testSlug: string;
  answers: Record<string, number>;
  scores: Record<string, number>;
  typeKey: string;
  createdAt: Date;
};

export async function saveShortResult(
  db: Database,
  p: { userId: string; testSlug: string; answers: Record<string, number>; scores: Record<string, number>; typeKey: string },
): Promise<ShortResultRecord> {
  const [row] = await db.insert(shortTestResults).values(p).returning();
  return row!;
}

export async function getShortResultForOwner(db: Database, id: string, userId: string): Promise<ShortResultRecord | null> {
  if (!isUuid(id) || !isUuid(userId)) return null;
  const [row] = await db
    .select()
    .from(shortTestResults)
    .where(and(eq(shortTestResults.id, id), eq(shortTestResults.userId, userId)))
    .limit(1);
  return row ?? null;
}

// Личный разбор короткого теста открывается пользователю по тесту, а не по одному результату: пройденный заново тоже
export async function hasPaidShortProduct(db: Database, p: { userId: string; product: "attachment_solo" }): Promise<boolean> {
  if (!isUuid(p.userId)) return false;
  const [row] = await db
    .select({ id: purchases.id })
    .from(purchases)
    .where(and(eq(purchases.userId, p.userId), eq(purchases.product, p.product), eq(purchases.status, "succeeded")))
    .limit(1);
  return row !== undefined;
}
