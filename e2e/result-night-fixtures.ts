import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { SELF_ITEMS, parseLibrary } from "../packages/content/src/index";
import { buildPersonalInput, fallbackSections } from "../packages/ai/src/index";
import { PRODUCT_PRICES, scoreItems, stabilityOf, typeCodeOf, type Answer, type TypeCode } from "../packages/core/src/index";
import { createDb, createResult, purchases, saveReport, upsertUserFromIdentity } from "../packages/db/src/index";
import { signSession } from "../apps/web/src/server/auth/tokens";
import { LEGAL_VERSIONS } from "../apps/web/src/lib/legal";

export type ResultNightFixture = { name: string; dir: string; paid: boolean; resultId: string; token: string };

// Локальная БД с настоящими моделями и подписью сессии; production dev-вход остаётся выключенным.
export async function seedResultNightFixtures(): Promise<ResultNightFixture[]> {
  const databaseUrl = process.env.RESULT_QA_DATABASE_URL;
  const secret = process.env.RESULT_QA_SESSION_SECRET;
  if (!databaseUrl || !secret) throw new Error("Set RESULT_QA_DATABASE_URL and RESULT_QA_SESSION_SECRET for local result QA");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname)) throw new Error("Result QA requires a local database");
  const db = createDb(databaseUrl, { maxConnections: 1 });
  const library = parseLibrary(JSON.parse(readFileSync(new URL("../packages/content/src/generated/library.json", import.meta.url), "utf8")));
  const fixtures: ResultNightFixture[] = [];
  for (const profile of [
    { name: "Искра", code: "+-++" as TypeCode, dir: "pmpp" },
    { name: "Тихая хранительница", code: "-+-+" as TypeCode, dir: "mpmp" },
  ]) {
    for (const paid of [false, true]) {
      const scoresWanted = Object.fromEntries(["openness", "conscientiousness", "extraversion", "agreeableness"].map((trait, i) => [trait, profile.code[i] === "+" ? 4 : 2]));
      const answers = Object.fromEntries(SELF_ITEMS.map(item => {
        const keyed = item.trait === "stability" ? 4 : scoresWanted[item.trait]!;
        return [item.id, (item.reversed ? 6-keyed : keyed) as Answer];
      }));
      const scores = scoreItems(SELF_ITEMS, answers);
      const typeCode = typeCodeOf(scores);
      if (typeCode !== profile.code) throw new Error("Unexpected fixture type");
      const owner = await upsertUserFromIdentity(db, { provider: "vk", externalId: `result-qa-${randomUUID()}`, displayName: profile.name, gender: "female" }, { version: LEGAL_VERSIONS.consent, at: new Date() });
      if (!owner.ok) throw new Error("Could not create QA owner");
      const result = await createResult(db, { userId: owner.user.id, answers, scores, typeCode, stability: stabilityOf(scores) });
      if (paid) {
        await db.insert(purchases).values({ userId: owner.user.id, resultId: result.id, product: "full", amountKopecks: PRODUCT_PRICES.full, status: "succeeded", paidAt: new Date() });
        await saveReport(db, { target: { resultId: result.id }, kind: "full", sections: fallbackSections(buildPersonalInput(library, "full", result)), source: "fallback" });
      }
      fixtures.push({ ...profile, paid, resultId: result.id, token: await signSession(owner.user.id, secret) });
    }
  }
  await (db as unknown as { $client: { end(): Promise<void> } }).$client.end();
  return fixtures;
}
