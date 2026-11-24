import { SELF_ITEMS, TRAIT_LABELS, typeCodeToDir } from "@grani/content";
import {
  isBorderline,
  scoreItems,
  TRAITS,
  typeName,
  typeCodeOf,
  type Answers,
  type Trait,
  type TypeCode,
} from "@grani/core";

// Гостевой результат Big Five живёт в браузере до входа: ответы уже ушли в pending-cookie
export const GUEST_BIG_FIVE_RESULT_VERSION = 1;
export const GUEST_BIG_FIVE_RESULT_KEY = "grani:big-five:guest-result";

export type GuestBigFiveScale = {
  trait: Trait;
  label: string;
  score: number;
  borderline: boolean;
};

export type GuestBigFiveView = {
  typeCode: TypeCode;
  dir: string;
  name: string;
  scales: readonly GuestBigFiveScale[];
};

type StoredGuestResult = {
  v: typeof GUEST_BIG_FIVE_RESULT_VERSION;
  answers: Answers;
  at: string;
};

function isAnswer(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function parseGuestBigFiveAnswers(raw: unknown): Answers | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const entries = Object.entries(raw);
  if (entries.length !== SELF_ITEMS.length) return null;
  const ids = new Set(SELF_ITEMS.map((item) => item.id));
  for (const [id, value] of entries) if (!ids.has(id) || !isAnswer(value)) return null;
  return Object.fromEntries(entries) as Answers;
}

export function guestBigFiveView(answers: Answers): GuestBigFiveView {
  const scores = scoreItems(SELF_ITEMS, answers);
  const typeCode = typeCodeOf(scores);
  return {
    typeCode,
    dir: typeCodeToDir(typeCode),
    name: typeName(typeCode, null),
    scales: TRAITS.map((trait) => {
      const score = scores[trait];
      return { trait, label: TRAIT_LABELS[trait], score, borderline: isBorderline(score) };
    }),
  };
}

export function serializeGuestBigFiveResult(answers: Answers, at: Date): string {
  const stored: StoredGuestResult = { v: GUEST_BIG_FIVE_RESULT_VERSION, answers, at: at.toISOString() };
  return JSON.stringify(stored);
}

// Любая порча или неполная анкета — null: страница снова покажет тест
export function parseStoredGuestBigFiveResult(raw: string | null): GuestBigFiveView | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { v, answers } = parsed as Partial<StoredGuestResult>;
    if (v !== GUEST_BIG_FIVE_RESULT_VERSION) return null;
    const valid = parseGuestBigFiveAnswers(answers);
    return valid ? guestBigFiveView(valid) : null;
  } catch {
    return null;
  }
}
