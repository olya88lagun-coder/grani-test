import { afterEach, describe, expect, test, vi } from "vitest";
import { lifeCardsEnabled, requestLifeCards } from "./life-cards";

const enqueueGenerate = vi.fn().mockResolvedValue(undefined);
const ask = (p: Partial<{ enabled: boolean; owned: ("full" | "pair")[]; hasLife: boolean }> = {}) =>
  requestLifeCards({ enabled: p.enabled ?? true, enqueueGenerate }, { resultId: "r1", owned: p.owned ?? ["full"], hasLife: p.hasLife ?? false });

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.LIFE_CARDS_V1;
});

describe("lifeCardsEnabled", () => {
  test("is on only when LIFE_CARDS_V1 is 1", () => {
    expect(lifeCardsEnabled()).toBe(false);
    process.env.LIFE_CARDS_V1 = "0";
    expect(lifeCardsEnabled()).toBe(false);
    process.env.LIFE_CARDS_V1 = "1";
    expect(lifeCardsEnabled()).toBe(true);
  });
});

describe("requestLifeCards", () => {
  test("queues the life job once for a paid owner whose cards are missing", async () => {
    expect(await ask()).toBe(true);
    expect(enqueueGenerate).toHaveBeenCalledTimes(1);
    expect(enqueueGenerate).toHaveBeenCalledWith({ kind: "life", resultId: "r1" });
  });

  test("does nothing with the flag off, with ready cards or without the full report", async () => {
    expect(await ask({ enabled: false })).toBe(false);
    expect(await ask({ hasLife: true })).toBe(false);
    expect(await ask({ owned: ["pair"] })).toBe(false);
    expect(await ask({ owned: [] })).toBe(false);
    expect(enqueueGenerate).not.toHaveBeenCalled();
  });
});
