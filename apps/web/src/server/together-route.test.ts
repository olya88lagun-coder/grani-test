import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const getCurrentUser = vi.fn();
vi.mock("./login-service", () => ({ getCurrentUser: (...args: unknown[]) => getCurrentUser(...args) }));
const togetherAdmission = vi.fn();
vi.mock("./together-gate", () => ({ togetherAdmission: (...args: unknown[]) => togetherAdmission(...args) }));
vi.mock("./deps", () => ({
  loginDeps: () => ({
    db: {},
    env: { APP_URL: "http://localhost:3000", owner: null, together: { mode: "pilot", pilotCode: "granitsa-2026", pilotLimit: 40 } },
    now: () => new Date("2026-10-05T10:00:00Z"),
  }),
}));

import { createRateLimiter } from "./rate-limit";
import { authorizeTogether, cardErrorStatus, failure, noteErrorStatus, pilotErrorStatus, readJsonObject } from "./together-route";

const request = (init: { method?: string; origin?: string; cookie?: string; body?: string } = {}) =>
  new NextRequest("http://localhost:3000/api/together/x", {
    method: init.method ?? "POST",
    headers: { ...(init.origin ? { origin: init.origin } : {}), ...(init.cookie ? { cookie: init.cookie } : {}), "x-forwarded-for": "1.2.3.4" },
    body: init.body,
  });

beforeEach(() => {
  getCurrentUser.mockReset();
  togetherAdmission.mockReset();
  togetherAdmission.mockResolvedValue("allowed");
});

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

describe("authorizeTogether and the closed pilot", () => {
  const signedIn = () => getCurrentUser.mockResolvedValue({ id: "u1", displayName: "Аня", gender: null });
  const call = (options: { entry?: boolean } = {}) => authorizeTogether(request({ method: "GET" }), { mutating: false, ...options });

  test("answers 404 when the feature is switched off", async () => {
    signedIn();
    togetherAdmission.mockResolvedValue("unavailable");

    const result = await call();

    expect((result as Response).status).toBe(404);
    expect(await (result as Response).json()).toEqual({ ok: false, error: "not_found" });
  });

  test("answers 403 pilot_closed to a person without a pass, and asks the gate about that very person", async () => {
    signedIn();
    togetherAdmission.mockResolvedValue("needs_pass");

    const result = await call();

    expect((result as Response).status).toBe(403);
    expect(await (result as Response).json()).toEqual({ ok: false, error: "pilot_closed" });
    expect(togetherAdmission).toHaveBeenCalledWith(expect.objectContaining({ together: expect.objectContaining({ mode: "pilot" }) }), "u1");
  });

  test("an entry route lets a person without a pass through, but never when the feature is off", async () => {
    signedIn();
    togetherAdmission.mockResolvedValue("needs_pass");
    expect(await call({ entry: true })).toMatchObject({ user: { id: "u1" }, gate: { together: { mode: "pilot" } } });

    togetherAdmission.mockResolvedValue("unavailable");
    expect(((await call({ entry: true })) as Response).status).toBe(404);
  });

  test("a person who is not signed in still gets 401 and the gate is not asked", async () => {
    getCurrentUser.mockResolvedValue(null);

    expect(((await call()) as Response).status).toBe(401);
    expect(togetherAdmission).not.toHaveBeenCalled();
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
    for (const error of ["already_closed", "already_revealed", "reveal_pending", "access_required", "not_yet_open", "skip_not_allowed", "not_closed"]) {
      expect(cardErrorStatus(error)).toBe(409);
    }
  });
});

describe("pilotErrorStatus", () => {
  test("a wrong code is 403, a full pilot is a conflict, a pilot that is not running is not found", () => {
    expect(pilotErrorStatus("invalid_code")).toBe(403);
    expect(pilotErrorStatus("limit_reached")).toBe(409);
    expect(pilotErrorStatus("unavailable")).toBe(404);
  });
});

describe("noteErrorStatus", () => {
  test("a bad note is 400, a missing space is 404, a space that is no longer waiting is a conflict", () => {
    expect(noteErrorStatus("invalid")).toBe(400);
    expect(noteErrorStatus("too_long")).toBe(400);
    expect(noteErrorStatus("not_found")).toBe(404);
    expect(noteErrorStatus("not_pending")).toBe(409);
  });
});
