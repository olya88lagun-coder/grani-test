import { isShortTestComplete, scoreShortTest, type Answers, type ShortTestScore } from "@grani/core";
import { getShortTest, type ShortTestDefinition } from "@grani/content/short-tests";
import { buildShortReport, type ShortReport } from "@grani/content/short-tests/report";
import { getShortResultForOwner, hasPaidShortProduct, saveShortResult, type Database } from "@grani/db";

export type ShortResultsDeps = { db: Database };

// Продукт личного разбора по slug теста; у теста без разбора продукта нет
const SOLO_PRODUCT: Readonly<Record<string, "attachment_solo">> = { attachment: "attachment_solo" };

// Ответы приходят из браузера: проверяем каждый id и значение и считаем баллы сами
export function parseShortAnswers(test: ShortTestDefinition, raw: unknown): Answers | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const entries = Object.entries(raw as Record<string, unknown>);
  const ids = new Set(test.scoring.items.map((item) => item.id));
  const answers: Record<string, 1 | 2 | 3 | 4 | 5> = {};
  for (const [id, value] of entries) {
    if (!ids.has(id) || typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) return null;
    answers[id] = value as 1 | 2 | 3 | 4 | 5;
  }
  return isShortTestComplete(test.scoring, answers) ? answers : null;
}

export async function saveShortAnswers(deps: ShortResultsDeps, p: { userId: string; slug: string; answers: unknown }): Promise<{ ok: true; id: string } | { ok: false }> {
  const test = getShortTest(p.slug);
  // Политика обещает: ответы короткого теста попадают на сервер, только когда человек открывает по ним разбор
  if (!test || !test.reportOffer) return { ok: false };
  const answers = parseShortAnswers(test, p.answers);
  if (!answers) return { ok: false };
  const score = scoreShortTest(test.scoring, answers);
  const saved = await saveShortResult(deps.db, { userId: p.userId, testSlug: test.slug, answers: { ...answers }, scores: { ...score.axes }, typeKey: score.typeKey });
  return { ok: true, id: saved.id };
}

export type ShortResultPage = { test: ShortTestDefinition; score: ShortTestScore; resultId: string; report: ShortReport | null; canBuy: boolean; product: "attachment_solo" | null };

export async function shortResultPage(deps: ShortResultsDeps, p: { id: string; userId: string }): Promise<ShortResultPage | null> {
  const record = await getShortResultForOwner(deps.db, p.id, p.userId);
  if (!record) return null;
  const test = getShortTest(record.testSlug);
  if (!test) return null;
  // Баллы пересчитываются из ответов: тексты и пороги могли поменяться с момента прохождения
  const answers = parseShortAnswers(test, record.answers);
  if (!answers) return null;
  const score = scoreShortTest(test.scoring, answers);
  const product = test.reportOffer ? (SOLO_PRODUCT[test.slug] ?? null) : null;
  const paid = product ? await hasPaidShortProduct(deps.db, { userId: p.userId, product }) : false;
  return { test, score, resultId: record.id, report: paid ? buildShortReport(test, score) : null, canBuy: product !== null && !paid, product };
}
