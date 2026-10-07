import { describe, expect, test } from "vitest";
import { amountForCopy, receiptsSummary, RECEIPT_LATE_DAYS, waitingLabel } from "./receipts-view";

const NOW = new Date("2026-10-10T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000 - 3_600_000);

describe("waitingLabel", () => {
  test("says today, yesterday and then the number of days with the right form", () => {
    expect(waitingLabel(new Date("2026-10-10T08:00:00Z"), NOW).text).toBe("оплачено сегодня");
    expect(waitingLabel(daysAgo(1), NOW).text).toBe("ждёт 1 день");
    expect(waitingLabel(daysAgo(2), NOW).text).toBe("ждёт 2 дня");
    expect(waitingLabel(daysAgo(5), NOW).text).toBe("ждёт 5 дней");
    expect(waitingLabel(daysAgo(11), NOW).text).toBe("ждёт 11 дней");
    expect(waitingLabel(daysAgo(21), NOW).text).toBe("ждёт 21 день");
  });

  test("marks as late only after the soft threshold, and does not invent a date for an unknown payment time", () => {
    expect(waitingLabel(daysAgo(RECEIPT_LATE_DAYS - 1), NOW).late).toBe(false);
    expect(waitingLabel(daysAgo(RECEIPT_LATE_DAYS), NOW).late).toBe(true);
    expect(waitingLabel(null, NOW)).toEqual({ text: "дата оплаты неизвестна", late: false });
  });

  test("a payment from the future (clock skew) counts as today", () => {
    expect(waitingLabel(new Date("2026-10-10T12:00:05Z"), NOW)).toEqual({ text: "оплачено сегодня", late: false });
  });
});

describe("amountForCopy", () => {
  test("gives the amount in rubles for pasting: whole rubles without kopecks, otherwise with a comma", () => {
    expect(amountForCopy(39_900)).toBe("399");
    expect(amountForCopy(29_900)).toBe("299");
    expect(amountForCopy(39_950)).toBe("399,50");
    expect(amountForCopy(100)).toBe("1");
  });
});

describe("receiptsSummary", () => {
  test("counts the receipts and sums the amounts with the right word form", () => {
    expect(receiptsSummary([])).toEqual({ count: 0, totalKopecks: 0, title: "Чеков к отправке нет" });
    expect(receiptsSummary([{ amountKopecks: 39_900 }]).title).toBe("К отправке: 1 чек на 399 ₽");
    expect(receiptsSummary([{ amountKopecks: 39_900 }, { amountKopecks: 29_900 }]).title).toBe("К отправке: 2 чека на 698 ₽");
    expect(receiptsSummary(Array.from({ length: 5 }, () => ({ amountKopecks: 39_900 }))).title).toBe("К отправке: 5 чеков на 1 995 ₽");
  });
});
