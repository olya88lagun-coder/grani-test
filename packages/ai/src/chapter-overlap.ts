// Повторы совета: тройки слов (без регистра, ё = е) — устойчивы к смене падежа и вводного глагола
const WORD = /[а-яё0-9a-z]+/giu;
const SHINGLE_WORDS = 3;
const MIN_WORDS = 6;
const REPEAT_SHARE = 0.5;

const wordsOf = (text: string): string[] => (text.toLowerCase().replaceAll("ё", "е").match(WORD) ?? []);

function shinglesOf(words: readonly string[]): Set<string> {
  const result = new Set<string>();
  for (let index = 0; index + SHINGLE_WORDS <= words.length; index += 1) result.add(words.slice(index, index + SHINGLE_WORDS).join(" "));
  return result;
}

// Верно, если не меньше половины троек слов текста есть в одном из источников; короткие фразы не сравниваются
export function repeatsAny(text: string, sources: readonly string[]): boolean {
  const words = wordsOf(text);
  if (words.length < MIN_WORDS) return false;
  const mine = shinglesOf(words);
  return sources.some((source) => {
    const theirs = shinglesOf(wordsOf(source));
    let shared = 0;
    for (const shingle of mine) if (theirs.has(shingle)) shared += 1;
    return shared / mine.size >= REPEAT_SHARE;
  });
}
