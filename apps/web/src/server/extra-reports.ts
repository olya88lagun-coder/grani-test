import { EXTRA_KINDS, unlockedKinds, type ExtraKind, type GenerateJob, type Product } from "@grani/core";

// Флаги включать вместе с одноимёнными флагами воркера (см. deploy/server-setup.md)
export const lifeCardsEnabled = () => process.env.LIFE_CARDS_V1 === "1";
export const portraitEnabled = () => process.env.PORTRAIT_V1 === "1";
export const extraReportFlags = (): Readonly<Record<ExtraKind, boolean>> => ({ life: lifeCardsEnabled(), portrait: portraitEnabled() });

export type ExtraReportsDeps = { enqueueGenerate: (job: GenerateJob) => Promise<void> };

// Уже купившим дополнительные отчёты ставятся при открытии страницы разбора. Id задачи детерминирован
// (`generate:<resultId>:<вид>`), поэтому повторные открытия не плодят дубли
export async function requestExtraReports(
  deps: ExtraReportsDeps,
  p: { resultId: string; owned: readonly Product[]; enabled: Readonly<Record<ExtraKind, boolean>>; present: Readonly<Record<ExtraKind, boolean>> },
): Promise<ExtraKind[]> {
  const unlocked = unlockedKinds(p.owned);
  const queued: ExtraKind[] = [];
  for (const kind of EXTRA_KINDS) {
    if (!p.enabled[kind] || p.present[kind] || !unlocked.has(kind)) continue;
    await deps.enqueueGenerate({ kind, resultId: p.resultId });
    queued.push(kind);
  }
  return queued;
}
