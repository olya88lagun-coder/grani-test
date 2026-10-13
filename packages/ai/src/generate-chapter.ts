import {
  assembleChapterCards,
  buildChapterPartPrompt,
  CHAPTER_PARTS,
  partSeeds,
  validateOverview,
  validateSituations,
  type ChapterCardsContext,
  type ChapterPart,
  type PartCheck,
} from "./chapter-cards";
import { completeWithTimeout, GENERATION_ATTEMPTS, GENERATION_TIMEOUT_MS, TimeoutError, type GenerateLog, type ReportWriter } from "./generate";
import type { ChapterCardsSections } from "./sections";

type Options = { timeoutMs?: number; attempts?: number; log?: GenerateLog };
type PartResult<T> = { value: T; attempts: number };

async function runPart<T>(writer: ReportWriter, part: ChapterPart, ctx: ChapterCardsContext, check: (raw: string) => PartCheck<T>, options: Options): Promise<PartResult<T> | null> {
  const prompt = buildChapterPartPrompt(part, ctx);
  const attempts = options.attempts ?? GENERATION_ATTEMPTS;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let reason: string;
    let detail: string | undefined;
    try {
      const checked = check(await completeWithTimeout(writer, prompt, options.timeoutMs ?? GENERATION_TIMEOUT_MS));
      if (checked.ok) return { value: checked.value, attempts: attempt };
      reason = checked.reason;
      detail = checked.detail;
    } catch (error) {
      reason = error instanceof TimeoutError ? "timeout" : `error: ${String(error)}`;
    }
    // Текст ответа в лог не пишется: в нём может оказаться то, что проверка как раз не пропустила
    options.log?.("chapter part rejected", { kind: ctx.kind, writer: writer.name, part, attempt, reason, ...(detail ? { detail } : {}) });
  }
  return null;
}

// Три части идут параллельно: так глава укладывается во время одной задачи, а сбой одной части не портит остальные.
// Если какая-то часть не получилась за все попытки, возвращается null — вызывающий соберёт главу из блоков
export async function generateChapterCards(writer: ReportWriter, ctx: ChapterCardsContext, options: Options = {}): Promise<{ sections: ChapterCardsSections; attempts: number } | null> {
  const [overviewPart, partA, partB] = CHAPTER_PARTS;
  const idsOf = (part: ChapterPart) => partSeeds(ctx.kind, part).map((seed) => seed.id);
  const [overview, a, b] = await Promise.all([
    runPart(writer, overviewPart!, ctx, validateOverview, options),
    runPart(writer, partA!, ctx, (raw) => validateSituations(raw, idsOf(partA!)), options),
    runPart(writer, partB!, ctx, (raw) => validateSituations(raw, idsOf(partB!)), options),
  ]);
  if (!overview || !a || !b) return null;
  const sections = assembleChapterCards(overview.value, a.value, b.value);
  if (!sections) {
    options.log?.("chapter cards rejected", { kind: ctx.kind, writer: writer.name, reason: "assembly" });
    return null;
  }
  return { sections, attempts: Math.max(overview.attempts, a.attempts, b.attempts) };
}
