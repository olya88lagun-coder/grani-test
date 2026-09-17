import type { Answers, Stability, TraitScores, TypeCode } from "@grani/core";
import { and, desc, eq } from "drizzle-orm";
import { results } from "./schema";
import type { Database } from "./types";
import { isUuid } from "./uuid";

export type NewResult = { userId: string; answers: Answers; scores: TraitScores; typeCode: TypeCode; stability: Stability };
export type ResultRecord = NewResult & { id: string; createdAt: Date };

type ResultRow = typeof results.$inferSelect;

// В базе jsonb и text; значения туда попадают только через createResult, поэтому приведение типов безопасно
function toRecord(row: ResultRow): ResultRecord {
  return {
    id: row.id,
    userId: row.userId,
    answers: row.answers as Answers,
    scores: row.scores as TraitScores,
    typeCode: row.typeCode as TypeCode,
    stability: row.stability as Stability,
    createdAt: row.createdAt,
  };
}

export async function createResult(db: Database, input: NewResult): Promise<ResultRecord> {
  const [row] = await db.insert(results).values(input).returning();
  return toRecord(row!);
}

export async function getResultForOwner(db: Database, resultId: string, userId: string): Promise<ResultRecord | null> {
  if (!isUuid(resultId) || !isUuid(userId)) return null;
  const [row] = await db
    .select()
    .from(results)
    .where(and(eq(results.id, resultId), eq(results.userId, userId)))
    .limit(1);
  return row ? toRecord(row) : null;
}

export async function getLatestResultId(db: Database, userId: string): Promise<string | null> {
  if (!isUuid(userId)) return null;
  const [row] = await db
    .select({ id: results.id })
    .from(results)
    .where(eq(results.userId, userId))
    .orderBy(desc(results.createdAt))
    .limit(1);
  return row?.id ?? null;
}
