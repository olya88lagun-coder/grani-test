import { expect, test } from "vitest";
import { buildPairReportView } from "./pair-view";

test("a stored pair report does not grant access after payment entitlement is removed", () => {
  const report = { id: "old", resultId: null, pairId: "p", kind: "pair" as const,
    sections: { similar: "а".repeat(300), differences: "б".repeat(300), conflicts: "в".repeat(300), home_money: "г".repeat(300), support: "д".repeat(300) },
    source: "fallback" as const, createdAt: new Date() };
  expect(buildPairReportView({ owned: [], report }).state).toBe("available");
});
