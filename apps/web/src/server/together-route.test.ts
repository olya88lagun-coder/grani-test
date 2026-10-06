import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const getCurrentUser = vi.fn();
vi.mock("./login-service", () => ({ getCurrentUser: (...args: unknown[]) => getCurrentUser(...args) }));
vi.mock("./deps", () => ({
  loginDeps: () => ({ db: {}, env: { APP_URL: "http://localhost:3000" }, now: () => new Date("2026-10-05T10:00:00Z") }),
}));

import { createRateLimiter } from "./rate-limit";
import { authorizeTogether, cardErrorStatus, failure, readJsonObject } from "./together-route";

const request = (init: { method?: string; origin?: string; cookie?: string; body?: string } = {}) =>
  new NextRequest("http://localhost:3000/api/together/x", {
    method: init.method ?? "POST",
    headers: { ...(init.origin ? { origin: init.origin } : {}), ...(init.cookie ? { cookie: init.cookie } : {}), "x-forwarded-for": "1.2.3.4" },
    body: init.body,
  });

beforeEach(() => getCurrentUser.mockReset());

describe("authorizeTogether", () => {
  test("rejects a mutating request from another origin before touching the session", async () => {
    const result = await authorizeTogether(request({ origin: "https://evil.example" }), { mutating: true });

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  test("rejects a request without a session", async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await authorizeTogether(request({ origin: "http://localhost:3000" }), { mutating: true });

    expect((result as Response).status).toBe(401);
  });

  test("returns the user and deps for a valid same-origin request", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", displayName: "Аня", gender: null });

    const result = await authorizeTogether(request({ origin: "http://localhost:3000", cookie: "grani_session=abc" }), { mutating: true });

    expect(result).toMatchObject({ user: { id: "u1" }, deps: { appUrl: "http://localhost:3000" } });
    expect(getCurrentUser).toHaveBeenCalledWith(expect.anything(), "abc");
  });

  test("does not check the origin of a read-only request", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", displayName: "Аня", gender: null });

    const result = await authorizeTogether(request({ method: "GET" }), { mutating: false });

    expect(result).toMatchObject({ user: { id: "u1" } });
  });

  test("answers 429 when the limiter is exhausted", async () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    getCurrentUser.mockResolvedValue({ id: "u1", displayName: "Аня", gender: null });
    await authorizeTogether(request({ origin: "http://localhost:3000" }), { mutating: true, limiter });

    const result = await authorizeTogether(request({ origin: "http://localhost:3000" }), { mutating: true, limiter });

    expect((result as Response).status).toBe(429);
  });
});

describe("failure and readJsonObject", () => {
  test("failure builds the error envelope", async () => {
    const response = failure("not_found", 404);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, error: "not_found" });
  });

  test("readJsonObject returns an empty object for a bad or non-object body", async () => {
    expect(await readJsonObject(request({ body: "{\"a\":1}" }))).toEqual({ a: 1 });
    expect(await readJsonObject(request({ body: "not json" }))).toEqual({});
    expect(await readJsonObject(request({ body: "[1,2]" }))).toEqual({});
    expect(await readJsonObject(request({ body: "null" }))).toEqual({});
  });
});

describe("cardErrorStatus", () => {
  test("maps card errors to stable HTTP statuses", () => {
    expect(cardErrorStatus("not_found")).toBe(404);
    for (const error of ["invalid", "invalid_field", "field_not_available"]) expect(cardErrorStatus(error)).toBe(400);
    for (const error of ["already_closed", "already_revealed", "reveal_pending", "access_required", "skip_not_allowed", "not_closed"]) {
      expect(cardErrorStatus(error)).toBe(409);
    }
  });
});
