import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONSENT_KEY,
  analyticsHitPath,
  GOALS,
  progressGoalsCrossed,
  goalForProduct,
  isOwnerDevice,
  markOwnerDevice,
  METRIKA_ID,
  reachGoal,
  readChoice,
  sanitizePath,
  sanitizeReferrer,
  saveChoice,
  withLoginMark,
} from "./analytics";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) };
}

const UUID = "0b6f1f0e-5a7e-4c1e-9d2a-3f1b2c3d4e5f";

describe("cookie choice", () => {
  it("reads only known values and saves the choice", () => {
    const storage = memoryStorage();
    expect(readChoice(storage)).toBeNull();
    saveChoice(storage, "all");
    expect(readChoice(storage)).toBe("all");
    expect(readChoice(memoryStorage({ [CONSENT_KEY]: "yes" }))).toBeNull();
  });

  it("survives a storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(readChoice(broken)).toBeNull();
    expect(() => saveChoice(broken, "necessary")).not.toThrow();
  });
});

describe("owner device", () => {
  it("is unmarked by default and remembered once marked", () => {
    const storage = memoryStorage();
    expect(isOwnerDevice(storage)).toBe(false);
    markOwnerDevice(storage);
    expect(isOwnerDevice(storage)).toBe(true);
  });

  it("survives a storage that throws", () => {
    const broken = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
    expect(() => markOwnerDevice(broken)).not.toThrow();
    expect(isOwnerDevice(broken)).toBe(false);
  });
});

describe("sanitizePath", () => {
  it("hides ids and invite tokens", () => {
    expect(sanitizePath(`/result/${UUID}`)).toBe("/result/:id");
    expect(sanitizePath(`/report/${UUID}?x=1`)).toBe("/report/:id");
    expect(sanitizePath("/f/AbC123xyz/done")).toBe("/f/:id/done");
    expect(sanitizePath("/p/AbC123xyz")).toBe("/p/:id");
    expect(sanitizePath(`/pair/${UUID}`)).toBe("/pair/:id");
    expect(sanitizePath(`/purchases/${UUID}`)).toBe("/purchases/:id");
    expect(sanitizePath(`/cards/manual/${UUID}`)).toBe("/cards/manual/:id");
    expect(sanitizePath("/together/invite/AbC123xyzAbC123xyzAbC12")).toBe("/together/invite/:id");
  });

  it("keeps the public together page and hides nothing else under it", () => {
    expect(sanitizePath("/together")).toBe("/together");
    expect(sanitizePath("/together?purchase=abc")).toBe("/together");
  });

  it("keeps public pages as they are, without the query", () => {
    expect(sanitizePath("/types/iskra")).toBe("/types/iskra");
    expect(sanitizePath("/privacy")).toBe("/privacy");
    expect(sanitizePath("/?deleted=1")).toBe("/");
    expect(sanitizePath("")).toBe("/");
  });
});

describe("public campaign attribution", () => {
  it("preserves only valid marketing tags on a public landing page", () => {
    expect(analyticsHitPath("/big-five-test", "?utm_source=vk&utm_medium=social&utm_campaign=autumn&email=private%40example.ru&token=secret#from"))
      .toBe("/big-five-test?utm_source=vk&utm_medium=social&utm_campaign=autumn");
  });

  it("keeps private pages anonymous and drops query data even when named as marketing tags", () => {
    expect(analyticsHitPath(`/result/${UUID}`, "?utm_source=vk&token=secret")).toBe("/result/:id");
    expect(analyticsHitPath("/big-five-test", "?utm_source=person%40example.ru&utm_campaign=https%3A%2F%2Fprivate.test")).toBe("/big-five-test");
    expect(analyticsHitPath("/admin/receipts", "?utm_source=vk")).toBe("/admin/receipts");
  });
});

describe("sanitizeReferrer", () => {
  const origin = "https://grani-test.ru";

  it("cleans own pages and keeps only the origin of other sites", () => {
    expect(sanitizeReferrer(`${origin}/result/${UUID}?from=login`, origin)).toBe(`${origin}/result/:id`);
    expect(sanitizeReferrer("https://yandex.ru/search/?text=тест", origin)).toBe("https://yandex.ru");
  });

  it("returns nothing for an empty or broken referrer", () => {
    expect(sanitizeReferrer("", origin)).toBeUndefined();
    expect(sanitizeReferrer("not a url", origin)).toBeUndefined();
  });
});

