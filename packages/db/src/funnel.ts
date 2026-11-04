import { FUNNEL_STEPS, isFunnelStep, type FunnelStep } from "@grani/core";
import { gte, sql } from "drizzle-orm";
import { funnelDaily } from "./schema";
import type { Database } from "./types";

const MOSCOW_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" });

export function funnelDay(now: Date): string {
  return MOSCOW_DAY.format(now);
}

export async function countFunnelStep(db: Database, step: FunnelStep, now: Date): Promise<void> {
  await db
    .insert(funnelDaily)
    .values({ day: funnelDay(now), step, count: 1 })
    .onConflictDoUpdate({ target: [funnelDaily.day, funnelDaily.step], set: { count: sql`${funnelDaily.count} + 1` } });
}

export type FunnelDayRow = { day: string } & Record<FunnelStep, number>;

// Дни от самого нового к старому; шаг без событий за день — ноль
export async function listFunnelDays(db: Database, since: Date): Promise<FunnelDayRow[]> {
  const rows = await db.select().from(funnelDaily).where(gte(funnelDaily.day, funnelDay(since)));
  const days = new Map<string, FunnelDayRow>();
  for (const row of rows) {
    const entry = days.get(row.day) ?? { day: row.day, ...Object.fromEntries(FUNNEL_STEPS.map((step) => [step, 0])) } as FunnelDayRow;
    if (isFunnelStep(row.step)) entry[row.step] = row.count;
    days.set(row.day, entry);
  }
  return [...days.values()].sort((a, b) => b.day.localeCompare(a.day));
}
