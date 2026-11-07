import { isShortTestComplete, scoreShortTest, type Answers, type ShortTestScore } from "@grani/core";
import type { ShortTestAxisInfo, ShortTestDefinition, ShortTestType } from "@grani/content/short-tests";

// Результат короткого теста живёт только в браузере: на сервер ответы не уходят
export const SHORT_RESULT_VERSION = 1;

export type StoredShortResult = { v: typeof SHORT_RESULT_VERSION; slug: string; answers: Answers; at: string };

export function shortResultStorageKey(slug: string): string {
  return `grani:short:${slug}:result`;
}

export function shortProgressStorageKey(slug: string): string {
  return `grani:short:${slug}:progress`;
}

export function serializeShortResult(slug: string, answers: Answers, at: Date): string {
  const stored: StoredShortResult = { v: SHORT_RESULT_VERSION, slug, answers, at: at.toISOString() };
  return JSON.stringify(stored);
}

// Любая порча, чужая версия или чужой тест — null: страница просто покажет тест заново
export function parseStoredShortResult(raw: string | null, test: ShortTestDefinition): ShortTestScore | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { v, slug, answers } = parsed as Partial<StoredShortResult>;
    if (v !== SHORT_RESULT_VERSION || slug !== test.slug) return null;
    if (typeof answers !== "object" || answers === null || Array.isArray(answers)) return null;
    if (!isShortTestComplete(test.scoring, answers)) return null;
    return scoreShortTest(test.scoring, answers);
  } catch {
    return null;
  }
}

export type ShortResultAxis = { info: ShortTestAxisInfo; value: number; mixed: boolean; text: string };
export type ShortResultView = { type: ShortTestType; axes: ShortResultAxis[] };

export function shortResultView(test: ShortTestDefinition, score: ShortTestScore): ShortResultView {
  const type = test.types.find((t) => t.key === score.typeKey);
  if (!type) throw new Error(`Unknown type ${score.typeKey} for test ${test.slug}`);
  const axes = test.axes.map((info) => {
    const value = score.axes[info.key] ?? 0;
    const mixed = score.mixedAxes.includes(info.key);
    const text = mixed ? info.mixed : value >= test.scoring.threshold ? info.high : info.low;
    return { info, value, mixed, text };
  });
  return { type, axes };
}
