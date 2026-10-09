import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import { seedPair, type Database } from "./testing";
import * as schema from "./schema";
import { acceptPairMapConsent, readPairMap } from "./pair-map-context";
import { confirmPairAgreement, proposePairAgreement } from "./pair-map-agreements";

const url=process.env.PAIR_MAP_PG_QA_DATABASE_URL;
let clientA: ReturnType<typeof postgres> | undefined;
let clientB: ReturnType<typeof postgres> | undefined;
let dbA:Database, dbB:Database, pair:Awaited<ReturnType<typeof seedPair>>;
const now=new Date("2026-10-09T12:00:00Z");
beforeAll(async()=>{
  if(!url) return;
  const parsed=new URL(url);
  if(!["localhost","127.0.0.1"].includes(parsed.hostname)||parsed.pathname!=="/pair_map_qa") throw Error("Concurrency tests require a dedicated local pair_map_qa database");
  clientA=postgres(url,{max:1}); clientB=postgres(url,{max:1});
  const database=drizzle(clientA,{schema});
  await migrate(database,{migrationsFolder:fileURLToPath(new URL("../drizzle",import.meta.url))});
  dbA=database as unknown as Database; dbB=drizzle(clientB,{schema}) as unknown as Database;
});
beforeEach(async()=>{
  if(!url) return;
  pair=await seedPair(dbA);
  await dbA.insert(schema.purchases).values({userId:pair.a.userId,pairId:pair.pairId,product:"pair",status:"succeeded",amountKopecks:39900,paidAt:now});
  for(const userId of [pair.a.userId,pair.b.userId]) await acceptPairMapConsent(dbA,{pairId:pair.pairId,userId,now,version:"2026-10-09-v1"});
});
afterAll(async()=>{await Promise.all([clientA?.end(),clientB?.end()]);});

test.skipIf(!url)("independent PostgreSQL connections reject one simultaneous conflicting proposal",async()=>{
  const actor=(userId:string)=>({pairId:pair.pairId,userId,now,slot:0 as const,expectedRevision:0});
  const results=await Promise.all([
    proposePairAgreement(dbA,{...actor(pair.a.userId),text:"Предложение А"}),
    proposePairAgreement(dbB,{...actor(pair.b.userId),text:"Предложение Б"}),
  ]);
  expect(results.filter(r=>r.ok)).toHaveLength(1);
  expect(results.filter(r=>!r.ok)).toEqual([{ok:false,error:"stale_version"}]);
  const state=await readPairMap(dbA,{pairId:pair.pairId,userId:pair.a.userId,now});
  expect(state.ok&&state.snapshot.agreements[0]?.proposal?.revision).toBe(1);
});
test.skipIf(!url)("independent PostgreSQL confirmations retain both authors exactly once",async()=>{
  await proposePairAgreement(dbA,{pairId:pair.pairId,userId:pair.a.userId,now,slot:0,text:"Общее предложение",expectedRevision:0});
  const actor=(userId:string)=>({pairId:pair.pairId,userId,now,slot:0 as const,expectedRevision:1});
  expect((await Promise.all([confirmPairAgreement(dbA,actor(pair.a.userId)),confirmPairAgreement(dbB,actor(pair.b.userId))])).every(r=>r.ok)).toBe(true);
  await confirmPairAgreement(dbA,actor(pair.a.userId));
  const state=await readPairMap(dbA,{pairId:pair.pairId,userId:pair.a.userId,now});
  expect(state.ok&&state.snapshot.agreements[0]?.proposal).toMatchObject({confirmedByYou:true,confirmedByPartner:true});
});
