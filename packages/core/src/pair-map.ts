export const PAIR_MAP_CONSENT_VERSION = "2026-10-09-v1";
export const PAIR_MAP_MAX_TEXT = 600;
export const PAIR_MAP_QUESTIONS = [
  { id: "conflict", title: "Когда вы спорите", question: "Как каждый из нас понимает, что пора сделать паузу?" },
  { id: "home", title: "Быт и порядок", question: "Как выглядит приемлемый для каждого из нас порядок дома?" },
  { id: "money", title: "Деньги и покупки", question: "Какую покупку мы хотели бы обсуждать заранее?" },
  { id: "social", title: "Общение и отдых", question: "После какого отдыха у каждого из нас больше сил?" },
  { id: "closeness", title: "Близость и пространство", question: "Как мы можем показывать тепло и уважать личное пространство?" },
  { id: "support", title: "Поддержка в трудный день", question: "Что помогает нам чувствовать поддержку, а что воспринимается как давление?" },
  { id: "plans", title: "Планы и новое", question: "Какие перемены нам интересны, а какие лучше обсуждать заранее?" },
  { id: "decisions", title: "Решения вдвоём", question: "Как сказать «нет» так, чтобы у нас оставалось место для обсуждения?" },
] as const;
export type PairQuestionId = (typeof PAIR_MAP_QUESTIONS)[number]["id"];
export type SurveyAnswer = { text: string; skipped: boolean };
export type SurveyAnswers = Record<PairQuestionId, SurveyAnswer>;
export type AgreementSlot = 0 | 1 | 2;
export const PAIR_AGREEMENT_DEFAULTS = [
  "Когда разговор становится тяжёлым, мы берём паузу и называем время, когда вернёмся к нему.",
  "Раз в неделю мы сверяем планы, домашние дела и время для отдыха каждого.",
  "В трудный день мы спрашиваем: тебе нужно выговориться, помощь делом или время наедине?",
] as const;
export const PAIR_AGREEMENT_TITLES = ["Как мы спорим", "Как мы живём вместе", "Как мы поддерживаем"] as const;

export function emptySurveyAnswers(): SurveyAnswers {
  return Object.fromEntries(PAIR_MAP_QUESTIONS.map(({ id }) => [id, { text: "", skipped: false }])) as SurveyAnswers;
}
export function parsePairMapText(raw: unknown, emptyAllowed = false): string | null {
  if (typeof raw !== "string" || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(raw)) return null;
  const text = raw.replace(/\r\n?/g, "\n").trim();
  if ((!emptyAllowed && !text) || Array.from(text).length > PAIR_MAP_MAX_TEXT || /[\ud800-\udfff]/u.test(text)) return null;
  return text;
}
export function parseSurveyAnswers(raw: unknown, complete: boolean): SurveyAnswers | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (Object.keys(record).length !== PAIR_MAP_QUESTIONS.length) return null;
  const result = emptySurveyAnswers();
  for (const { id } of PAIR_MAP_QUESTIONS) {
    const answer = record[id];
    if (typeof answer !== "object" || answer === null || Array.isArray(answer)) return null;
    const value = answer as Record<string, unknown>;
    if (Object.keys(value).length !== 2 || typeof value.skipped !== "boolean") return null;
    const text = parsePairMapText(value.text, true);
    if (text === null || (value.skipped && text !== "") || (complete && !value.skipped && !text)) return null;
    result[id] = { text, skipped: value.skipped };
  }
  return result;
}
export const isAgreementSlot = (value: unknown): value is AgreementSlot => value === 0 || value === 1 || value === 2;
export const isPairMapRevision = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

export type PublishedSurvey = { answers: SurveyAnswers; revision: number; updatedAt: string };
export type PairMapSnapshot = {
  consentRequired: boolean;
  survey: {
    mine: { draft: SurveyAnswers; revision: number; published: PublishedSurvey | null };
    partner: { submitted: boolean; published: PublishedSurvey | null };
  };
  agreements: {
    slot: AgreementSlot;
    draft: { text: string; revision: number };
    proposal: { text: string; revision: number; proposedByYou: boolean; confirmedByYou: boolean; confirmedByPartner: boolean; updatedAt: string } | null;
  }[];
};
export type PairMapError = "not_found" | "access_required" | "consent_required" | "invalid" | "stale_version" | "unavailable";
export type PairMapFailure = { ok: false; error: PairMapError };
export type PairMapOutcome = { ok: true; snapshot: PairMapSnapshot } | PairMapFailure;

export type PairMapCommand =
  | { kind: "consent"; accepted: true; version: string }
  | { kind: "survey_draft" | "survey_submit"; answers: SurveyAnswers; expectedRevision: number }
  | { kind: "survey_delete"; expectedRevision: number }
  | { kind: "agreement_draft" | "agreement_propose"; slot: AgreementSlot; text: string; expectedRevision: number }
  | { kind: "agreement_confirm" | "agreement_retract"; slot: AgreementSlot; expectedRevision: number };

export function parsePairMapCommand(raw: unknown): PairMapCommand | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  const exact = (...keys: string[]) => Object.keys(p).length === keys.length && keys.every(key => Object.hasOwn(p, key));
  if (p.kind === "consent") return exact("kind", "accepted", "version") && p.accepted === true && p.version === PAIR_MAP_CONSENT_VERSION
    ? { kind: p.kind, accepted: true, version: p.version } : null;
  if (!isPairMapRevision(p.expectedRevision)) return null;
  const expectedRevision = p.expectedRevision;
  if (p.kind === "survey_delete") return exact("kind", "expectedRevision") ? { kind: p.kind, expectedRevision } : null;
  if (p.kind === "survey_draft" || p.kind === "survey_submit") {
    const answers = parseSurveyAnswers(p.answers, p.kind === "survey_submit");
    return exact("kind", "answers", "expectedRevision") && answers ? { kind: p.kind, answers, expectedRevision } : null;
  }
  if (!isAgreementSlot(p.slot)) return null;
  const slot = p.slot;
  if (p.kind === "agreement_confirm" || p.kind === "agreement_retract") return exact("kind", "slot", "expectedRevision") ? { kind: p.kind, slot, expectedRevision } : null;
  if (p.kind === "agreement_draft" || p.kind === "agreement_propose") {
    const text = parsePairMapText(p.text, p.kind === "agreement_draft");
    return exact("kind", "slot", "text", "expectedRevision") && text !== null ? { kind: p.kind, slot, text, expectedRevision } : null;
  }
  return null;
}
