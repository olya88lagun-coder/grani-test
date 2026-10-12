// Кириллица не входит в \w и \b, поэтому границы слов — через lookaround
const HEDGES = /(?<![а-яё])(?:может|могут|возможно|вероятно|можно сравнить)(?![а-яё])/giu;
const EMPTY_PHRASES: readonly RegExp[] = [/в (?:моей|твоей|вашей) конкретной ситуации/iu, /знакомыми способами и общей целью/iu, /помогает в моей конкретной/iu];
// Ситуации в главе — примеры, а не факты: о прошлом читателя модель знать не может
const PAST_CLAIMS = /(?<![а-яё])(?:ты уже|у тебя было|у тебя уже|ты всегда|ты никогда)(?![а-яё])/iu;

export type StyleProblem = "hedges" | "empty_phrase" | "past_claim";

export function hedgeCount(text: string): number {
  return (text.match(HEDGES) ?? []).length;
}

export function styleProblems(strings: readonly string[], maxHedges: number): StyleProblem[] {
  const problems: StyleProblem[] = [];
  if (strings.reduce((sum, text) => sum + hedgeCount(text), 0) > maxHedges) problems.push("hedges");
  if (strings.some((text) => EMPTY_PHRASES.some((pattern) => pattern.test(text)))) problems.push("empty_phrase");
  if (strings.some((text) => PAST_CLAIMS.test(text))) problems.push("past_claim");
  return problems;
}
