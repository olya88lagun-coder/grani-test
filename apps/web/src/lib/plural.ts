// Форма слова по числу: «1 день, 2 дня, 5 дней». Формы: для 1, для 2–4, для 5–20 и остальных
export function pluralRu(count: number, forms: readonly [string, string, string]): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}
