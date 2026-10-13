import { chapterSeeds, CHAPTER_SECTIONS, CHAPTER_TITLES, findStopWords, traitBlock, type ChapterSeed, type Library } from "@grani/content";
import { TRAITS, traitLevel, type ChapterKind } from "@grani/core";
import { z } from "zod";
import { repeatsAny } from "./chapter-overlap";
import { styleProblems } from "./chapter-style";
import { personalFacts, type PersonalScores } from "./input";
import { COMMON_RULES, type Prompt } from "./prompt";
import { cardsShape, parseChapterCards, sectionStrings, SituationSchema, type ChapterCardsSections } from "./sections";
import { extractJson } from "./validate";

export type ChapterPart = "overview" | "situations_a" | "situations_b";
export const CHAPTER_PARTS: readonly ChapterPart[] = ["overview", "situations_a", "situations_b"];
export type ChapterCardsContext = { library: Library; kind: ChapterKind; result: PersonalScores };

const SITUATIONS_PER_PART = 3;
// Оговорок («может», «возможно») на последней попытке разрешено больше: лучше мягкий текст, чем запасной
const MAX_HEDGES_PER_CARD = 1;
const MAX_HEDGES_OVERVIEW = 2;
const MAX_HEDGES_PER_CARD_FINAL = 3;
const MAX_HEDGES_OVERVIEW_FINAL = 4;

export function partSeeds(kind: ChapterKind, part: ChapterPart): readonly ChapterSeed[] {
  const seeds = chapterSeeds(kind);
  if (part === "overview") return [];
  return part === "situations_a" ? seeds.slice(0, SITUATIONS_PER_PART) : seeds.slice(SITUATIONS_PER_PART);
}

const RULES = [
  ...COMMON_RULES,
  "Пиши по-русски, на «ты», обращаясь к одному человеку.",
  "Текст должен подходить читателю любого пола: не используй формы, которые зависят от рода («ты взял», «я рад», «ты открыт», «я готов»); пиши в настоящем времени и безлично («ты открываешься новому», «мне нужно время», «давай вернёмся к разговору»).",
  "Ситуации — это примеры («например, в разговоре возникла неловкая пауза»), а не факты о читателе: нельзя писать «ты уже…», «у тебя было…», «ты всегда…», «ты никогда…».",
  "«Что сказать» — готовые фразы, которые человек может произнести сразу, без оговорок.",
  "Не более одной оговорки («может», «возможно», «можно сравнить») на карточку: пиши прямо, как опытный редактор.",
  "Не пересказывай блоки слово в слово: объясняй, почему так получается, и предлагай одно конкретное действие.",
  "«Что сделать» — своё действие для именно этой ситуации: не копируй советы из blocks и не повторяй действия других карточек; называй срок, сумму или число, если это уместно.",
];

const OVERVIEW_SHAPE = [
  '{"headline": "главный вывод о человеке в этой сфере, 40–140 знаков",',
  ' "summary": "2–3 предложения о том, как человек обращается с этой сферой, 150–500 знаков",',
  ' "others_see": "как это видят близкие, 120–400 знаков",',
  ' "traps": [{"trap": "типичная ловушка, 20–200 знаков", "instead": "что делать вместо, 20–200 знаков"}, {"trap": "…", "instead": "…"}, {"trap": "…", "instead": "…"}]}',
  "Количество ловушек соблюдай строго: traps — ровно 3 объекта.",
].join("\n");

const SITUATIONS_SHAPE = [
  '{"situations": [{"seed": "id темы из seeds", "title": "название ситуации, 10–90 знаков",',
  ' "scene": "пример ситуации, в которой читатель узнает себя, 50–320 знаков",',
  ' "why": "почему так: свяжи одну-две черты читателя, 50–320 знаков",',
  ' "traits": ["openness"], "say": ["1–3 готовые фразы, по 10–160 знаков"],',
  ' "do": "одно конкретное действие, 40–260 знаков"}]}',
  "Дай по одному объекту на каждую тему из seeds, в том же порядке; seed — её id.",
  `traits — только из: ${TRAITS.join(", ")}.`,
].join("\n");

const blocksOf = (ctx: ChapterCardsContext): Record<string, string> =>
  Object.fromEntries(TRAITS.map((trait) => [trait, traitBlock(ctx.library, trait, traitLevel(ctx.result.scores[trait]), CHAPTER_SECTIONS[ctx.kind])]));

// Готовые тексты библиотеки, которые модель получает на вход: с ними сверяются советы в ответе
export const blockTexts = (ctx: ChapterCardsContext): readonly string[] => Object.values(blocksOf(ctx));

export function buildChapterPartPrompt(part: ChapterPart, ctx: ChapterCardsContext): Prompt {
  const blocks = blocksOf(ctx);
  const seeds = partSeeds(ctx.kind, part).map(({ id, title, focus, traits }) => ({ id, title, focus, traits }));
  return {
    system: [...RULES, `Схема ответа:\n${part === "overview" ? OVERVIEW_SHAPE : SITUATIONS_SHAPE}`].join("\n\n"),
    // Во входе только баллы, уровни, темы и блоки — имён и идентификаторов в нём нет
    user: JSON.stringify({ chapter: CHAPTER_TITLES[ctx.kind], facts: personalFacts(ctx.result), seeds, blocks }),
  };
}

