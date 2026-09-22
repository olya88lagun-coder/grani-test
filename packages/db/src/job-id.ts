import { createHash } from "node:crypto";

// Одинаковый ключ → одинаковый id задачи: pg-boss не вставит её второй раз. Нужен и сайту, и воркеру
export function jobIdFor(key: string): string {
  const hex = createHash("sha256").update(key).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
