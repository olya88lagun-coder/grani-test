import { SELF_ITEMS } from "@grani/content";
import {
  scoreItems,
  stabilityOf,
  typeCodeOf,
  type Answer,
  type Answers,
  type Stability,
  type TraitScores,
  type TypeCode,
} from "@grani/core";
import { createResult, getUser, type Database } from "@grani/db";
import { signPending, verifyPending, verifySession } from "./auth/tokens";

export type ComputedResult = { scores: TraitScores; typeCode: TypeCode; stability: Stability };
export type ResultsDeps = { db: Database; secret: string };
export type SubmitOutcome = { kind: "saved"; resultId: string } | { kind: "pending"; pendingToken: string } | { kind: "invalid" };

const ITEM_IDS = new Set(SELF_ITEMS.map((item) => item.id));
const MIN_ANSWER = 1;
const MAX_ANSWER = 5;

function isAnswer(value: unknown): value is Answer {
  return typeof value === "number" && Number.isInteger(value) && value >= MIN_ANSWER && value <= MAX_ANSWER;
}

export function parseAnswersFor(ids: ReadonlySet<string>, raw: unknown): Answers | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const entries = Object.entries(raw);
  if (entries.length !== ids.size) return null;
  for (const [id, value] of entries) if (!ids.has(id) || !isAnswer(value)) return null;
  return Object.fromEntries(entries) as Answers;
}

export function parseAnswers(raw: unknown): Answers | null {
  return parseAnswersFor(ITEM_IDS, raw);
}

export function computeResult(answers: Answers): ComputedResult {
  const scores = scoreItems(SELF_ITEMS, answers);
  return { scores, typeCode: typeCodeOf(scores), stability: stabilityOf(scores) };
}

async function saveFor(db: Database, userId: string, answers: Answers): Promise<string> {
  const created = await createResult(db, { userId, answers, ...computeResult(answers) });
  return created.id;
}

export async function submitAnswers(deps: ResultsDeps, raw: unknown, sessionToken: string | null): Promise<SubmitOutcome> {
  const answers = parseAnswers(raw);
  if (!answers) return { kind: "invalid" };
  const userId = sessionToken ? await verifySession(sessionToken, deps.secret) : null;
  if (userId && (await getUser(deps.db, userId))) return { kind: "saved", resultId: await saveFor(deps.db, userId, answers) };
  return { kind: "pending", pendingToken: await signPending(answers, deps.secret) };
}

export async function savePendingResult(deps: ResultsDeps, userId: string, pendingToken: string | null): Promise<string | null> {
  if (!pendingToken) return null;
  const answers = parseAnswers(await verifyPending(pendingToken, deps.secret));
  return answers ? saveFor(deps.db, userId, answers) : null;
}
