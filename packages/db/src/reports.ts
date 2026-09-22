import type { ReportKind } from "@grani/core";
import { and, eq } from "drizzle-orm";
import { reports, type ReportSource } from "./schema";
import type { Database } from "./types";
import { isUuid } from "./uuid";

export type { ReportSource } from "./schema";
export type ReportTarget = { resultId: string } | { pairId: string };
export type ReportRecord = {
  id: string;
  resultId: string | null;
  pairId: string | null;
  kind: ReportKind;
  sections: unknown;
  source: ReportSource;
  createdAt: Date;
};

type ReportRow = typeof reports.$inferSelect;

const toRecord = (row: ReportRow): ReportRecord => ({ ...row, kind: row.kind as ReportKind });

export function targetId(target: ReportTarget): string {
  return "resultId" in target ? target.resultId : target.pairId;
}

export function targetColumns(target: ReportTarget): { resultId: string | null; pairId: string | null } {
  return "resultId" in target ? { resultId: target.resultId, pairId: null } : { resultId: null, pairId: target.pairId };
}

function targetWhere(target: ReportTarget) {
  return "resultId" in target ? eq(reports.resultId, target.resultId) : eq(reports.pairId, target.pairId);
}

export async function getReport(db: Database, target: ReportTarget, kind: ReportKind): Promise<ReportRecord | null> {
  if (!isUuid(targetId(target))) return null;
  const [row] = await db.select().from(reports).where(and(targetWhere(target), eq(reports.kind, kind))).limit(1);
  return row ? toRecord(row) : null;
}

export async function saveReport(
  db: Database,
  p: { target: ReportTarget; kind: ReportKind; sections: unknown; source: ReportSource },
): Promise<{ report: ReportRecord; created: boolean }> {
  // Уникальный индекс (цель, вид) — единственная защита от второй генерации при повторе задачи
  const [inserted] = await db
    .insert(reports)
    .values({ ...targetColumns(p.target), kind: p.kind, sections: p.sections, source: p.source })
    .onConflictDoNothing()
    .returning();
  if (inserted) return { report: toRecord(inserted), created: true };
  const existing = await getReport(db, p.target, p.kind);
  if (!existing) throw new Error("report conflict without an existing report");
  return { report: existing, created: false };
}

export async function getReportById(db: Database, reportId: string): Promise<ReportRecord | null> {
  if (!isUuid(reportId)) return null;
  const [row] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
  return row ? toRecord(row) : null;
}

export async function listReports(db: Database, target: ReportTarget): Promise<ReportRecord[]> {
  if (!isUuid(targetId(target))) return [];
  return (await db.select().from(reports).where(targetWhere(target))).map(toRecord);
}
