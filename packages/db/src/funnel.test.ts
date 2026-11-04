import { beforeEach, describe, expect, test } from "vitest";
import { countFunnelStep, listFunnelDays } from "./funnel";
import { createTestDb, type Database } from "./testing";

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
});

describe("funnel", () => {
  test("counts steps per Moscow day", async () => {
    // 21:30 UTC — уже следующий день по Москве
    const late = new Date("2026-11-03T21:30:00Z");
    const noon = new Date("2026-11-03T12:00:00Z");
    await countFunnelStep(db, "test_start", noon);
    await countFunnelStep(db, "test_start", noon);
    await countFunnelStep(db, "test_finish", noon);
    await countFunnelStep(db, "login", late);

    expect(await listFunnelDays(db, new Date("2026-11-01T00:00:00Z"))).toEqual([
      { day: "2026-11-04", test_start: 0, test_finish: 0, login_consent: 0, login_start: 0, login: 1 },
      { day: "2026-11-03", test_start: 2, test_finish: 1, login_consent: 0, login_start: 0, login: 0 },
    ]);
    expect(await listFunnelDays(db, new Date("2026-11-04T00:00:00Z"))).toHaveLength(1);
  });
});
