import {expect,test} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {drizzle} from "drizzle-orm/pglite";
import {migrate} from "drizzle-orm/pglite/migrator";
import {fileURLToPath} from "node:url";
import {cp,mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import {tmpdir} from "node:os";
import {seedUserWithResult,type Database} from "./testing";
import {loadAtlasDraft,writeAtlasDraft} from "./personality-atlas";
import * as schema from "./schema";

test("atlas upgrade preserves existing results and purchases; before/after backups restore",async()=>{
 // No URL or disk data directory: every database in this test is newly created in memory.
 const client=new PGlite(),db=drizzle(client,{schema}) as unknown as Database;
 const migrationsFolder=fileURLToPath(new URL("../drizzle",import.meta.url));
 const prefix=join(tmpdir(),"grani-atlas-upgrade-"),baseFolder=await mkdtemp(prefix);
 const clients:PGlite[]=[client];
 try{
  const journal=JSON.parse(await readFile(join(migrationsFolder,"meta/_journal.json"),"utf8"));journal.entries=journal.entries.filter((entry:{idx:number})=>entry.idx<14);
  await mkdir(join(baseFolder,"meta"));await writeFile(join(baseFolder,"meta/_journal.json"),JSON.stringify(journal));
  for(const entry of journal.entries)await cp(join(migrationsFolder,entry.tag+".sql"),join(baseFolder,entry.tag+".sql"));
  await migrate(db as never,{migrationsFolder:baseFolder});
  const owner=await seedUserWithResult(db,{externalId:"atlas-upgrade-only",displayName:"Условный владелец"});
  await db.insert(schema.purchases).values({userId:owner.userId,resultId:owner.resultId,product:"full",amountKopecks:29900,status:"succeeded",paidAt:new Date("2026-10-10T12:00:00Z")});
  const rows=async(database:Database)=>({users:await database.select().from(schema.users),results:await database.select().from(schema.results),purchases:await database.select().from(schema.purchases)});
  const before=await rows(db),preUpgrade=await client.dumpDataDir();
  await migrate(db as never,{migrationsFolder});expect(await rows(db)).toEqual(before);
  const data={done:Array(7).fill(false),notes:Array(7).fill(""),decision:"Приватная заметка",interaction:["Первая фраза","Вторая фраза","Третья фраза"],memo:{quote:"Сохранённая памятка",items:["1","2","3","4","5"]}};
  expect(await writeAtlasDraft(db,{resultId:owner.resultId,expectedRevision:0,data})).toMatchObject({revision:1,data});
  const postUpgrade=await client.dumpDataDir();
  const restored=new PGlite({loadDataDir:postUpgrade});clients.push(restored);const restoredDb=drizzle(restored,{schema}) as unknown as Database;
  expect(await rows(restoredDb)).toEqual(before);expect(await loadAtlasDraft(restoredDb,owner.resultId)).toMatchObject({revision:1,data});await restored.close();clients.pop();
  const old=new PGlite({loadDataDir:preUpgrade});clients.push(old);const oldDb=drizzle(old,{schema}) as unknown as Database;
  expect(await rows(oldDb)).toEqual(before);const table=await old.query<{name:string|null}>("select to_regclass('public.personality_atlas_drafts')::text as name");expect(table.rows[0]!.name).toBeNull();
  await migrate(oldDb as never,{migrationsFolder});expect(await rows(oldDb)).toEqual(before);expect(await loadAtlasDraft(oldDb,owner.resultId)).toBeNull();
 }finally{
  await Promise.all(clients.map(c=>c.close()));
  if(!resolve(baseFolder).startsWith(resolve(prefix)))throw Error("Unsafe temporary cleanup path");await rm(baseFolder,{recursive:true,force:true});
 }
},30_000);
