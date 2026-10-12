import { TRAITS, type ChapterKind, type ReportKind } from "@grani/core";
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

export const SituationSchema = z.strictObject({
  seed: text(2, 40),
  title: text(20, 90),
  scene: text(80, 320),
  why: text(80, 320),
  traits: z.array(z.enum(TRAITS)).min(1).max(2),
  say: list(text(10, 160), 1, 3),
  do: text(40, 260),
});
export const cardsShape = {
  headline: text(40, 140),
  summary: text(150, 500),
  situations: z.array(SituationSchema).min(5).max(6),
  others_see: text(120, 400),
  traps: z.array(z.strictObject({ trap: text(20, 200), instead: text(20, 200) })).length(3),
};
export const ChapterCardsSchema = z.strictObject({ version: z.literal(2), ...cardsShape });
// Формат 1 строгий и не знает поля version, формат 2 требует его — союз однозначен
const ChapterAnySchema = z.union([ChapterSchema, ChapterCardsSchema]);
const PairSchema = z.strictObject({
  similar: text(300, 8000),
  differences: text(300, 8000),
  conflicts: text(300, 8000),
  home_money: text(300, 8000),
  support: text(300, 8000),
});

export type FullSections = z.infer<typeof FullSchema>;
export type FriendsSections = z.infer<typeof FriendsSchema>;
export type ChapterTextSections = z.infer<typeof ChapterSchema>;
export type ChapterCardsSections = z.infer<typeof ChapterCardsSchema>;
export type ChapterSections = ChapterTextSections | ChapterCardsSections;
export type PairSections = z.infer<typeof PairSchema>;
export type ReportSections = { full: FullSections; friends: FriendsSections; pair: PairSections } & Record<ChapterKind, ChapterSections>;

export const SECTION_SCHEMAS: { readonly [K in ReportKind]: z.ZodType<ReportSections[K]> } = {
  full: FullSchema,
  friends: FriendsSchema,
  chapter_money: ChapterAnySchema,
  chapter_conflict: ChapterAnySchema,
  chapter_stress: ChapterAnySchema,
  chapter_relationships: ChapterAnySchema,
  pair: PairSchema,
};

export function parseSections<K extends ReportKind>(kind: K, value: unknown): ReportSections[K] | null {
  const parsed = SECTION_SCHEMAS[kind].safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseChapterCards(value: unknown): ChapterCardsSections | null {
  const parsed = ChapterCardsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function sectionStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(sectionStrings);
  if (typeof value === "object" && value !== null) return Object.values(value).flatMap(sectionStrings);
  return [];
}
