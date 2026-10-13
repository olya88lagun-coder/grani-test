import { PORTRAIT_SECTIONS, portraitSeeds, stabilityText, traitBlock, typeTexts, type Library } from "@grani/content";
import { TRAITS, traitLevel, type Trait } from "@grani/core";
import type { z } from "zod";
import {
  hasStopWords,
  MAX_HEDGES_PER_CARD,
  MAX_HEDGES_PER_CARD_FINAL,
  mergeReviews,
  reviewStyle,
  RULE_FIX,
  RULE_GENDER,
  RULE_HEDGES,
  RULE_VOICE,
  schemaFailure,
  styleFailure,
  type PartCheck,
} from "./chapter-cards";
import { repeatsAny } from "./chapter-overlap";
import { personalFacts, type PersonalScores } from "./input";
import { COMMON_RULES, type Prompt } from "./prompt";
import { parsePortrait, PORTRAIT_BLOCKS, PortraitModelSchema, type PortraitSections } from "./sections";
import { extractJson } from "./validate";

export type PortraitContext = { library: Library; result: PersonalScores };
export type PortraitModelOutput = z.infer<typeof PortraitModelSchema>;

const RULES = [
  ...COMMON_RULES,
  RULE_VOICE,
  RULE_GENDER,
  RULE_FIX,
  "Не утверждай о прошлом читателя: нельзя писать «ты уже…», «у тебя было…», «ты всегда…», «ты никогда…».",
  RULE_HEDGES,
  "Каждый блок — две-три короткие фразы без списков: одна мысль о том, как черты читателя работают вместе, и один конкретный шаг.",
  "Не пересказывай блоки и общие описания типа: объясняй своими словами, как сочетание черт проявляется в жизни этого человека.",
];

const SHAPE = [
  '{"headline": "главный вывод о человеке, 40–140 знаков",',
  ' "blocks": [{"seed": "id темы из seeds", "text": "короткий текст, 150–350 знаков"}]}',
  `Дай ровно ${PORTRAIT_BLOCKS} объектов в blocks, по одному на тему из seeds, в том же порядке; seed — её id.`,
].join("\n");

const blocksOf = (ctx: PortraitContext): Record<Trait, Record<string, string>> =>
  Object.fromEntries(
    TRAITS.map((trait) => [trait, Object.fromEntries(PORTRAIT_SECTIONS.map((section) => [section, traitBlock(ctx.library, trait, traitLevel(ctx.result.scores[trait]), section)]))]),
  ) as Record<Trait, Record<string, string>>;

// То, что человек уже видел бесплатно на странице результата: новый портрет не должен это пересказывать.
// В запрос эти тексты не передаются, они нужны только проверке
export function freeTexts(ctx: PortraitContext): readonly string[] {
  const types = typeTexts(ctx.library, ctx.result.typeCode);
  return [
    types.short,
    types.long,
    stabilityText(ctx.library, ctx.result.stability),
    ...TRAITS.map((trait) => traitBlock(ctx.library, trait, traitLevel(ctx.result.scores[trait]), "strengths")),
  ];
}

// Источники для проверки на пересказ: бесплатные тексты и блоки, которые модель получила на вход
export function portraitSources(ctx: PortraitContext): readonly string[] {
  return [...freeTexts(ctx), ...Object.values(blocksOf(ctx)).flatMap((sections) => Object.values(sections))];
}

export function buildPortraitPrompt(ctx: PortraitContext): Prompt {
  const seeds = portraitSeeds().map(({ id, title, focus, traits }) => ({ id, title, focus, traits }));
  return {
    system: [...RULES, `Схема ответа:\n${SHAPE}`].join("\n\n"),
    // Во входе только баллы, уровни, темы и блоки: имён, идентификаторов и бесплатных текстов в нём нет
    user: JSON.stringify({ facts: personalFacts(ctx.result), seeds, blocks: blocksOf(ctx) }),
  };
}

const REPEAT_HINT = "Текст повторяет готовые тексты или соседний блок: напиши своими словами, как черты читателя работают вместе.";

export function validatePortrait(raw: string, sources: readonly string[], final = false): PartCheck<PortraitModelOutput> {
  const json = extractJson(raw);
  if (json === undefined) return { ok: false, reason: "not_json" };
  const parsed = PortraitModelSchema.safeParse(json);
  if (!parsed.success) return schemaFailure(parsed.error);
  if (hasStopWords(parsed.data)) return { ok: false, reason: "stop_words" };
  const texts = parsed.data.blocks.map((block) => block.text);
  // Первой идёт фраза-вывод, дальше блоки: индекс блока в strings на единицу больше, чем в texts
  const strings = [parsed.data.headline, ...texts];
  const review = mergeReviews(strings.map((text) => reviewStyle([text], MAX_HEDGES_PER_CARD, MAX_HEDGES_PER_CARD_FINAL, final)));
  if (review.fail.length > 0) return styleFailure(review);
  const expected = portraitSeeds().map((seed) => seed.id);
  if (parsed.data.blocks.some((block, index) => block.seed !== expected[index])) return { ok: false, reason: "seeds" };
  const repeated = strings.some((text, index) => repeatsAny(text, [...sources, ...texts.filter((_, other) => other !== index - 1)]));
  if (repeated && !final) return { ok: false, reason: "repeat", hint: REPEAT_HINT };
  const forgiven = [...review.forgiven, ...(repeated ? ["repeat"] : [])];
  return { ok: true, value: parsed.data, ...(forgiven.length > 0 ? { forgiven } : {}) };
}

export function assemblePortrait(output: PortraitModelOutput): PortraitSections | null {
  const seeds = portraitSeeds();
  return parsePortrait({ version: 1, headline: output.headline, blocks: output.blocks.map((block, index) => ({ seed: block.seed, title: seeds[index]!.title, text: block.text })) });
}
