import { describe, expect, test } from "vitest";
import { deviceCookieOptions, deviceHash, isDeviceId, newDeviceId } from "./device";

describe("device marker", () => {
  test("is a random uuid", () => {
    const id = newDeviceId();

    expect(isDeviceId(id)).toBe(true);
    expect(newDeviceId()).not.toBe(id);
    expect(isDeviceId("not-a-uuid")).toBe(false);
    expect(isDeviceId(undefined)).toBe(false);
  });

  test("is stored only as a secret-keyed hash", () => {
    const id = newDeviceId();

    expect(deviceHash("s".repeat(40), id)).toMatch(/^[0-9a-f]{64}$/);
    expect(deviceHash("s".repeat(40), id)).toBe(deviceHash("s".repeat(40), id));
    expect(deviceHash("t".repeat(40), id)).not.toBe(deviceHash("s".repeat(40), id));
    expect(deviceHash("s".repeat(40), id)).not.toContain(id);
  });

  test("lives for a year", () => {
    expect(deviceCookieOptions("https://grani-test.ru")).toEqual({ httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 31536000 });
  });
});
