import { emptySurveyAnswers, isPairMapRevision, parseSurveyAnswers, type PairMapOutcome, type SurveyAnswers } from "@grani/core";
import { and, eq } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";
import { pairMapSuccess, withPairMapContext, type PairMapActor } from "./pair-map-context";
import { pairMapSurveys } from "./schema";
import type { Database } from "./types";

export async function savePairSurvey(db: Database, p: PairMapActor & { answers: SurveyAnswers; expectedRevision: number; publish: boolean }): Promise<PairMapOutcome> {
  const answers = parseSurveyAnswers(p.answers, p.publish);
  if (!answers || !isPairMapRevision(p.expectedRevision) || typeof p.publish !== "boolean") return { ok: false, error: "invalid" };
  return withPairMapContext(db, p, async (tx, context) => {
    if (!context.consented) return { ok: false, error: "consent_required" };
    const where = and(eq(pairMapSurveys.pairId, p.pairId), eq(pairMapSurveys.userId, p.userId));
    const [row] = await tx.select().from(pairMapSurveys).where(where);
    const draftSame = !!row && isDeepStrictEqual(row.draft, answers);
    const publishSame = !!row && isDeepStrictEqual(row.published, answers);
    if (draftSame && (!p.publish || publishSame)) return pairMapSuccess(tx, context);
    if ((row?.revision ?? 0) !== p.expectedRevision) return { ok: false, error: "stale_version" };
    const update = { draft: answers, revision: (row?.revision ?? 0) + 1, updatedAt: p.now,
      ...(p.publish && !publishSame ? { published: answers, publishedRevision: (row?.publishedRevision ?? 0) + 1, publishedAt: p.now } : {}) };
    if (row) await tx.update(pairMapSurveys).set(update).where(where);
    else await tx.insert(pairMapSurveys).values({ pairId: p.pairId, userId: p.userId, ...update });
    return pairMapSuccess(tx, context);
  });
}
export async function deletePairSurvey(db: Database, p: PairMapActor & { expectedRevision: number }): Promise<PairMapOutcome> {
  if (!isPairMapRevision(p.expectedRevision)) return { ok: false, error: "invalid" };
  return withPairMapContext(db, p, async (tx, context) => {
    const where = and(eq(pairMapSurveys.pairId, p.pairId), eq(pairMapSurveys.userId, p.userId));
    const [row] = await tx.select().from(pairMapSurveys).where(where);
    if (!row || (!row.published && isDeepStrictEqual(row.draft, emptySurveyAnswers()))) return pairMapSuccess(tx, context);
    if (row.revision !== p.expectedRevision) return { ok: false, error: "stale_version" };
    // Keep only a monotonic tombstone revision; all written text is erased.
    await tx.update(pairMapSurveys).set({ draft: emptySurveyAnswers(), published: null, publishedAt: null, revision: row.revision + 1, updatedAt: p.now }).where(where);
    return pairMapSuccess(tx, context);
  });
}
