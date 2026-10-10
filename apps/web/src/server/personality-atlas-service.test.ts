import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createTestDb, deleteUserData, purchases, seedUserWithResult, type Database } from "@grani/db/testing";
import { buildPersonalityAtlas } from "@/lib/personality-atlas";
import { initialAtlasData, readPersonalAtlas, savePersonalAtlas, validateAtlasData } from "./personality-atlas-service";

let db:Database;
let owner:{userId:string;resultId:string}, other:{userId:string;resultId:string}, unpaid:{userId:string;resultId:string};
const SOFIA={openness:85,conscientiousness:90,extraversion:25,agreeableness:35,stability:65};
const fresh=()=>initialAtlasData(buildPersonalityAtlas(SOFIA));
beforeAll(async()=>{
  db=await createTestDb();
  owner=await seedUserWithResult(db,{externalId:"atlas-owner",scores:SOFIA});
  other=await seedUserWithResult(db,{externalId:"atlas-other"});
  unpaid=await seedUserWithResult(db,{externalId:"atlas-unpaid"});
  await db.insert(purchases).values({userId:owner.userId,resultId:owner.resultId,product:"full",amountKopecks:29900,status:"succeeded",paidAt:new Date()});
});
afterAll(async()=>{await (db as unknown as {$client:{close():Promise<void>}}).$client.close();});

describe("private atlas drafts",()=>{
  test("no draft leaks to another owner or an unpaid owner",async()=>{
    expect(await readPersonalAtlas(db,{userId:other.userId,resultId:owner.resultId})).toEqual({ok:false,error:"not_found"});
    expect(await readPersonalAtlas(db,unpaid)).toEqual({ok:false,error:"access_required"});
    expect(await savePersonalAtlas(db,{...unpaid,expectedRevision:0,data:fresh()})).toEqual({ok:false,error:"access_required"});
    expect(await savePersonalAtlas(db,{userId:other.userId,resultId:owner.resultId,expectedRevision:0,data:fresh()})).toEqual({ok:false,error:"not_found"});
  });
  test("an authenticated paid owner receives profile defaults and a revision zero",async()=>{
    const result=await readPersonalAtlas(db,owner);
    expect(result).toMatchObject({ok:true,draft:{revision:0,data:{done:Array(7).fill(false)}}});
    if(result.ok)expect(result.draft.data.interaction[0]).toContain("Мне удобно, когда у разговора");
  });
  test("writes survive a new read; stale creation and updates cannot overwrite",async()=>{
    const data=fresh();data.notes[0]="Приватная заметка";data.done[0]=true;
    expect(await savePersonalAtlas(db,{...owner,expectedRevision:0,data})).toMatchObject({ok:true,draft:{revision:1,data}});
    expect(await savePersonalAtlas(db,{...owner,expectedRevision:0,data:fresh()})).toEqual({ok:false,error:"conflict"});
    data.memo.quote="Моя отредактированная памятка";
    expect(await savePersonalAtlas(db,{...owner,expectedRevision:1,data})).toMatchObject({ok:true,draft:{revision:2}});
    expect(await savePersonalAtlas(db,{...owner,expectedRevision:1,data:fresh()})).toEqual({ok:false,error:"conflict"});
    expect(await readPersonalAtlas(db,owner)).toMatchObject({ok:true,draft:{revision:2,data:{notes:["Приватная заметка","","","","","",""]}}});
  });
  test("two concurrent writes with one revision produce exactly one success",async()=>{
    const results=await Promise.all([savePersonalAtlas(db,{...owner,expectedRevision:2,data:fresh()}),savePersonalAtlas(db,{...owner,expectedRevision:2,data:fresh()})]);
    expect(results.filter(r=>r.ok)).toHaveLength(1);expect(results.filter(r=>!r.ok&&r.error==="conflict")).toHaveLength(1);
  });
  test("unknown and malformed payloads cannot touch the current draft",async()=>{
    expect(validateAtlasData({...fresh(),unexpected:"public"})).toBeNull();
    expect(validateAtlasData({...fresh(),done:[true]})).toBeNull();
    expect(validateAtlasData({...fresh(),notes:Array(7).fill("x".repeat(2001))})).toBeNull();
    expect(validateAtlasData({...fresh(),interaction:["<script>test</script>","",""]})).not.toBeNull();
    expect(await savePersonalAtlas(db,{...owner,expectedRevision:-1,data:fresh()})).toEqual({ok:false,error:"invalid"});
    expect(await savePersonalAtlas(db,{...owner,expectedRevision:2_147_483_648,data:fresh()})).toEqual({ok:false,error:"invalid"});
    expect(await savePersonalAtlas(db,{...owner,expectedRevision:3,data:{}})).toEqual({ok:false,error:"invalid"});
  });
  test("account deletion cascades to the private draft",async()=>{
    await deleteUserData(db,owner.userId);
    expect(await readPersonalAtlas(db,owner)).toEqual({ok:false,error:"not_found"});
    const {personalityAtlasDrafts}=await import("@grani/db");
    expect(await db.select().from(personalityAtlasDrafts)).toHaveLength(0);
  });
});
