import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { stabilityOf, typeCodeOf, type TraitScores } from "@grani/core";
import { acceptPairInvite, getOrCreatePairInvite } from "./pairs";
import { createResult } from "./results";
import type { AuthProvider } from "./schema";
import { createSpace, requestJoin, respondToRequest } from "./together";
import { grantAccessPeriod } from "./together-billing";
import { upsertUserFromIdentity, type KnownGender } from "./users";
import * as schema from "./schema";
import type { Database } from "./types";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

export async function createTestDb(): Promise<Database> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder });
  return db as unknown as Database;
}

const DEFAULT_SCORES = { openness: 60, conscientiousness: 55, extraversion: 70, agreeableness: 65, stability: 40 };

// Пользователь с согласием без результатов — для пространств «Вдвоём» тест не нужен
export async function seedUser(
  db: Database,
  p: { externalId: string; provider?: AuthProvider; displayName?: string; gender?: KnownGender | null },
): Promise<string> {
  const outcome = await upsertUserFromIdentity(
    db,
    { provider: p.provider ?? "telegram", externalId: p.externalId, displayName: p.displayName ?? p.externalId, gender: p.gender ?? null },
    { version: "test", at: new Date("2026-09-17T10:00:00Z") },
  );
  if (!outcome.ok) throw new Error("seed user was not created");
  return outcome.user.id;
}

// Пользователь с согласием и одним результатом — общая подготовка для тестов репозиториев и сервисов
export async function seedUserWithResult(
  db: Database,
  p: { externalId: string; provider?: AuthProvider; displayName?: string; gender?: KnownGender | null; scores?: TraitScores },
): Promise<{ userId: string; resultId: string }> {
  const userId = await seedUser(db, p);
  const scores = p.scores ?? DEFAULT_SCORES;
  const result = await createResult(db, {
    userId,
    answers: Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`ipip-${String(i + 1).padStart(2, "0")}`, 3 as const])),
    scores,
    typeCode: typeCodeOf(scores),
    stability: stabilityOf(scores),
  });
  return { userId, resultId: result.id };
}

const PAIR_B_SCORES = { openness: 45, conscientiousness: 70, extraversion: 30, agreeableness: 60, stability: 40 };

// Активная пара из двух новых пользователей — для тестов разбора пары
export async function seedPair(
  db: Database,
  p: { scoresA?: TraitScores; scoresB?: TraitScores } = {},
): Promise<{ pairId: string; a: { userId: string; resultId: string }; b: { userId: string; resultId: string } }> {
  const suffix = Math.random().toString(36).slice(2, 10);
  const a = await seedUserWithResult(db, { externalId: `pair-a-${suffix}`, displayName: "Аня", scores: p.scoresA });
  const b = await seedUserWithResult(db, { externalId: `pair-b-${suffix}`, displayName: "Борис", scores: p.scoresB ?? PAIR_B_SCORES });
  const { token } = await getOrCreatePairInvite(db, a);
  const outcome = await acceptPairInvite(db, { token, partnerUserId: b.userId, partnerResultId: b.resultId, consentAt: new Date("2026-09-17T12:00:00Z") });
  if (!outcome.ok) throw new Error(`seed pair was not created: ${outcome.reason}`);
  return { pairId: outcome.pairId, a, b };
}

// Активное пространство «Вдвоём» из двух новых пользователей — для тестов оплаты и сервисов
export async function seedTogetherSpace(
  db: Database,
  p: { now?: Date } = {},
): Promise<{ spaceId: string; initiatorId: string; partnerId: string }> {
  const now = p.now ?? new Date("2026-10-05T10:00:00Z");
  const suffix = Math.random().toString(36).slice(2, 10);
  const initiatorId = await seedUser(db, { externalId: `tg-a-${suffix}`, displayName: "Аня" });
  const partnerId = await seedUser(db, { externalId: `tg-b-${suffix}`, displayName: "Борис" });
  const created = await createSpace(db, { userId: initiatorId, now });
  if (!created.ok) throw new Error(`seed space was not created: ${created.reason}`);
  const requested = await requestJoin(db, { token: created.token, userId: partnerId, now });
  if (!requested.ok) throw new Error(`seed request failed: ${requested.reason}`);
  const responded = await respondToRequest(db, { userId: initiatorId, accept: true, now });
  if (!responded.ok) throw new Error(`seed confirmation failed: ${responded.reason}`);
  return { spaceId: created.spaceId, initiatorId, partnerId };
}

// Оплаченный период для активного пространства — для тестов карточек категории main
export async function seedTogetherAccess(db: Database, p: { spaceId: string; userId: string; paidAt?: Date }): Promise<void> {
  const paidAt = p.paidAt ?? new Date("2026-10-05T10:00:00Z");
  const [purchase] = await db
    .insert(schema.purchases)
    .values({ userId: p.userId, product: "together_30d", spaceId: p.spaceId, amountKopecks: 39_900, status: "succeeded", paidAt })
    .returning({ id: schema.purchases.id });
  const granted = await grantAccessPeriod(db, { spaceId: p.spaceId, purchaseId: purchase!.id, paidAt });
  if (!granted.ok) throw new Error(`seed access failed: ${granted.reason}`);
}

export * from "./index";
