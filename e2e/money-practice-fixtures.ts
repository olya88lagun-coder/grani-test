import { createDb, createResult, purchases, upsertUserFromIdentity, saveReport } from "../packages/db/src/index";
import { signSession } from "../apps/web/src/server/auth/tokens";
import { readFileSync } from "node:fs";
import { parseLibrary } from "../packages/content/src/index";
import { buildPersonalInput, fallbackSections } from "../packages/ai/src/index";
export async function seedMoneyFixtures() {
  const url = process.env.MONEY_QA_DATABASE_URL, secret = process.env.MONEY_QA_SESSION_SECRET;
  if (!url || !secret || new URL(url).hostname !== "127.0.0.1" || new URL(url).port !== "5451") throw Error("Dedicated local money QA database required: 127.0.0.1:5451");
  const db = createDb(url, { maxConnections: 1 }), fixtures = [];
  const library = parseLibrary(JSON.parse(readFileSync(new URL("../packages/content/src/generated/library.json", import.meta.url), "utf8")));
  try {
    for (const [i, product] of (["chapter_money", "chapters_all", null, null] as const).entries()) {
      const owner = await upsertUserFromIdentity(db, { provider: "vk", externalId: `money-qa-${Date.now()}-${i}`, displayName: i === 0 ? "София · тестовый профиль" : "Тестовый профиль", gender: "female" }, { version: "test", at: new Date() });
      if (!owner.ok) throw Error("Seed failed");
      const scores = i === 0 ? { openness: 85, conscientiousness: 90, extraversion: 25, agreeableness: 35, stability: 65 } : { openness: 20, conscientiousness: 25, extraversion: 80, agreeableness: 80, stability: 30 };
      const result = await createResult(db, { userId: owner.user.id, answers: Object.fromEntries(Array.from({ length: 50 }, (_, j) => [`ipip-${String(j + 1).padStart(2, "0")}`, 3])), scores, typeCode: i === 0 ? "++--" : "--++", stability: i === 0 ? "high" : "low" });
      if (i !== 3) await db.insert(purchases).values({ userId: owner.user.id, resultId: result.id, product: "full", amountKopecks: 29900, status: "succeeded", paidAt: new Date("2026-09-20") });
      if (product) await db.insert(purchases).values({ userId: owner.user.id, resultId: result.id, product, amountKopecks: product === "chapter_money" ? 9900 : 24900, status: "succeeded", paidAt: new Date("2026-09-20") });
      if (i !== 3) await saveReport(db, { target: { resultId: result.id }, kind: "full", sections: fallbackSections(buildPersonalInput(library, "full", result)), source: "fallback" });
      if (i === 0) await saveReport(db, { target: { resultId: result.id }, kind: "chapter_money", sections: fallbackSections(buildPersonalInput(library, "chapter_money", result)), source: "fallback" });
      fixtures.push({ userId: owner.user.id, resultId: result.id, token: await signSession(owner.user.id, secret) });
    }
    return fixtures;
  } finally { await (db as unknown as { $client: { end(): Promise<void> } }).$client.end(); }
}
