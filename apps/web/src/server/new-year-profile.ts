import { getLatestResultId, getResultForOwner, type Database } from "@grani/db";
import type { TraitScores } from "@grani/core";
import { validProfile } from "@/lib/new-year-2027";

export type YearProfile = { status: "available"; scores: TraitScores } | { status: "guest" | "missing" | "unavailable" };

export async function getYearProfile(db: Database, userId: string | null): Promise<YearProfile> {
  if (!userId) return { status: "guest" };
  const id = await getLatestResultId(db, userId);
  const result = id ? await getResultForOwner(db, id, userId) : null;
  return result && validProfile(result.scores) ? { status: "available", scores: result.scores } : { status: "missing" };
}
