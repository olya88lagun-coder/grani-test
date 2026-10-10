import { emptySurveyAnswers, PAIR_MAP_CONSENT_VERSION, parseSurveyAnswers, unlockedKinds, type AgreementSlot, type PairMapOutcome, type PairMapSnapshot } from "@grani/core";
import { and, eq, isNull, ne, or } from "drizzle-orm";
import { listOwnedProducts } from "./purchases";
import { pairMapAgreementConfirmations, pairMapAgreementDrafts, pairMapAgreements, pairMapConsents, pairMapSurveys, pairs } from "./schema";
import type { Database } from "./types";
import { isUuid } from "./uuid";

export type PairMapActor = { pairId: string; userId: string; now: Date };
export type PairMapContext = PairMapActor & { partnerId: string; consented: boolean };

// The pair lock serializes all shared updates, including proposals by different authors.
export async function withPairMapContext(db: Database, p: PairMapActor, run: (tx: Database, context: PairMapContext) => Promise<PairMapOutcome>): Promise<PairMapOutcome> {
  if (!isUuid(p.pairId) || !isUuid(p.userId)) return { ok: false, error: "not_found" };
  return db.transaction(async tx => {
    const [pair] = await tx.select().from(pairs).where(and(eq(pairs.id, p.pairId), isNull(pairs.leftAt), or(eq(pairs.userAId, p.userId), eq(pairs.userBId, p.userId)))).for("update");
    if (!pair) return { ok: false, error: "not_found" };
    if (!unlockedKinds(await listOwnedProducts(tx, { pairId: p.pairId })).has("pair")) return { ok: false, error: "access_required" };
    const [consent] = await tx.select().from(pairMapConsents).where(and(eq(pairMapConsents.pairId, p.pairId), eq(pairMapConsents.userId, p.userId), eq(pairMapConsents.version, PAIR_MAP_CONSENT_VERSION)));
    return run(tx, { ...p, partnerId: pair.userAId === p.userId ? pair.userBId : pair.userAId, consented: !!consent });
  });
}

export async function pairMapSnapshot(tx: Database, context: PairMapContext): Promise<PairMapSnapshot> {
  const surveys = await tx.select().from(pairMapSurveys).where(eq(pairMapSurveys.pairId, context.pairId));
  const mine = surveys.find(row => row.userId === context.userId);
  const partner = surveys.find(row => row.userId === context.partnerId);
  const ownPublished = mine?.published ? parseSurveyAnswers(mine.published, true) : null;
  const partnerPublished = partner?.published ? parseSurveyAnswers(partner.published, true) : null;
  const agreements = await tx.select().from(pairMapAgreements).where(eq(pairMapAgreements.pairId, context.pairId));
  const drafts = await tx.select().from(pairMapAgreementDrafts).where(and(eq(pairMapAgreementDrafts.pairId, context.pairId), eq(pairMapAgreementDrafts.userId, context.userId)));
  const confirmations = await tx.select({ agreementId: pairMapAgreementConfirmations.agreementId, userId: pairMapAgreementConfirmations.userId, revision: pairMapAgreementConfirmations.revision })
    .from(pairMapAgreementConfirmations).innerJoin(pairMapAgreements, eq(pairMapAgreements.id, pairMapAgreementConfirmations.agreementId)).where(eq(pairMapAgreements.pairId, context.pairId));
  return {
    consentRequired: !context.consented,
    survey: {
      mine: { draft: mine ? parseSurveyAnswers(mine.draft, false) ?? emptySurveyAnswers() : emptySurveyAnswers(), revision: mine?.revision ?? 0,
        published: ownPublished && mine?.publishedAt ? { answers: ownPublished, revision: mine.publishedRevision, updatedAt: mine.publishedAt.toISOString() } : null },
      partner: { submitted: !!partnerPublished,
        published: ownPublished && partnerPublished && partner?.publishedAt ? { answers: partnerPublished, revision: partner.publishedRevision, updatedAt: partner.publishedAt.toISOString() } : null },
    },
    agreements: ([0, 1, 2] as AgreementSlot[]).map(slot => {
      const draft = drafts.find(row => row.slot === slot);
      const proposal = agreements.find(row => row.slot === slot);
      const confirmed = (userId: string) => !!proposal && confirmations.some(row => row.agreementId === proposal.id && row.userId === userId && row.revision === proposal.revision);
      return { slot, draft: { text: draft?.text ?? "", revision: draft?.revision ?? 0 },
        proposal: proposal ? { text: proposal.text, revision: proposal.revision, proposedByYou: proposal.proposerUserId === context.userId, confirmedByYou: confirmed(context.userId), confirmedByPartner: confirmed(context.partnerId), updatedAt: proposal.updatedAt.toISOString() } : null };
    }),
  };
}
export async function pairMapSuccess(tx: Database, context: PairMapContext): Promise<PairMapOutcome> {
  return { ok: true, snapshot: await pairMapSnapshot(tx, context) };
}
export async function readPairMap(db: Database, p: PairMapActor): Promise<PairMapOutcome> {
  return withPairMapContext(db, p, pairMapSuccess);
}
export async function acceptPairMapConsent(db: Database, p: PairMapActor & { version: string }): Promise<PairMapOutcome> {
  if (p.version !== PAIR_MAP_CONSENT_VERSION) return { ok: false, error: "invalid" };
  return withPairMapContext(db, p, async (tx, context) => {
    await tx.insert(pairMapConsents).values({ pairId: p.pairId, userId: p.userId, version: p.version, acceptedAt: p.now })
      .onConflictDoUpdate({ target: [pairMapConsents.pairId, pairMapConsents.userId], set: { version: p.version, acceptedAt: p.now }, setWhere: ne(pairMapConsents.version, p.version) });
    return pairMapSuccess(tx, { ...context, consented: true });
  });
}
