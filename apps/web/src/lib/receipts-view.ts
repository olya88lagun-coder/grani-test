import { formatRub } from "@grani/core";
import { pluralRu } from "./plural";

const DAY_MS = 86_400_000;
// Мягкое предупреждение «чек давно ждёт»: срок выдачи чека определяет закон и бухгалтер, не эта цифра
export const RECEIPT_LATE_DAYS = 5;

export function waitingLabel(paidAt: Date | null, now: Date): { text: string; late: boolean } {
  if (paidAt === null) return { text: "дата оплаты неизвестна", late: false };
  const days = Math.max(0, Math.floor((now.getTime() - paidAt.getTime()) / DAY_MS));
  if (days === 0) return { text: "оплачено сегодня", late: false };
  return { text: `ждёт ${days} ${pluralRu(days, ["день", "дня", "дней"])}`, late: days >= RECEIPT_LATE_DAYS };
}

// Сумма для вставки в «Мой налог»: рубли без знака валюты, копейки через запятую
export function amountForCopy(kopecks: number): string {
  const rubles = Math.floor(kopecks / 100);
  const rest = kopecks % 100;
  return rest === 0 ? String(rubles) : `${rubles},${String(rest).padStart(2, "0")}`;
}

export function receiptsSummary(receipts: readonly { amountKopecks: number }[]): { count: number; totalKopecks: number; title: string } {
  const totalKopecks = receipts.reduce((sum, receipt) => sum + receipt.amountKopecks, 0);
  if (receipts.length === 0) return { count: 0, totalKopecks: 0, title: "Чеков к отправке нет" };
  return { count: receipts.length, totalKopecks, title: `К отправке: ${receipts.length} ${pluralRu(receipts.length, ["чек", "чека", "чеков"])} на ${formatRub(totalKopecks)}` };
}
