import { afterEach, beforeEach, expect, test } from "vitest";
import { createTestDb, seedPair, seedUserWithResult, purchases, leavePair, deleteUserData, type Database } from "./testing";

let db: Database;
let pair: Awaited<ReturnType<typeof seedPair>>;
const now = new Date("2026-10-09T12:00:00Z");
const ids = ["conflict", "home", "money", "social", "closeness", "support", "plans", "decisions"];
const answers = (text = "Ответ") => Object.fromEntries(ids.map(id => [id, { text, skipped: false }]));

async function module() {
  const context = await import("./pair-map-context").catch(() => null);
  expect(context, "Shared pair data service must exist").not.toBeNull();
  const survey = await import("./pair-map-survey");
  const agreements = await import("./pair-map-agreements");
  return { ...context!, ...survey, ...agreements };
}
const actor = (userId = pair.a.userId) => ({ pairId: pair.pairId, userId, now });
async function paid() { await db.insert(purchases).values({ userId: pair.a.userId, pairId: pair.pairId, product: "pair", status: "succeeded", amountKopecks: 39900, paidAt: now }); }
async function consent(userId = pair.a.userId) { const m=await module(); return m.acceptPairMapConsent(db, { ...actor(userId), version: "2026-10-09-v1" }); }
function snapshot(result: { ok: boolean; snapshot?: unknown }) { expect(result.ok).toBe(true); return result.snapshot as import("@grani/core").PairMapSnapshot; }

beforeEach(async () => { db = await createTestDb(); pair = await seedPair(db); });
afterEach(async () => { await (db as unknown as { $client: { close(): Promise<void> } }).$client.close(); });

