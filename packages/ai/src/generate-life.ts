import type { Library } from "@grani/content";
import { blockTexts, partSeeds, validateSituations, type ChapterCardsContext, type ChapterPart, type SituationsPart } from "./chapter-cards";
import { repeatsAny } from "./chapter-overlap";
import type { GenerateLog, ReportWriter } from "./generate";
import { CARD_ATTEMPTS, runPart } from "./generate-chapter";
import type { PersonalScores } from "./input";
import { parseLifeCards, type LifeSections } from "./sections";

type Options = { timeoutMs?: number; attempts?: number; log?: GenerateLog };

function assembleLifeCards(a: SituationsPart, b: SituationsPart): LifeSections | null {
  const situations = [...a.situations, ...b.situations];
  // Одинаковые названия значат, что модель повторила карточку, — такой набор не сохраняем
  if (new Set(situations.map((card) => card.title)).size !== situations.length) return null;
  return parseLifeCards({ version: 1, situations });
}

// Пять карточек «В жизни»: два запроса параллельно (3 + 2 темы). Если какая-то часть не получилась за все попытки,
// возвращается null: запасного текста у вкладки нет, на странице остаётся статичный вариант
export async function generateLifeCards(
  writer: ReportWriter,
  rawCtx: { library: Library; result: PersonalScores },
  rawOptions: Options = {},
): Promise<{ sections: LifeSections; attempts: number } | null> {
  const ctx: ChapterCardsContext = { ...rawCtx, kind: "life" };
  const options: Options = { attempts: CARD_ATTEMPTS, ...rawOptions };
  const idsOf = (part: ChapterPart) => partSeeds("life", part).map((seed) => seed.id);
  const blocks = blockTexts(ctx);
  const [a, firstB] = await Promise.all([
    runPart(writer, "situations_a", ctx, (raw, final) => validateSituations(raw, idsOf("situations_a"), { blocks }, final), options),
    runPart(writer, "situations_b", ctx, (raw, final) => validateSituations(raw, idsOf("situations_b"), { blocks }, final), options),
  ]);
  if (!a || !firstB) return null;

  // Группы пишутся порознь и могут дать одинаковый совет: вторую просим ещё раз, зная советы первой
  let b = firstB;
  const actionsA = a.value.situations.map((card) => card.do);
  if (b.value.situations.some((card) => repeatsAny(card.do, actionsA))) {
    options.log?.("chapter part repeats another", { kind: "life", writer: writer.name, part: "situations_b" });
    const again = await runPart(writer, "situations_b", ctx, (raw, final) => validateSituations(raw, idsOf("situations_b"), { blocks, avoid: actionsA }, final), options);
    if (again) b = { value: again.value, attempts: Math.max(b.attempts, again.attempts) };
  }

  const sections = assembleLifeCards(a.value, b.value);
  if (!sections) {
    options.log?.("chapter cards rejected", { kind: "life", writer: writer.name, reason: "assembly" });
    return null;
  }
  return { sections, attempts: Math.max(a.attempts, b.attempts) };
}
