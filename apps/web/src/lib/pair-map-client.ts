import { isPairMapRevision, parsePairMapText, parseSurveyAnswers, type PairMapCommand, type PairMapSnapshot } from "@grani/core";

export type PairClientError = "unauthorized" | "not_found" | "access_required" | "consent_required" | "stale_version" | "invalid" | "rate_limited" | "unavailable";
export type PairClientOutcome = { ok: true; snapshot: PairMapSnapshot } | { ok: false; error: PairClientError };
const errors: readonly string[] = ["unauthorized", "not_found", "access_required", "consent_required", "stale_version", "invalid", "rate_limited", "unavailable"];
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
function published(v: unknown): boolean {
  return v === null || (record(v) && !!parseSurveyAnswers(v.answers, true) && isPairMapRevision(v.revision) && typeof v.updatedAt === "string");
}
function isSnapshot(v: unknown): v is PairMapSnapshot {
  if (!record(v) || typeof v.consentRequired !== "boolean" || !record(v.survey) || !record(v.survey.mine) || !record(v.survey.partner)) return false;
  const { mine, partner } = v.survey;
  if (!parseSurveyAnswers(mine.draft, false) || !isPairMapRevision(mine.revision) || !published(mine.published) || typeof partner.submitted !== "boolean" || !published(partner.published)) return false;
  if (partner.published !== null && (mine.published === null || !partner.submitted)) return false;
  return Array.isArray(v.agreements) && v.agreements.length === 3 && v.agreements.every((a, slot) => {
    if (!record(a) || a.slot !== slot || !record(a.draft) || parsePairMapText(a.draft.text, true) === null || !isPairMapRevision(a.draft.revision)) return false;
    const p = a.proposal;
    return p === null || (record(p) && parsePairMapText(p.text) !== null && isPairMapRevision(p.revision) && typeof p.updatedAt === "string" && [p.proposedByYou, p.confirmedByYou, p.confirmedByPartner].every(flag => typeof flag === "boolean"));
  });
}
export async function requestPairMap(pairId: string, command?: PairMapCommand, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<PairClientOutcome> {
  try {
    const response = await fetcher(`/api/pairs/${encodeURIComponent(pairId)}/map`, { method: command ? "POST" : "GET", cache: "no-store", credentials: "same-origin", signal,
      ...(command ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(command) } : {}) });
    if (!response.headers.get("content-type")?.includes("application/json")) return { ok: false, error: "unavailable" };
    const value: unknown = await response.json();
    if (!record(value)) return { ok: false, error: "unavailable" };
    if (response.ok && value.ok === true && isSnapshot(value.snapshot)) return { ok: true, snapshot: value.snapshot };
    return { ok: false, error: errors.includes(String(value.error)) ? value.error as PairClientError : "unavailable" };
  } catch { return { ok: false, error: "unavailable" }; }
}
export const pairAccessClosed = (error: PairClientError) => ["unauthorized", "not_found", "access_required"].includes(error);
export const PAIR_CLIENT_MESSAGES: Record<PairClientError, string> = {
  unauthorized: "Войдите снова, чтобы открыть общие данные.", not_found: "Пара больше недоступна. Общие данные скрыты.", access_required: "Право на разбор больше недоступно. Общие данные скрыты.",
  consent_required: "Сначала примите отдельное согласие ниже.", stale_version: "Версия изменилась на другом устройстве. Данные обновлены; ваш ввод сохранён. Сверьте новую версию перед повтором.",
  invalid: "Проверьте ответы: до 600 символов, для публикации ответьте на каждый вопрос или отметьте пропуск.", rate_limited: "Слишком много запросов. Повторите через минуту.", unavailable: "Не удалось обновить данные. Ваш ввод сохранён. Проверьте связь и повторите.",
};
