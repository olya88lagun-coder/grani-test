import { readFileSync } from "node:fs";
import { parseLibrary } from "../packages/content/src/index";
import { buildFriendsInput, buildPairInput, buildPersonalInput, fallbackSections } from "../packages/ai/src/index";
import { CHAPTER_KINDS, compareWithFriends, PRODUCT_PRICES } from "../packages/core/src/index";
import { acceptPairInvite, createDb, getOrCreatePairInvite, getResult, purchases, saveReport } from "../packages/db/src/index";
import { seedResultNightFixtures, type ResultNightFixture } from "./result-night-fixtures";

export type ReportNightFixture = ResultNightFixture & { state: "ready" | "preparing" };
export type PairNightFixture = { pairId: string; state: "ready" | "preparing" | "available"; members: ResultNightFixture[] };

// Explicit local QA database only. The production server keeps dev login and fake payments disabled.
export async function seedReportNightFixtures() {
  const url = process.env.RESULT_QA_DATABASE_URL;
  if (!url || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) throw new Error("Report QA requires a local database");
  const first = await seedResultNightFixtures();
  const second = await seedResultNightFixtures();
  const db = createDb(url, { maxConnections: 1 });
  const library = parseLibrary(JSON.parse(readFileSync(new URL("../packages/content/src/generated/library.json", import.meta.url), "utf8")));
  const resultRow = async (fixture: ResultNightFixture) => {
    const row = await getResult(db, fixture.resultId);
    if (!row?.userId) throw new Error("Missing fixture result");
    return row;
  };
  const ready = first.filter(fixture => fixture.paid);
  const preparing = first.find(fixture => !fixture.paid && fixture.name === "Искра")!;
  const unpaid = first.find(fixture => !fixture.paid && fixture.name !== "Искра")!;
  const preparingRow = await resultRow(preparing);
  await db.insert(purchases).values({ userId: preparingRow.userId, resultId: preparing.resultId, product: "full", amountKopecks: PRODUCT_PRICES.full, status: "succeeded", paidAt: new Date() });
  const longRow = await resultRow(ready.find(fixture => fixture.name !== "Искра")!);
  await db.insert(purchases).values({ userId: longRow.userId, resultId: longRow.id, product: "chapters_all", amountKopecks: PRODUCT_PRICES.chapters_all, status: "succeeded", paidAt: new Date() });
  for (const kind of CHAPTER_KINDS) {
    await saveReport(db, { target: { resultId: longRow.id }, kind, sections: fallbackSections(buildPersonalInput(library, kind, longRow)), source: "fallback" });
  }
  const comparison = compareWithFriends(longRow.scores, [longRow.scores, longRow.scores, longRow.scores])!;
  await saveReport(db, { target: { resultId: longRow.id }, kind: "friends", sections: fallbackSections(buildFriendsInput(longRow, comparison)), source: "fallback" });
  const pairs: PairNightFixture[] = [];
  const configurations = [
    { state: "ready" as const, members: ready },
    { state: "preparing" as const, members: first.filter(fixture => !fixture.paid) },
    { state: "available" as const, members: second.filter(fixture => !fixture.paid) },
  ];
  for (const configuration of configurations) {
    const [a, b] = await Promise.all(configuration.members.map(resultRow));
    const invite = await getOrCreatePairInvite(db, { userId: a.userId!, resultId: a.id });
    const accepted = await acceptPairInvite(db, { token: invite.token, partnerUserId: b.userId!, partnerResultId: b.id, consentAt: new Date() });
    if (!accepted.ok) throw new Error("Could not create local QA pair");
    if (configuration.state !== "available") {
      await db.insert(purchases).values({ userId: a.userId, pairId: accepted.pairId, product: "pair", amountKopecks: PRODUCT_PRICES.pair, status: "succeeded", paidAt: new Date() });
    }
    if (configuration.state === "ready") {
      await saveReport(db, { target: { pairId: accepted.pairId }, kind: "pair", sections: fallbackSections(buildPairInput(library, a.scores, b.scores)), source: "fallback" });
    }
    pairs.push({ ...configuration, pairId: accepted.pairId });
  }
  await (db as unknown as { $client: { end(): Promise<void> } }).$client.end();
  return { reports: [...ready.map(fixture => ({ ...fixture, state: "ready" as const })), { ...preparing, state: "preparing" as const }], pairs, unpaid };
}
