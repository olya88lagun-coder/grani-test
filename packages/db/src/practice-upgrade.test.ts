import { expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { seedUserWithResult, type Database } from "./testing";
import * as schema from "./schema";
import { loadPracticeDraft, writePracticeDraft } from "./practice";

test("practice migration preserves old purchases, generated JSON and atlas progress; backups restore", async () => {
  const client = new PGlite(), db = drizzle(client, { schema }) as unknown as Database;
  const folder = fileURLToPath(new URL("../drizzle", import.meta.url));
  const prefix = join(tmpdir(), "grani-money-upgrade-"), temporary = await mkdtemp(prefix);
  const clients = [client];
  try {
    const journal = JSON.parse(await readFile(join(folder, "meta/_journal.json"), "utf8"));
    journal.entries = journal.entries.filter((e: { idx: number }) => e.idx < 15);
    await mkdir(join(temporary, "meta")); await writeFile(join(temporary, "meta/_journal.json"), JSON.stringify(journal));
    for (const e of journal.entries) await cp(join(folder, e.tag + ".sql"), join(temporary, e.tag + ".sql"));
    await migrate(db as never, { migrationsFolder: temporary });
    const owner = await seedUserWithResult(db, { externalId: "practice-before-upgrade" });
    await db.insert(schema.purchases).values({ ...owner, product: "chapter_money", amountKopecks: 9900, status: "succeeded", paidAt: new Date("2026-09-20") });
    await db.insert(schema.reports).values({ resultId: owner.resultId, kind: "chapter_money", sections: { text: "Старый текст", tips: ["Первый совет"] }, source: "fallback" });
    await db.insert(schema.personalityAtlasDrafts).values({ resultId: owner.resultId, data: { done: Array(7).fill(false), notes: Array(7).fill("Личная заметка"), decision: "Решение", interaction: ["1", "2", "3"], memo: { quote: "Памятка", items: ["1", "2", "3", "4", "5"] } } });
    const rows = async (database: Database) => ({ results: await database.select().from(schema.results), purchases: await database.select().from(schema.purchases), reports: await database.select().from(schema.reports), atlas: await database.select().from(schema.personalityAtlasDrafts) });
    const before = await rows(db), backup = await client.dumpDataDir();
    await migrate(db as never, { migrationsFolder: folder });
    expect(await rows(db)).toEqual(before);
    const data = { answers: ["a", null, null, null, null, null] as ("a" | null)[], habit: null, startedOn: null, done: Array(7).fill(false), notes: Array(7).fill(""), memo: "Моя новая памятка", reflection: "" };
    await writePracticeDraft(db, { resultId: owner.resultId, key: "money", schemaVersion: 1, expectedRevision: 0, data });
    expect(await rows(db)).toEqual(before);
    const afterBackup = await client.dumpDataDir(), restored = new PGlite({ loadDataDir: afterBackup }); clients.push(restored);
    const restoredDb = drizzle(restored, { schema }) as unknown as Database;
    expect(await rows(restoredDb)).toEqual(before);
    expect(await loadPracticeDraft(restoredDb, owner.resultId, "money")).toMatchObject({ revision: 1, data: { memo: "Моя новая памятка" } });
    const old = new PGlite({ loadDataDir: backup }); clients.push(old);
    expect((await old.query<{ name: string | null }>("select to_regclass('public.practice_drafts')::text as name")).rows[0]!.name).toBeNull();
    const oldDb = drizzle(old, { schema }) as unknown as Database;
    await migrate(oldDb as never, { migrationsFolder: folder }); expect(await rows(oldDb)).toEqual(before);
    expect(await loadPracticeDraft(oldDb, owner.resultId, "money")).toBeNull();
  } finally {
    await Promise.all(clients.map(c => c.close()));
    if (!resolve(temporary).startsWith(resolve(prefix))) throw Error("Unsafe temporary cleanup path");
    await rm(temporary, { recursive: true, force: true });
  }
}, 30_000);