describe("login mark", () => {
  it("adds the mark and keeps the existing query", () => {
    expect(withLoginMark(`/result/${UUID}`)).toBe(`/result/${UUID}?from=login`);
    expect(withLoginMark("/p/tok?x=1")).toBe("/p/tok?x=1&from=login");
  });
});

describe("goals", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("has the spec goals plus the pair ones", () => {
    expect(GOALS).toEqual([
      "test_start",
      "test_finish",
      "login_consent",
      "login_start",
      "login",
      "invite_shared",
      "pair_invite_shared",
      "friend_answered",
      "purchase_full",
      "purchase_chapter",
      "purchase_pair",
      "test_25",
      "test_50",
      "test_75",
      "result_view",
      "story_share",
      "report_click",
      "checkout_start",
      "attachment_start",
      "attachment_finish",
      "temperament_start",
      "temperament_finish",
      "purchase_attachment",
      "purchase_attachment_pair",
    ]);
  });

  it("reports each progress milestone once, when an answer crosses it", () => {
    expect(progressGoalsCrossed(12, 13, 50)).toEqual(["test_25"]);
    expect(progressGoalsCrossed(13, 14, 50)).toEqual([]);
    expect(progressGoalsCrossed(24, 25, 50)).toEqual(["test_50"]);
    expect(progressGoalsCrossed(37, 38, 50)).toEqual(["test_75"]);
    // Восстановленный после перезагрузки прогресс не повторяет цели: считаются только переходы
    expect(progressGoalsCrossed(38, 38, 50)).toEqual([]);
    expect(progressGoalsCrossed(0, 50, 50)).toEqual(["test_25", "test_50", "test_75"]);
  });

  it("maps products to purchase goals", () => {
    expect(goalForProduct("full")).toBe("purchase_full");
    expect(goalForProduct("chapter_money")).toBe("purchase_chapter");
    expect(goalForProduct("attachment_pair")).toBe("purchase_attachment_pair");
    expect(goalForProduct("attachment_pair_discount")).toBe("purchase_attachment_pair");
    expect(goalForProduct("chapters_all")).toBe("purchase_chapter");
    expect(goalForProduct("pair")).toBe("purchase_pair");
  });

  it("does nothing before Metrika is loaded and calls ym after", () => {
    vi.stubGlobal("window", {});
    expect(() => reachGoal("test_start")).not.toThrow();
    const ym = vi.fn();
    vi.stubGlobal("window", { ym });
    reachGoal("login");
    expect(ym).toHaveBeenCalledWith(METRIKA_ID, "reachGoal", "login", undefined);
  });

  it("counts funnel steps on the site except on the owner's device", () => {
    const sendBeacon = vi.fn();
    const storage = new Map<string, string>();
    const localStorage = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => void storage.set(key, value) };
    vi.stubGlobal("window", { navigator: { sendBeacon }, localStorage });
    reachGoal("test_finish");
    reachGoal("purchase_full");
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon).toHaveBeenCalledWith("/api/funnel", "test_finish");
    markOwnerDevice(localStorage);
    reachGoal("test_finish");
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  it("counts attachment test start and finish as funnel steps", () => {
    const sendBeacon = vi.fn();
    vi.stubGlobal("window", { navigator: { sendBeacon } });
    reachGoal("attachment_start");
    reachGoal("attachment_finish");
    expect(sendBeacon).toHaveBeenCalledWith("/api/funnel", "attachment_start");
    expect(sendBeacon).toHaveBeenCalledWith("/api/funnel", "attachment_finish");
    reachGoal("temperament_finish");
    expect(sendBeacon).toHaveBeenCalledWith("/api/funnel", "temperament_finish");
  });
});

describe("goalForProduct for short test reports", () => {
  it("maps the attachment solo report to its own purchase goal", () => {
    expect(goalForProduct("attachment_solo")).toBe("purchase_attachment");
  });
});
