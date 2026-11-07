import { describe, expect, test } from "vitest";
import { funnelBase } from "./funnel";

describe("funnelBase", () => {
  test("login steps are a share of Big Five finishers", () => {
    expect(funnelBase("login")).toBe("test_finish");
    expect(funnelBase("login_consent")).toBe("test_finish");
  });

  test("attachment finish is a share of attachment starts, not of Big Five finishers", () => {
    expect(funnelBase("attachment_finish")).toBe("attachment_start");
  });

  test("starts and the base step itself have no share", () => {
    expect(funnelBase("test_start")).toBeNull();
    expect(funnelBase("test_finish")).toBeNull();
    expect(funnelBase("attachment_start")).toBeNull();
  });
});

describe("funnelBase for temperament", () => {
  test("temperament finish is a share of temperament starts", () => {
    expect(funnelBase("temperament_finish")).toBe("temperament_start");
    expect(funnelBase("temperament_start")).toBeNull();
  });
});
