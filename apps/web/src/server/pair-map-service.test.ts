import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createTestDb, seedPair, seedUserWithResult, purchases, leavePair, type Database } from "@grani/db/testing";
let db:Database, pair:Awaited<ReturnType<typeof seedPair>>;
const now=()=>new Date("2026-10-09T12:00:00Z");
beforeEach(async()=>{db=await createTestDb();pair=await seedPair(db)});
afterEach(async()=>{await (db as unknown as {$client:{close():Promise<void>}}).$client.close()});
async function subject(){const m=await import("./pair-map-service").catch(()=>null);expect(m,"Shared map service must exist").not.toBeNull();return m!;}
test("uses real paid membership for read and write and rejects forged authors",async()=>{
  const m=await subject();const deps={db,now};const p={pairId:pair.pairId,userId:pair.a.userId};
  expect(await m.getPairMap(deps,p)).toEqual({ok:false,error:"access_required"});
  await db.insert(purchases).values({...p,product:"pair",status:"succeeded",amountKopecks:39900,paidAt:now()});
  const command={kind:"consent",accepted:true,version:"2026-10-09-v1"};
  expect((await m.changePairMap(deps,{...p,command})).ok).toBe(true);
  expect(await m.changePairMap(deps,{...p,command:{...command,userId:pair.b.userId}})).toEqual({ok:false,error:"invalid"});
  const outsider=await seedUserWithResult(db,{externalId:"outside"});
  expect(await m.getPairMap(deps,{...p,userId:outsider.userId})).toEqual({ok:false,error:"not_found"});
  await leavePair(db,p.pairId,p.userId);
  expect(await m.changePairMap(deps,{...p,command})).toEqual({ok:false,error:"not_found"});
});
test("storage errors never disclose personal SQL parameters",async()=>{
  const m=await subject(); const log=vi.spyOn(console,"error").mockImplementation(()=>{});
  const broken={transaction:()=>Promise.reject(new Error("SQL parameters: PRIVATE-ANSWER"))} as unknown as Database;
  expect(await m.getPairMap({db:broken,now},{pairId:pair.pairId,userId:pair.a.userId})).toEqual({ok:false,error:"unavailable"});
  expect(JSON.stringify(log.mock.calls)).not.toContain("PRIVATE-ANSWER");log.mockRestore();
});
