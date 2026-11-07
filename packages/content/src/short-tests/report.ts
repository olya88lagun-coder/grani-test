import type { ShortTestScore } from "@grani/core";
import { ATTACHMENT_REPORT } from "./attachment-report";
import type { ShortReportBlocks, ShortReportExercise, ShortTestDefinition, ShortTestSection } from "./types";

// Только для сервера: тексты платных разборов. Клиентский код импортирует short-tests/index, где их нет
export const SHORT_REPORTS: Readonly<Record<string, ShortReportBlocks>> = { attachment: ATTACHMENT_REPORT };

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
