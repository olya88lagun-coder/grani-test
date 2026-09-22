import type { ChapterKind, ReportKind } from "@grani/core";
import { z } from "zod";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const list = (item: z.ZodType<string>, min: number, max: number) => z.array(item).min(min).max(max);

// Пределы подобраны так, чтобы в них помещалась и сборка из блоков (блок библиотеки — до 1500 знаков)
const FullSchema = z.strictObject({
  portrait: text(300, 2500),
  strengths: list(text(20, 800), 4, 5),
  blind_spots: z.array(z.strictObject({ text: text(20, 800), tip: text(20, 800) })).min(3).max(4),
  manual: z.strictObject({
    work: list(text(10, 1500), 3, 4),
    fight: list(text(10, 1500), 3, 4),
    annoys: list(text(10, 800), 3, 4),
  }),
});
const FriendsSchema = z.strictObject({ text: text(200, 2500) });
const ChapterSchema = z.strictObject({ text: text(300, 8000), tips: list(text(20, 1500), 3, 5) });
const PairSchema = z.strictObject({
  similar: text(300, 8000),
  differences: text(300, 8000),
  conflicts: text(300, 8000),
  home_money: text(300, 8000),
  support: text(300, 8000),
});

export type FullSections = z.infer<typeof FullSchema>;
export type FriendsSections = z.infer<typeof FriendsSchema>;
export type ChapterSections = z.infer<typeof ChapterSchema>;
export type PairSections = z.infer<typeof PairSchema>;
export type ReportSections = { full: FullSections; friends: FriendsSections; pair: PairSections } & Record<ChapterKind, ChapterSections>;

export const SECTION_SCHEMAS: { readonly [K in ReportKind]: z.ZodType<ReportSections[K]> } = {
  full: FullSchema,
  friends: FriendsSchema,
  chapter_money: ChapterSchema,
  chapter_conflict: ChapterSchema,
  chapter_stress: ChapterSchema,
  chapter_relationships: ChapterSchema,
  pair: PairSchema,
};

export function parseSections<K extends ReportKind>(kind: K, value: unknown): ReportSections[K] | null {
  const parsed = SECTION_SCHEMAS[kind].safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function sectionStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(sectionStrings);
  if (typeof value === "object" && value !== null) return Object.values(value).flatMap(sectionStrings);
  return [];
}
