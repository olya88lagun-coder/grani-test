import { parseSections, type PortraitSections } from "@grani/ai";
import type { ReportRecord } from "@grani/db";

// Повреждённый или устаревший отчёт равен отсутствующему: вкладка покажет прежний вид, а не упадёт
export function parsePortraitReport(report: Pick<ReportRecord, "sections"> | null | undefined): PortraitSections | null {
  return report ? parseSections("portrait", report.sections) : null;
}
