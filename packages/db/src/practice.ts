import { and, eq, sql } from "drizzle-orm";
import type { MoneyPracticeData } from "@grani/core";
import { practiceDrafts } from "./schema";
import type { Database } from "./types";

export type PracticeDraftRecord = { revision: number; schemaVersion: number; data: MoneyPracticeData; updatedAt: Date | null };
export async function loadPracticeDraft(db: Database, resultId: string, key: string): Promise<PracticeDraftRecord | null> {
  const [row] = await db.select().from(practiceDrafts).where(and(eq(practiceDrafts.resultId, resultId), eq(practiceDrafts.practiceKey, key))).limit(1);
  return row ? { revision: row.revision, schemaVersion: row.schemaVersion, data: row.data, updatedAt: row.updatedAt } : null;
}
/** Atomic compare-and-set. Caller checks authenticated owner and paid chapter access. */
export async function writePracticeDraft(db: Database, p: { resultId: string; key: string; expectedRevision: number; schemaVersion: number; data: MoneyPracticeData }): Promise<PracticeDraftRecord | null> {
  const rows = p.expectedRevision === 0
    ? await db.insert(practiceDrafts).values({ resultId: p.resultId, practiceKey: p.key, schemaVersion: p.schemaVersion, data: p.data }).onConflictDoNothing().returning()
    : await db.update(practiceDrafts).set({ data: p.data, revision: sql`${practiceDrafts.revision}+1`, updatedAt: new Date() }).where(and(eq(practiceDrafts.resultId, p.resultId), eq(practiceDrafts.practiceKey, p.key), eq(practiceDrafts.schemaVersion, p.schemaVersion), eq(practiceDrafts.revision, p.expectedRevision))).returning();
  const row = rows[0]; return row ? { revision: row.revision, schemaVersion: row.schemaVersion, data: row.data, updatedAt: row.updatedAt } : null;
}
