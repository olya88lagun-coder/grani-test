import type { Product } from "@grani/core";
import { afterEach, describe, expect, test, vi } from "vitest";
import { extraReportFlags, lifeCardsEnabled, portraitEnabled, requestExtraReports } from "./extra-reports";

const enqueueGenerate = vi.fn().mockResolvedValue(undefined);
const ALL_ON = { life: true, portrait: true };
const NONE_PRESENT = { life: false, portrait: false };
const ask = (p: Partial<{ enabled: { life: boolean; portrait: boolean }; owned: Product[]; present: { life: boolean; portrait: boolean } }> = {}) =>
  requestExtraReports({ enqueueGenerate }, { resultId: "r1", owned: p.owned ?? ["full"], enabled: p.enabled ?? ALL_ON, present: p.present ?? NONE_PRESENT });

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.LIFE_CARDS_V1;
  delete process.env.PORTRAIT_V1;
});

describe("the flags", () => {
  test("each is on only when its variable is 1", () => {
    expect(extraReportFlags()).toEqual({ life: false, portrait: false });
    process.env.LIFE_CARDS_V1 = "1";
    expect(lifeCardsEnabled()).toBe(true);
    expect(portraitEnabled()).toBe(false);
    process.env.PORTRAIT_V1 = "1";
    expect(extraReportFlags()).toEqual({ life: true, portrait: true });
    process.env.PORTRAIT_V1 = "0";
    expect(portraitEnabled()).toBe(false);
  });
});

describe("requestExtraReports", () => {
  test("queues each missing report once for a paid owner", async () => {
    expect(await ask()).toEqual(["life", "portrait"]);
    expect(enqueueGenerate).toHaveBeenCalledTimes(2);
    expect(enqueueGenerate).toHaveBeenCalledWith({ kind: "life", resultId: "r1" });
    expect(enqueueGenerate).toHaveBeenCalledWith({ kind: "portrait", resultId: "r1" });
  });

  test("skips reports that are ready and reports whose flag is off", async () => {
    expect(await ask({ present: { life: true, portrait: false } })).toEqual(["portrait"]);
    expect(await ask({ enabled: { life: false, portrait: true } })).toEqual(["portrait"]);
    expect(await ask({ enabled: { life: true, portrait: false }, present: { life: true, portrait: false } })).toEqual([]);
  });

  test("does nothing without the full report", async () => {
    expect(await ask({ owned: ["pair"] })).toEqual([]);
    expect(await ask({ owned: [] })).toEqual([]);
    expect(enqueueGenerate).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "portrait" }));
  });
});
