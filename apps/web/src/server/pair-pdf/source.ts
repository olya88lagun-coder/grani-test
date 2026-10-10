import { createHash } from "node:crypto";
import { getLibrary } from "@grani/content/data";
import type { AgreementSlot, PairMapFailure, PublishedSurvey } from "@grani/core";
import { getPairForMember, getReport, pairMapSnapshot, withPairMapContext, type Database } from "@grani/db";
import { buildPairGuide } from "@/lib/pair-guide";
import { buildPairReportView, buildPairView, type PairReportView, type PairView } from "@/lib/pair-view";

export type PairPdfSource = {
  view: PairView; generatedAt: string; guides: readonly ReturnType<typeof buildPairGuide>[];
  confirmedAgreements: { slot: AgreementSlot; text: string; revision: number }[];
  sharedAnswers: { mine: PublishedSurvey; partner: PublishedSurvey } | null;
  extras: Exclude<PairReportView, { state: "available" }>;
  includeAnswers: boolean; sharedRevisionToken: string;
};
type PdfActor = { pairId: string; userId: string; now: Date };
export async function loadPairPdfSource(db: Database, p: PdfActor & { includeAnswers: boolean }): Promise<PairPdfSource | PairMapFailure> {
  try {
    let source: PairPdfSource | null = null;
    const result = await withPairMapContext(db, p, async (tx, context) => {
      const pair = await getPairForMember(tx, p.pairId, p.userId);
      if (!pair) return { ok: false, error: "not_found" };
      const snapshot = await pairMapSnapshot(tx, context);
      const view = buildPairView(getLibrary(), pair, p.userId);
      const confirmedAgreements = snapshot.agreements.flatMap(a => a.proposal?.confirmedByYou && a.proposal.confirmedByPartner ? [{ slot: a.slot, text: a.proposal.text, revision: a.proposal.revision }] : []);
      const { mine, partner } = snapshot.survey;
      const sharedAnswers = p.includeAnswers && mine.published && partner.published ? { mine: mine.published, partner: partner.published } : null;
      // The enclosing transaction has already checked the real existing pair entitlement.
      const extras = buildPairReportView({ owned: ["pair"], report: await getReport(tx, { pairId: p.pairId }, "pair") });
      if (extras.state === "available") return { ok: false, error: "access_required" };
      const sharedRevisionToken = createHash("sha256").update(JSON.stringify({ confirmedAgreements, sharedAnswers })).digest("hex");
      source = { view, generatedAt: p.now.toISOString(), guides: [buildPairGuide(view, "you"), buildPairGuide(view, "partner")], confirmedAgreements, sharedAnswers, extras, includeAnswers: p.includeAnswers, sharedRevisionToken };
      return { ok: true, snapshot };
    });
    return result.ok && source ? source : result.ok ? { ok: false, error: "unavailable" } : result;
  } catch { console.error("Pair PDF source unavailable"); return { ok: false, error: "unavailable" }; }
}
export async function assertPairPdfSnapshotCurrent(db: Database, p: PdfActor, source: PairPdfSource): Promise<PairMapFailure | null> {
  const current = await loadPairPdfSource(db, { ...p, includeAnswers: source.includeAnswers });
  if ("error" in current) return current;
  return current.sharedRevisionToken === source.sharedRevisionToken ? null : { ok: false, error: "stale_version" };
}
