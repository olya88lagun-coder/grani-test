import { isAgreementSlot, isPairMapRevision, parsePairMapText, type AgreementSlot, type PairMapOutcome } from "@grani/core";
import { and, eq } from "drizzle-orm";
import { pairMapSuccess, withPairMapContext, type PairMapActor } from "./pair-map-context";
import { pairMapAgreementConfirmations, pairMapAgreementDrafts, pairMapAgreements } from "./schema";
import type { Database } from "./types";

type AgreementActor = PairMapActor & { slot: AgreementSlot; expectedRevision: number };
const valid = (p: AgreementActor) => isAgreementSlot(p.slot) && isPairMapRevision(p.expectedRevision);

export async function savePairAgreementDraft(db: Database, p: AgreementActor & { text: string }): Promise<PairMapOutcome> {
  const text = parsePairMapText(p.text, true);
  if (!valid(p) || text === null) return { ok: false, error: "invalid" };
  return withPairMapContext(db, p, async (tx, context) => {
    if (!context.consented) return { ok: false, error: "consent_required" };
    const where = and(eq(pairMapAgreementDrafts.pairId, p.pairId), eq(pairMapAgreementDrafts.userId, p.userId), eq(pairMapAgreementDrafts.slot, p.slot));
    const [row] = await tx.select().from(pairMapAgreementDrafts).where(where);
    if (row?.text === text) return pairMapSuccess(tx, context);
    if ((row?.revision ?? 0) !== p.expectedRevision) return { ok: false, error: "stale_version" };
    if (row) await tx.update(pairMapAgreementDrafts).set({ text, revision: row.revision + 1, updatedAt: p.now }).where(where);
    else await tx.insert(pairMapAgreementDrafts).values({ pairId: p.pairId, userId: p.userId, slot: p.slot, text, updatedAt: p.now });
    return pairMapSuccess(tx, context);
  });
}
export async function proposePairAgreement(db: Database, p: AgreementActor & { text: string }): Promise<PairMapOutcome> {
  const text = parsePairMapText(p.text);
  if (!valid(p) || text === null) return { ok: false, error: "invalid" };
  return withPairMapContext(db, p, async (tx, context) => {
    if (!context.consented) return { ok: false, error: "consent_required" };
    const where = and(eq(pairMapAgreements.pairId, p.pairId), eq(pairMapAgreements.slot, p.slot));
    const [row] = await tx.select().from(pairMapAgreements).where(where);
    if (row?.text === text) return pairMapSuccess(tx, context);
    if ((row?.revision ?? 0) !== p.expectedRevision) return { ok: false, error: "stale_version" };
    if (row) {
      await tx.delete(pairMapAgreementConfirmations).where(eq(pairMapAgreementConfirmations.agreementId, row.id));
      await tx.update(pairMapAgreements).set({ text, revision: row.revision + 1, proposerUserId: p.userId, updatedAt: p.now }).where(where);
    } else await tx.insert(pairMapAgreements).values({ pairId: p.pairId, slot: p.slot, text, proposerUserId: p.userId, updatedAt: p.now });
    return pairMapSuccess(tx, context);
  });
}
async function confirmation(db: Database, p: AgreementActor, confirm: boolean): Promise<PairMapOutcome> {
  if (!valid(p)) return { ok: false, error: "invalid" };
  return withPairMapContext(db, p, async (tx, context) => {
    if (!context.consented) return { ok: false, error: "consent_required" };
    const [row] = await tx.select().from(pairMapAgreements).where(and(eq(pairMapAgreements.pairId, p.pairId), eq(pairMapAgreements.slot, p.slot)));
    if (!row || row.revision !== p.expectedRevision) return { ok: false, error: "stale_version" };
    if (confirm) await tx.insert(pairMapAgreementConfirmations).values({ agreementId: row.id, userId: p.userId, revision: row.revision, confirmedAt: p.now })
      .onConflictDoNothing({ target: [pairMapAgreementConfirmations.agreementId, pairMapAgreementConfirmations.userId] });
    else await tx.delete(pairMapAgreementConfirmations).where(and(eq(pairMapAgreementConfirmations.agreementId, row.id), eq(pairMapAgreementConfirmations.userId, p.userId), eq(pairMapAgreementConfirmations.revision, row.revision)));
    return pairMapSuccess(tx, context);
  });
}
export const confirmPairAgreement = (db: Database, p: AgreementActor): Promise<PairMapOutcome> => confirmation(db, p, true);
export const retractPairAgreementConfirmation = (db: Database, p: AgreementActor): Promise<PairMapOutcome> => confirmation(db, p, false);
