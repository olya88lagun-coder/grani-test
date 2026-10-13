import { parseSections, type LifeSections } from "@grani/ai";
import type { ReportRecord } from "@grani/db";

// Повреждённый или устаревший отчёт равен отсутствующему: страница покажет статичные сценарии, а не упадёт
export function parseLifeReport(report: Pick<ReportRecord, "sections"> | null | undefined): LifeSections | null {
  return report ? parseSections("life", report.sections) : null;
}
