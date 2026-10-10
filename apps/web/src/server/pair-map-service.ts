import { parsePairMapCommand, type PairMapOutcome } from "@grani/core";
import { acceptPairMapConsent, confirmPairAgreement, deletePairSurvey, proposePairAgreement, readPairMap, retractPairAgreementConfirmation, savePairAgreementDraft, savePairSurvey, type Database } from "@grani/db";

export type PairMapDeps = { db: Database; now: () => Date };
type Actor = { pairId: string; userId: string };
// Driver exceptions can contain SQL parameters. Never log their payload or rethrow it to Next.
async function safely(run: () => Promise<PairMapOutcome>): Promise<PairMapOutcome> {
  try { return await run(); } catch { console.error("Pair map storage unavailable"); return { ok: false, error: "unavailable" }; }
}
export const getPairMap = (deps: PairMapDeps, actor: Actor): Promise<PairMapOutcome> => safely(() => readPairMap(deps.db, { ...actor, now: deps.now() }));
export async function changePairMap(deps: PairMapDeps, p: Actor & { command: unknown }): Promise<PairMapOutcome> {
  const command = parsePairMapCommand(p.command);
  if (!command) return { ok: false, error: "invalid" };
  const actor = { pairId: p.pairId, userId: p.userId, now: deps.now() };
  return safely(() => {
    switch (command.kind) {
      case "consent": return acceptPairMapConsent(deps.db, { ...actor, version: command.version });
      case "survey_draft": case "survey_submit": return savePairSurvey(deps.db, { ...actor, answers: command.answers, expectedRevision: command.expectedRevision, publish: command.kind === "survey_submit" });
      case "survey_delete": return deletePairSurvey(deps.db, { ...actor, expectedRevision: command.expectedRevision });
      case "agreement_draft": return savePairAgreementDraft(deps.db, { ...command, ...actor });
      case "agreement_propose": return proposePairAgreement(deps.db, { ...command, ...actor });
      case "agreement_confirm": return confirmPairAgreement(deps.db, { ...command, ...actor });
      case "agreement_retract": return retractPairAgreementConfirmation(deps.db, { ...command, ...actor });
    }
  });
}
