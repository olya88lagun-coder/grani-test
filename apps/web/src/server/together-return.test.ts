import { describe, expect, test } from "vitest";
import { togetherEntryValue, togetherReturnPath } from "./together-return";

const TOKEN = "AbC123xyz_-AbC123xyz_-AB";

describe("togetherEntryValue", () => {
  test("accepts only the space entry and an invite entry with a well-formed token", () => {
    expect(togetherEntryValue("space", null)).toBe("space");
    expect(togetherEntryValue("invite", TOKEN)).toBe(`invite:${TOKEN}`);
  });

  test("refuses unknown entries and malformed or missing tokens", () => {
    expect(togetherEntryValue("invite", "short")).toBeNull();
    expect(togetherEntryValue("invite", null)).toBeNull();
    expect(togetherEntryValue("invite", `${TOKEN}/../../evil`)).toBeNull();
    expect(togetherEntryValue("elsewhere", null)).toBeNull();
    expect(togetherEntryValue(null, null)).toBeNull();
  });
});

describe("togetherReturnPath", () => {
  test("maps a stored entry to a fixed local path", () => {
    expect(togetherReturnPath("space")).toBe("/together");
    expect(togetherReturnPath(`invite:${TOKEN}`)).toBe(`/together/invite/${TOKEN}`);
  });

  test("never turns a tampered cookie into a redirect", () => {
    expect(togetherReturnPath(null)).toBeNull();
    expect(togetherReturnPath("")).toBeNull();
    expect(togetherReturnPath("https://evil.example")).toBeNull();
    expect(togetherReturnPath("//evil.example")).toBeNull();
    expect(togetherReturnPath("javascript:alert(1)")).toBeNull();
    expect(togetherReturnPath("/together")).toBeNull();
    expect(togetherReturnPath("invite:../../x")).toBeNull();
    expect(togetherReturnPath(`invite:${TOKEN}extra`)).toBeNull();
  });
});
