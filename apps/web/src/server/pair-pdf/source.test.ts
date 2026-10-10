import { afterEach, beforeEach, expect, test } from "vitest";
import { PAIR_MAP_CONSENT_VERSION, PAIR_MAP_QUESTIONS, type SurveyAnswers } from "@grani/core";
import { acceptPairMapConsent, confirmPairAgreement, createTestDb, deletePairSurvey, leavePair, proposePairAgreement, purchases, savePairSurvey, saveReport, seedPair, seedUserWithResult, type Database } from "@grani/db/testing";
import { respondPairPdf } from "../pair-pdf-response";
import { eq } from "drizzle-orm";
let db:Database,pair:Awaited<ReturnType<typeof seedPair>>;
const now=new Date("2026-10-09T12:00:00Z");
beforeEach(async()=>{db=await createTestDb();pair=await seedPair(db)});
afterEach(async()=>{await (db as unknown as {$client:{close():Promise<void>}}).$client.close()});
const actor=(userId=pair.a.userId)=>({pairId:pair.pairId,userId,now});
const answers=(text:string)=>Object.fromEntries(PAIR_MAP_QUESTIONS.map(q=>[q.id,{text,skipped:false}])) as SurveyAnswers;
async function paid(){await db.insert(purchases).values({...actor(),product:"pair",status:"succeeded",amountKopecks:39900,paidAt:now})}
async function subject(){const m=await import("./source").catch(()=>null);expect(m,"Personal PDF source must exist").not.toBeNull();return m!;}
test("paid PDF works without consent or extras and excludes private and unconfirmed text",async()=>{
  const m=await subject();expect(await m.loadPairPdfSource(db,{...actor(),includeAnswers:false})).toEqual({ok:false,error:"access_required"});await paid();
  const source=await m.loadPairPdfSource(db,{...actor(),includeAnswers:false});expect(source).not.toHaveProperty("error");if("error" in source)return;
  expect(source.view.rows).toHaveLength(5);expect(source.view.you.firstName).toBe("Аня");expect(source.guides[0]!.situations).toHaveLength(8);expect(source.extras.state).toBe("preparing");expect(source.confirmedAgreements).toEqual([]);
  await saveReport(db,{target:{pairId:pair.pairId},kind:"pair",sections:{similar:"Готовая глава о сходстве.",differences:"Готовая глава о различиях.",conflicts:"Готовая глава о разговоре.",home_money:"Готовая глава о быте.",support:"Готовая глава о поддержке."},source:"fallback"});
  const ready=await m.loadPairPdfSource(db,{...actor(),includeAnswers:false});if("error" in ready)throw Error("No ready local source");expect(ready.extras.state).toBe("ready");expect(JSON.stringify(ready.extras)).toContain("Готовая глава о сходстве.");
  await acceptPairMapConsent(db,{...actor(),version:PAIR_MAP_CONSENT_VERSION});await acceptPairMapConsent(db,{...actor(pair.b.userId),version:PAIR_MAP_CONSENT_VERSION});
  await savePairSurvey(db,{...actor(),answers:answers("SECRET-A"),expectedRevision:0,publish:true});
  expect(JSON.stringify(await m.loadPairPdfSource(db,{...actor(pair.b.userId),includeAnswers:true}))).not.toContain("SECRET-A");
  await savePairSurvey(db,{...actor(pair.b.userId),answers:answers("SECRET-B"),expectedRevision:0,publish:true});
  expect(JSON.stringify(await m.loadPairPdfSource(db,{...actor(),includeAnswers:false}))).not.toContain("SECRET-A");
  const shared=await m.loadPairPdfSource(db,{...actor(),includeAnswers:true});expect(JSON.stringify(shared)).toContain("SECRET-B");if("error" in shared)return;
  await deletePairSurvey(db,{...actor(pair.b.userId),expectedRevision:1});
  expect(await m.assertPairPdfSnapshotCurrent(db,actor(),shared)).toEqual({ok:false,error:"stale_version"});
  expect(JSON.stringify(await m.loadPairPdfSource(db,{...actor(),includeAnswers:true}))).not.toContain("SECRET-A");
});
test("withdrawal during a delayed render and a refunded entitlement stop the response",async()=>{
  const m=await subject();await paid();
  for(const id of [pair.a.userId,pair.b.userId]){
    await acceptPairMapConsent(db,{...actor(id),version:PAIR_MAP_CONSENT_VERSION});
    await savePairSurvey(db,{...actor(id),answers:answers("SECRET-RACE"),expectedRevision:0,publish:true});
  }
  const result=await respondPairPdf({load:()=>m.loadPairPdfSource(db,{...actor(),includeAnswers:true}),render:async()=>{await deletePairSurvey(db,{...actor(pair.b.userId),expectedRevision:1});return Buffer.from("%PDF-SECRET-RACE")},check:source=>m.assertPairPdfSnapshotCurrent(db,actor(),source)});
  expect(result.status).toBe(409);expect(await result.text()).not.toContain("SECRET-RACE");
  const source=await m.loadPairPdfSource(db,{...actor(),includeAnswers:false});if("error" in source)throw Error("Missing local source");
  await db.update(purchases).set({status:"refunded"}).where(eq(purchases.pairId,pair.pairId));
  expect(await m.assertPairPdfSnapshotCurrent(db,actor(),source)).toEqual({ok:false,error:"access_required"});
});
test("only twice-confirmed versions are exported and leave/outsider/retraction invalidates output",async()=>{
  const m=await subject();await paid();for(const id of [pair.a.userId,pair.b.userId])await acceptPairMapConsent(db,{...actor(id),version:PAIR_MAP_CONSENT_VERSION});
  await proposePairAgreement(db,{...actor(),slot:0,text:"CONFIRMED-CONTRACT",expectedRevision:0});await confirmPairAgreement(db,{...actor(),slot:0,expectedRevision:1});
  expect(JSON.stringify(await m.loadPairPdfSource(db,{...actor(),includeAnswers:false}))).not.toContain("CONFIRMED-CONTRACT");
  await confirmPairAgreement(db,{...actor(pair.b.userId),slot:0,expectedRevision:1});
  const source=await m.loadPairPdfSource(db,{...actor(),includeAnswers:false});expect(JSON.stringify(source)).toContain("CONFIRMED-CONTRACT");if("error" in source)return;
  expect(await m.assertPairPdfSnapshotCurrent(db,actor(),source)).toBeNull();
  await proposePairAgreement(db,{...actor(),slot:0,text:"NEW-CONTRACT",expectedRevision:1});
  expect(await m.assertPairPdfSnapshotCurrent(db,actor(),source)).toEqual({ok:false,error:"stale_version"});
  const outsider=await seedUserWithResult(db,{externalId:"outsider"});expect(await m.loadPairPdfSource(db,{...actor(outsider.userId),includeAnswers:false})).toEqual({ok:false,error:"not_found"});
  await leavePair(db,pair.pairId,pair.b.userId);expect(await m.assertPairPdfSnapshotCurrent(db,actor(),source)).toEqual({ok:false,error:"not_found"});
});
