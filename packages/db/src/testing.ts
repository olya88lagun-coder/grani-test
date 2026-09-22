import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { stabilityOf, typeCodeOf, type TraitScores } from "@grani/core";
import { createResult } from "./results";
import type { AuthProvider } from "./schema";
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

// Пользователь с согласием и одним результатом — общая подготовка для тестов репозиториев и сервисов
export async function seedUserWithResult(
  db: Database,
  p: { externalId: string; provider?: AuthProvider; displayName?: string; gender?: KnownGender | null; scores?: TraitScores },
): Promise<{ userId: string; resultId: string }> {
  const outcome = await upsertUserFromIdentity(
    db,
    { provider: p.provider ?? "telegram", externalId: p.externalId, displayName: p.displayName ?? p.externalId, gender: p.gender ?? null },
    { version: "test", at: new Date("2026-09-17T10:00:00Z") },
  );
  if (!outcome.ok) throw new Error("seed user was not created");
  const scores = p.scores ?? DEFAULT_SCORES;
  const result = await createResult(db, {
    userId: outcome.user.id,
    answers: Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`ipip-${String(i + 1).padStart(2, "0")}`, 3 as const])),
    scores,
    typeCode: typeCodeOf(scores),
    stability: stabilityOf(scores),
  });
  return { userId: outcome.user.id, resultId: result.id };
}

export * from "./index";
