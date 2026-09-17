import type { TraitScores } from "./traits";

export type Pole = "+" | "-";
export type TypeCode = `${Pole}${Pole}${Pole}${Pole}`;
export type Stability = "calm" | "sensitive";
export type TraitLevel = "high" | "low" | "borderline";
export type Gender = "female" | "male" | null;

export const TYPE_TRAITS = ["openness", "conscientiousness", "extraversion", "agreeableness"] as const;
export const TYPE_THRESHOLD = 50;
export const BORDERLINE_MIN = 45;
export const BORDERLINE_MAX = 55;

type TypeNameEntry = { readonly name: string; readonly feminine: string | null };

export const TYPE_NAMES: Readonly<Record<TypeCode, TypeNameEntry>> = {
  "++++": { name: "Вдохновитель", feminine: "Вдохновительница" },
  "+++-": { name: "Реформатор", feminine: "Реформаторка" },
  "++-+": { name: "Садовник", feminine: "Садовница" },
  "++--": { name: "Архитектор", feminine: null },
  "+-++": { name: "Искра", feminine: null },
  "+-+-": { name: "Бунтарь", feminine: "Бунтарка" },
  "+--+": { name: "Мечтатель", feminine: "Мечтательница" },
  "+---": { name: "Изобретатель", feminine: "Изобретательница" },
  "-+++": { name: "Опора", feminine: null },
  "-++-": { name: "Командир", feminine: null },
  "-+-+": { name: "Тихий хранитель", feminine: "Тихая хранительница" },
  "-+--": { name: "Мастер", feminine: null },
  "--++": { name: "Душа компании", feminine: null },
  "--+-": { name: "Игрок", feminine: null },
  "---+": { name: "Тихая гавань", feminine: null },
  "----": { name: "Наблюдатель", feminine: null },
};

export const ALL_TYPE_CODES = Object.keys(TYPE_NAMES) as readonly TypeCode[];

function pole(score: number): Pole {
  return score >= TYPE_THRESHOLD ? "+" : "-";
}

export function typeCodeOf(scores: TraitScores): TypeCode {
  return TYPE_TRAITS.map((trait) => pole(scores[trait])).join("") as TypeCode;
}

export function stabilityOf(scores: TraitScores): Stability {
  return scores.stability >= TYPE_THRESHOLD ? "calm" : "sensitive";
}

export function isBorderline(score: number): boolean {
  return score >= BORDERLINE_MIN && score <= BORDERLINE_MAX;
}

export function traitLevel(score: number): TraitLevel {
  if (score > BORDERLINE_MAX) return "high";
  if (score < BORDERLINE_MIN) return "low";
  return "borderline";
}

export function typeName(code: TypeCode, gender: Gender): string {
  const entry = TYPE_NAMES[code];
  return gender === "female" && entry.feminine !== null ? entry.feminine : entry.name;
}
