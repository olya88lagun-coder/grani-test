import { describe, expect, test } from "vitest";
import {
  consentCookieOptions,
  expiredCookieOptions,
  isSameOrigin,
  pendingCookieOptions,
  sessionCookieOptions,
  vkStateCookieOptions,
} from "./http";

describe("cookie options", () => {
  test("are secure on https and not on localhost", () => {
    expect(sessionCookieOptions("https://grani-test.ru").secure).toBe(true);
    expect(sessionCookieOptions("http://localhost:3000").secure).toBe(false);
  });

  test("use the agreed lifetimes and paths", () => {
    const url = "https://grani-test.ru";

    expect(sessionCookieOptions(url)).toEqual({ httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 2592000 });
    expect(pendingCookieOptions(url).maxAge).toBe(86400);
    expect(consentCookieOptions(url).maxAge).toBe(3600);
    expect(vkStateCookieOptions(url)).toMatchObject({ path: "/api/auth/vk", maxAge: 600 });
  });

  test("expire a cookie immediately", () => {
    expect(expiredCookieOptions(sessionCookieOptions("https://grani-test.ru")).maxAge).toBe(0);
  });
});

describe("isSameOrigin", () => {
  const request = (origin: string | null) =>
    new Request("https://grani-test.ru/api/results", { method: "POST", headers: origin ? { origin } : {} });

  test("accepts the app origin", () => {
    expect(isSameOrigin(request("https://grani-test.ru"), "https://grani-test.ru")).toBe(true);
  });

  test("rejects a missing or foreign origin", () => {
    expect(isSameOrigin(request(null), "https://grani-test.ru")).toBe(false);
    expect(isSameOrigin(request("https://evil.example"), "https://grani-test.ru")).toBe(false);
  });
});
