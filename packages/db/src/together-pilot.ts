import { count, eq, sql } from "drizzle-orm";
import { togetherPilotPasses, type TogetherPilotSource } from "./schema";
import type { Database } from "./types";

export type PilotGrantOutcome = "granted" | "already" | "limit_reached";

// Одна на всех блокировка выдачи пропусков: проверка лимита и вставка не должны пересекаться у одновременных запросов
const PILOT_LOCK_KEY = "together_pilot_passes";

export async function hasPilotPass(db: Database, userId: string): Promise<boolean> {
  const [row] = await db.select({ userId: togetherPilotPasses.userId }).from(togetherPilotPasses).where(eq(togetherPilotPasses.userId, userId)).limit(1);
  return row !== undefined;
}

// Пропуск по коду занимает место в лимите; пропуск по приглашению лимитом не ограничен: его число задают пары, которые уже в пилоте
export async function grantPilotPass(db: Database, p: { userId: string; source: TogetherPilotSource; limit: number; now: Date }): Promise<PilotGrantOutcome> {
  return db.transaction(async (tx): Promise<PilotGrantOutcome> => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${PILOT_LOCK_KEY}))`);
    if (await hasPilotPass(tx, p.userId)) return "already";
    if (p.source === "code") {
      const [used] = await tx.select({ value: count() }).from(togetherPilotPasses).where(eq(togetherPilotPasses.source, "code"));
      if ((used?.value ?? 0) >= p.limit) return "limit_reached";
    }
    await tx.insert(togetherPilotPasses).values({ userId: p.userId, source: p.source, createdAt: p.now });
    return "granted";
  });
}
