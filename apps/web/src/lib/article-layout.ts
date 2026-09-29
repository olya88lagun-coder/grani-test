// Кнопка теста внутри длинной статьи — перед третьим разделом, когда читатель уже втянулся;
// в короткой статье — перед вторым. Возвращает текст до и после места вставки
export function splitForInlineCta(body: string): [string, string] | null {
  const starts = [...body.matchAll(/^## /gm)].map((match) => match.index);
  const at = starts[2] ?? starts[1];
  if (at === undefined) return null;
  return [body.slice(0, at).trimEnd(), body.slice(at)];
}
