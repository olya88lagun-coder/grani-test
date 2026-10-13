// Кириллица не входит в \w и \b, поэтому границы слов — через lookaround
const HEDGES = /(?<![а-яё])(?:может|могут|возможно|вероятно|можно сравнить)(?![а-яё])/giu;
const EMPTY_PHRASES: readonly RegExp[] = [/в (?:моей|твоей|вашей) конкретной ситуации/iu, /знакомыми способами и общей целью/iu, /помогает в моей конкретной/iu];
// Ситуации в главе — примеры, а не факты: о прошлом читателя модель знать не может
const PAST_CLAIMS = /(?<![а-яё])(?:ты уже|у тебя было|у тебя уже|ты всегда|ты никогда)(?![а-яё])/iu;

// Читатель любого пола: формы, которые зависят от рода («ты взял», «я рад», «ты устойчив»), не подходят половине людей
const FILLERS = String.raw`(?:(?:не|бы|уже|тоже|часто|иногда|обычно|очень|всегда|тогда|потом|сразу|снова|опять|так|же)\s+)*`;
const PAST_AFTER_PRONOUN = new RegExp(String.raw`(?<![а-яё])(?:ты|я)\s+${FILLERS}(?!сначала(?![а-яё]))(?:[а-яё]{2,}(?:л|ла|лся|лась)|мог|смог|помог|пришёл|ушёл|нашёл|пошёл|вышел|зашёл|привёл|принёс|увёл)(?![а-яё])`, "iu");
const SHORT_ADJECTIVES = "рад|готов|должен|согласен|уверен|благодарен|прав|виноват|занят|устал|открыт|спокоен|устойчив|заботлив|терпелив|внимателен|чувствителен|добр|щедр|осторожен|ответственен|способен|склонен|привык|вынужден|обязан|уязвим|тревожен|раним";
const SHORT_ADJECTIVE_AFTER_PRONOUN = new RegExp(String.raw`(?<![а-яё])(?:ты|я)\s+${FILLERS}(?:${SHORT_ADJECTIVES})(?![а-яё])`, "iu");
const isGendered = (text: string) => PAST_AFTER_PRONOUN.test(text) || SHORT_ADJECTIVE_AFTER_PRONOUN.test(text);
const GENDERED_PATTERNS = [PAST_AFTER_PRONOUN, SHORT_ADJECTIVE_AFTER_PRONOUN].map((pattern) => new RegExp(pattern.source, "giu"));
const MAX_FORMS = 6;

// Найденные фрагменты («ты открыт», «я готов») идут модели как замечание к прошлому ответу; в лог они не пишутся
export function genderedForms(strings: readonly string[]): string[] {
  const found = new Set<string>();
  for (const text of strings) for (const pattern of GENDERED_PATTERNS) for (const match of text.matchAll(pattern)) found.add(match[0].toLowerCase().replace(/\s+/gu, " "));
  return [...found].slice(0, MAX_FORMS);
}

export type StyleProblem = "hedges" | "empty_phrase" | "past_claim" | "gendered";

export function hedgeCount(text: string): number {
  return (text.match(HEDGES) ?? []).length;
}

export function styleProblems(strings: readonly string[], maxHedges: number): StyleProblem[] {
  const problems: StyleProblem[] = [];
  if (strings.reduce((sum, text) => sum + hedgeCount(text), 0) > maxHedges) problems.push("hedges");
  if (strings.some((text) => EMPTY_PHRASES.some((pattern) => pattern.test(text)))) problems.push("empty_phrase");
  if (strings.some((text) => PAST_CLAIMS.test(text))) problems.push("past_claim");
  if (strings.some(isGendered)) problems.push("gendered");
  return problems;
}
