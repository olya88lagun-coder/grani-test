import { afterEach, expect, test, vi } from "vitest";
import { trackYearEvent } from "./new-year-analytics";
import { METRIKA_ID } from "./analytics";

afterEach(() => vi.unstubAllGlobals());
test("sends fixed event only after consent, SDK readiness and production host", () => {
  const ym = vi.fn();
  const state = { origin: "https://grani-test.ru", choice: "all", owner: false, ready: true };
  vi.stubGlobal("window", { location: { get origin() { return state.origin; } }, localStorage: { getItem: (key: string) => key === "grani-owner-device" ? (state.owner ? "1" : null) : state.choice }, get graniMetrikaReady() { return state.ready; }, ym });
  state.choice = "necessary"; trackYearEvent("new_year_start");
  state.choice = "all"; state.ready = false; trackYearEvent("new_year_start");
  state.ready = true; state.owner = true; trackYearEvent("new_year_start");
  state.owner = false; state.origin = "http://localhost:4457"; trackYearEvent("new_year_start");
  expect(ym).not.toHaveBeenCalled();
  state.origin = "https://grani-test.ru"; trackYearEvent("new_year_complete");
  expect(ym).toHaveBeenCalledExactlyOnceWith(METRIKA_ID, "reachGoal", "new_year_complete", undefined);
});
test("does not block the flow when storage is denied", () => {
  vi.stubGlobal("window", { location: { origin: "https://grani-test.ru" }, get localStorage() { throw new Error("denied"); } });
  expect(() => trackYearEvent("new_year_start")).not.toThrow();
});
