import { combinationKey, type ShortTestScore } from "@grani/core";
import { ATTACHMENT_PAIR_REPORT } from "./attachment-pair-report";
import { ATTACHMENT_REPORT } from "./attachment-report";
import type { ShortPairReportBlocks, ShortReportBlocks, ShortReportExercise, ShortTestDefinition, ShortTestSection } from "./types";

// Только для сервера: тексты платных разборов. Клиентский код импортирует short-tests/index, где их нет
export const SHORT_REPORTS: Readonly<Record<string, ShortReportBlocks>> = { attachment: ATTACHMENT_REPORT };

export const SHORT_PAIR_REPORTS: Readonly<Record<string, ShortPairReportBlocks>> = { attachment: ATTACHMENT_PAIR_REPORT };

export type ShortReport = { readonly title: string; readonly sections: readonly ShortTestSection[]; readonly exercises: readonly ShortReportExercise[] };

// Уровень оси для текстов разбора: середина шире, чем «смешанная» зона результата, — там текст про колебания
export function axisLevel(value: number): "low" | "mid" | "high" {
  if (value < 40) return "low";
  if (value <= 60) return "mid";
  return "high";
}

export function buildShortReport(test: ShortTestDefinition, score: ShortTestScore): ShortReport | null {
  const report = SHORT_REPORTS[test.slug];
  if (!report) return null;
  const byType = report.byType[score.typeKey];
  const exercises = report.exercises[score.typeKey];
  if (!byType || !exercises) throw new Error(`No report blocks for ${test.slug}/${score.typeKey}`);
  const byAxis = test.scoring.axes.map((axis) => {
    const block = report.byAxisLevel[axis]?.[axisLevel(score.axes[axis] ?? 0)];
    if (!block) throw new Error(`No report block for ${test.slug}/${axis}`);
    return block;
  });
  return { title: report.title, sections: [...byType, ...byAxis], exercises };
}

// Разница баллов, начиная с которой партнёры по оси «далеко друг от друга»
const FAR_GAP = 25;

export type ShortPairMember = { readonly name: string; readonly score: ShortTestScore };

export function buildShortPairReport(test: ShortTestDefinition, a: ShortPairMember, b: ShortPairMember): ShortReport | null {
  const report = SHORT_PAIR_REPORTS[test.slug];
  if (!report || !test.pairOffer) return null;
  const key = combinationKey(test.types.map((type) => type.key), a.score.typeKey, b.score.typeKey);
  const combination = report.byCombination[key];
  const typeA = report.byType[a.score.typeKey];
  const typeB = report.byType[b.score.typeKey];
  if (!combination || !typeA || !typeB) throw new Error(`No pair report blocks for ${test.slug}/${key}`);
  // Имя ставится в начало заголовка: так его не нужно склонять
  const named = (name: string, section: ShortTestSection): ShortTestSection => ({ heading: `${name}: ${section.heading.toLowerCase()}`, text: section.text });
  const gaps = test.scoring.axes.map((axis) => {
    const gap = report.axisGap[axis];
    if (!gap) throw new Error(`No pair gap block for ${test.slug}/${axis}`);
    return Math.abs((a.score.axes[axis] ?? 0) - (b.score.axes[axis] ?? 0)) > FAR_GAP ? gap.far : gap.close;
  });
  return {
    title: report.title,
    sections: [combination.dynamics, named(a.name, typeA.inConflict), named(b.name, typeB.inConflict), named(a.name, typeA.needs), named(b.name, typeB.needs), ...gaps, combination.phrases],
    exercises: combination.exercises,
  };
}