test("requires paid active membership and consent before saving private text", async () => {
  const m=await module();
  expect(await m.readPairMap(db,actor())).toEqual({ok:false,error:"access_required"});
  await paid();
  const outsider=await seedUserWithResult(db,{externalId:"outsider"});
  expect(await m.readPairMap(db,actor(outsider.userId))).toEqual({ok:false,error:"not_found"});
  expect(await m.savePairSurvey(db,{...actor(),answers:answers() as never,expectedRevision:0,publish:false})).toEqual({ok:false,error:"consent_required"});
  await consent();
  expect((await m.savePairSurvey(db,{...actor(),answers:answers() as never,expectedRevision:0,publish:false})).ok).toBe(true);
  await leavePair(db,pair.pairId,pair.b.userId);
  expect(await m.readPairMap(db,actor())).toEqual({ok:false,error:"not_found"});
});
test("keeps partner text absent until both publish and closes disclosure after deletion", async () => {
  const m=await module(); await paid(); await consent(); await consent(pair.b.userId);
  let a=snapshot(await m.savePairSurvey(db,{...actor(),answers:answers("SECRET_A") as never,expectedRevision:0,publish:false}));
  expect(JSON.stringify(await m.readPairMap(db,actor(pair.b.userId)))).not.toContain("SECRET_A");
  a=snapshot(await m.savePairSurvey(db,{...actor(),answers:answers("SECRET_A") as never,expectedRevision:a.survey.mine.revision,publish:true}));
  expect(JSON.stringify(await m.readPairMap(db,actor(pair.b.userId)))).not.toContain("SECRET_A");
  snapshot(await m.savePairSurvey(db,{...actor(pair.b.userId),answers:answers("SECRET_B") as never,expectedRevision:0,publish:true}));
  expect(JSON.stringify(await m.readPairMap(db,actor(pair.b.userId)))).toContain("SECRET_A");
  expect(JSON.stringify(await m.readPairMap(db,actor()))).toContain("SECRET_B");
  a=snapshot(await m.deletePairSurvey(db,{...actor(),expectedRevision:a.survey.mine.revision}));
  expect(JSON.stringify(await m.readPairMap(db,actor()))).not.toContain("SECRET_B");
  const oldRevision=a.survey.mine.revision;
  a=snapshot(await m.savePairSurvey(db,{...actor(),answers:answers("NEW_A") as never,expectedRevision:oldRevision,publish:true}));
  expect(await m.deletePairSurvey(db,{...actor(),expectedRevision:oldRevision})).toEqual({ok:false,error:"stale_version"});
  expect(JSON.stringify(a)).toContain("NEW_A");
});
test("a private edit keeps the previous publication and unchanged retries are idempotent", async () => {
  const m=await module(); await paid(); await consent(); await consent(pair.b.userId);
  let a=snapshot(await m.savePairSurvey(db,{...actor(),answers:answers("OLD_A") as never,expectedRevision:0,publish:true}));
  const initial=a.survey.mine.revision;
  const retry=snapshot(await m.savePairSurvey(db,{...actor(),answers:answers("OLD_A") as never,expectedRevision:0,publish:true}));
  expect(retry.survey.mine.revision).toBe(initial);
  await m.savePairSurvey(db,{...actor(pair.b.userId),answers:answers("B") as never,expectedRevision:0,publish:true});
  a=snapshot(await m.savePairSurvey(db,{...actor(),answers:answers("PRIVATE_A") as never,expectedRevision:initial,publish:false}));
  const b=JSON.stringify(await m.readPairMap(db,actor(pair.b.userId)));
  expect(b).toContain("OLD_A"); expect(b).not.toContain("PRIVATE_A");
  expect(await m.savePairSurvey(db,{...actor(),answers:answers("LOST") as never,expectedRevision:initial,publish:false})).toEqual({ok:false,error:"stale_version"});
});
test("only two confirmations of the same current version create a shared agreement", async () => {
  const m=await module(); await paid(); await consent(); await consent(pair.b.userId);
  let a=snapshot(await m.proposePairAgreement(db,{...actor(),slot:0,text:"Берём паузу на 20 минут.",expectedRevision:0}));
  expect(a.agreements[0]!.proposal).toMatchObject({revision:1,confirmedByYou:false,confirmedByPartner:false});
  a=snapshot(await m.confirmPairAgreement(db,{...actor(),slot:0,expectedRevision:1}));
  expect(a.agreements[0]!.proposal).toMatchObject({confirmedByYou:true,confirmedByPartner:false});
  let b=snapshot(await m.confirmPairAgreement(db,{...actor(pair.b.userId),slot:0,expectedRevision:1}));
  expect(b.agreements[0]!.proposal).toMatchObject({confirmedByYou:true,confirmedByPartner:true});
  a=snapshot(await m.proposePairAgreement(db,{...actor(),slot:0,text:"Берём паузу на 20 минут.",expectedRevision:0}));
  expect(a.agreements[0]!.proposal).toMatchObject({revision:1,confirmedByYou:true,confirmedByPartner:true});
  a=snapshot(await m.proposePairAgreement(db,{...actor(),slot:0,text:"Берём паузу на 30 минут.",expectedRevision:1}));
  expect(a.agreements[0]!.proposal).toMatchObject({revision:2,confirmedByYou:false,confirmedByPartner:false});
  expect(await m.confirmPairAgreement(db,{...actor(pair.b.userId),slot:0,expectedRevision:1})).toEqual({ok:false,error:"stale_version"});
  await m.confirmPairAgreement(db,{...actor(),slot:0,expectedRevision:2});
  b=snapshot(await m.confirmPairAgreement(db,{...actor(pair.b.userId),slot:0,expectedRevision:2}));
  b=snapshot(await m.retractPairAgreementConfirmation(db,{...actor(pair.b.userId),slot:0,expectedRevision:2}));
  expect(b.agreements[0]!.proposal).toMatchObject({confirmedByYou:false,confirmedByPartner:true});
});
test("never shares drafts and existing account deletion removes all map text", async () => {
  const m=await module(); await paid(); await consent(); await consent(pair.b.userId);
  snapshot(await m.savePairAgreementDraft(db,{...actor(),slot:1,text:"PRIVATE_DRAFT",expectedRevision:0}));
  expect(JSON.stringify(await m.readPairMap(db,actor(pair.b.userId)))).not.toContain("PRIVATE_DRAFT");
  await m.proposePairAgreement(db,{...actor(),slot:0,text:"SHARED_TEXT",expectedRevision:0});
  await deleteUserData(db,pair.a.userId,now);
  expect(await m.readPairMap(db,actor(pair.b.userId))).toEqual({ok:false,error:"not_found"});
  const schema=await import("./schema");
  expect(await db.select().from(schema.pairMapAgreementDrafts)).toEqual([]);
  expect(await db.select().from(schema.pairMapAgreements)).toEqual([]);
  expect(await db.select().from(schema.pairMapConsents)).toEqual([]);
  expect((await db.select().from(purchases)).length).toBe(1);
});
test("upgrades an old consent and keeps the original time of an unchanged acceptance", async () => {
  const m=await module(); await paid();
  const {pairMapConsents}=await import("./schema");
  await db.insert(pairMapConsents).values({pairId:pair.pairId,userId:pair.a.userId,version:"old",acceptedAt:new Date("2026-01-01T00:00:00Z")});
  await consent();
  expect(snapshot(await m.readPairMap(db,actor())).consentRequired).toBe(false);
  await m.acceptPairMapConsent(db,{...actor(),now:new Date("2026-10-10T00:00:00Z"),version:"2026-10-09-v1"});
  const [record]=await db.select().from(pairMapConsents);
  expect(record?.acceptedAt.toISOString()).toBe(now.toISOString());
});