const OverviewSchema = z.strictObject({ headline: cardsShape.headline, summary: cardsShape.summary, others_see: cardsShape.others_see, traps: cardsShape.traps });
const SituationsSchema = z.strictObject({ situations: z.array(SituationSchema).min(1).max(SITUATIONS_PER_PART) });
export type OverviewPart = z.infer<typeof OverviewSchema>;
export type SituationsPart = z.infer<typeof SituationsSchema>;
export type PartFailure = "not_json" | "schema" | "stop_words" | "style" | "seeds" | "repeat";
// detail есть у ошибки схемы (пути полей и пределы) и у ошибки стиля (названия нарушений); текста ответа в нём нет
export type PartCheck<T> = { ok: true; value: T } | { ok: false; reason: PartFailure; detail?: string };

const MAX_DETAIL_ISSUES = 5;

function schemaFailure(error: z.ZodError): { ok: false; reason: "schema"; detail: string } {
  const detail = error.issues
    .slice(0, MAX_DETAIL_ISSUES)
    .map((issue) => {
      const limit = "maximum" in issue ? `<=${String(issue.maximum)}` : "minimum" in issue ? `>=${String(issue.minimum)}` : "";
      const keys = issue.code === "unrecognized_keys" ? `(${issue.keys.join(",")})` : "";
      return `${issue.path.join(".") || "root"}:${issue.code}${limit}${keys}`;
    })
    .join("; ");
  return { ok: false, reason: "schema", detail };
}

const hasStopWords = (value: unknown) => sectionStrings(value).some((text) => findStopWords(text).length > 0);

function styleFailure(problems: readonly string[]): { ok: false; reason: "style"; detail: string } {
  return { ok: false, reason: "style", detail: problems.join(",") };
}

export function validateOverview(raw: string, final = false, guard: RepeatGuard = { blocks: [] }): PartCheck<OverviewPart> {
  const json = extractJson(raw);
  if (json === undefined) return { ok: false, reason: "not_json" };
  const parsed = OverviewSchema.safeParse(json);
  if (!parsed.success) return schemaFailure(parsed.error);
  if (hasStopWords(parsed.data)) return { ok: false, reason: "stop_words" };
  const overviewProblems = styleProblems(sectionStrings(parsed.data), final ? MAX_HEDGES_OVERVIEW_FINAL : MAX_HEDGES_OVERVIEW);
  if (overviewProblems.length > 0) return styleFailure(overviewProblems);
  // «Вместо этого» из ловушек не должно быть готовым советом библиотеки или дословным советом карточки
  if (!final && parsed.data.traps.some((trap) => repeatsAny(trap.instead, [...guard.blocks, ...(guard.avoid ?? [])]))) return { ok: false, reason: "repeat" };
  return { ok: true, value: parsed.data };
}

// blocks — тексты библиотеки, avoid — советы соседней группы; на последней попытке повторы прощаются: лучше повтор, чем запасной текст
export type RepeatGuard = { blocks: readonly string[]; avoid?: readonly string[] };

export function validateSituations(raw: string, expectedSeeds: readonly string[], guard: RepeatGuard = { blocks: [] }, final = false): PartCheck<SituationsPart> {
  const json = extractJson(raw);
  if (json === undefined) return { ok: false, reason: "not_json" };
  const parsed = SituationsSchema.safeParse(json);
  if (!parsed.success) return schemaFailure(parsed.error);
  if (hasStopWords(parsed.data)) return { ok: false, reason: "stop_words" };
  const cardProblems = [...new Set(parsed.data.situations.flatMap((card) => styleProblems(sectionStrings(card), final ? MAX_HEDGES_PER_CARD_FINAL : MAX_HEDGES_PER_CARD)))];
  if (cardProblems.length > 0) return styleFailure(cardProblems);
  const seeds = parsed.data.situations.map((card) => card.seed);
  if (seeds.length !== expectedSeeds.length || seeds.some((seed, index) => seed !== expectedSeeds[index])) return { ok: false, reason: "seeds" };
  if (!final && hasRepeatedAction(parsed.data, guard)) return { ok: false, reason: "repeat" };
  return { ok: true, value: parsed.data };
}

function hasRepeatedAction(part: SituationsPart, guard: RepeatGuard): boolean {
  const actions = part.situations.map((card) => card.do);
  return actions.some((action, index) => repeatsAny(action, [...guard.blocks, ...(guard.avoid ?? []), ...actions.filter((_, other) => other !== index)]));
}

export function assembleChapterCards(overview: OverviewPart, a: SituationsPart, b: SituationsPart): ChapterCardsSections | null {
  const situations = [...a.situations, ...b.situations];
  // Одинаковые названия значат, что модель повторила карточку, — такую главу не сохраняем
  if (new Set(situations.map((card) => card.title)).size !== situations.length) return null;
  return parseChapterCards({ version: 2, ...overview, situations });
}
