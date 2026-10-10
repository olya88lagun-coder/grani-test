import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { eq, inArray } from "drizzle-orm";
import { seedPair, type Database } from "./testing";
import * as schema from "./schema";
import { acceptPairMapConsent, readPairMap } from "./pair-map-context";
import { confirmPairAgreement, proposePairAgreement } from "./pair-map-agreements";

const url=process.env.PAIR_MAP_PG_QA_DATABASE_URL;
let clientA: ReturnType<typeof postgres> | undefined;
let clientB: ReturnType<typeof postgres> | undefined;
let dbA:Database, dbB:Database, pair:Awaited<ReturnType<typeof seedPair>>;
let legacyPair:Awaited<ReturnType<typeof seedPair>>;
let legacyRows:Awaited<ReturnType<typeof readLegacyRows>>;
const now=new Date("2026-10-09T12:00:00Z");
async function readLegacyRows(){
  return {
    pairs:await dbA.select().from(schema.pairs).where(eq(schema.pairs.id,legacyPair.pairId)),
    purchases:await dbA.select().from(schema.purchases).where(eq(schema.purchases.pairId,legacyPair.pairId)),
    results:await dbA.select().from(schema.results).where(inArray(schema.results.id,[legacyPair.a.resultId,legacyPair.b.resultId])),
    users:await dbA.select().from(schema.users).where(inArray(schema.users.id,[legacyPair.a.userId,legacyPair.b.userId])),
  };
}
beforeAll(async()=>{
  if(!url) return;
  const parsed=new URL(url);
  if(!["localhost","127.0.0.1"].includes(parsed.hostname)||parsed.pathname!=="/pair_map_qa") throw Error("Concurrency tests require a dedicated local pair_map_qa database");
  clientA=postgres(url,{max:1}); clientB=postgres(url,{max:1});
  const database=drizzle(clientA,{schema});
  dbA=database as unknown as Database; dbB=drizzle(clientB,{schema}) as unknown as Database;
  // CI gives this suite a fresh disposable database. Never drop an existing schema.
  const [existing]=await clientA`select to_regclass('public.pair_map_consents') as table_name`;
  if(existing?.table_name)throw Error("Upgrade tests require a fresh disposable pair_map_qa database");
  const migrationsFolder=fileURLToPath(new URL("../drizzle",import.meta.url));
  const baseFolder=await mkdtemp(join(tmpdir(),"grani-pair-base-"));
  try{
    const journal=JSON.parse(await readFile(join(migrationsFolder,"meta/_journal.json"),"utf8"));
    journal.entries=journal.entries.filter((entry:{idx:number})=>entry.idx<13);
    await mkdir(join(baseFolder,"meta"));
    await writeFile(join(baseFolder,"meta/_journal.json"),JSON.stringify(journal));
    for(const entry of journal.entries)await cp(join(migrationsFolder,`${entry.tag}.sql`),join(baseFolder,`${entry.tag}.sql`));
    await migrate(database,{migrationsFolder:baseFolder});
    legacyPair=await seedPair(dbA);
    await dbA.insert(schema.purchases).values({userId:legacyPair.a.userId,pairId:legacyPair.pairId,product:"pair",status:"succeeded",amountKopecks:39900,paidAt:now});
    legacyRows=await readLegacyRows();
  }finally{await rm(baseFolder,{recursive:true,force:true});}
  await migrate(database,{migrationsFolder});
});
beforeEach(async()=>{
  if(!url) return;
  pair=await seedPair(dbA);
  await dbA.insert(schema.purchases).values({userId:pair.a.userId,pairId:pair.pairId,product:"pair",status:"succeeded",amountKopecks:39900,paidAt:now});
  for(const userId of [pair.a.userId,pair.b.userId]) await acceptPairMapConsent(dbA,{pairId:pair.pairId,userId,now,version:"2026-10-09-v1"});
});
afterAll(async()=>{await Promise.all([clientA?.end(),clientB?.end()]);});

test.skipIf(!url)("PostgreSQL upgrade preserves existing users, results, paid pair and access for both",async()=>{
  const rows=await readLegacyRows();
  for(const key of ["pairs","purchases","results","users"] as const){
    expect(rows[key]).toHaveLength(key==="results"||key==="users"?2:1);
    expect(rows[key]).toEqual(legacyRows[key]);
  }
  for(const userId of [legacyPair.a.userId,legacyPair.b.userId]){
    const state=await readPairMap(dbA,{pairId:legacyPair.pairId,userId,now});
    expect(state).toMatchObject({ok:true,snapshot:{consentRequired:true}});
  }
});

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
