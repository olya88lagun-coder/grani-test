import { getShortTest } from "@grani/content/short-tests";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { verifyShortPending } from "@/server/auth/tokens";
import { getCurrentUser } from "@/server/login-service";
import { resultsLimiter } from "@/server/rate-limit";
import { saveShortAnswers } from "@/server/short-results-service";
import { POST } from "./route";

const SECRET = "s".repeat(64);
vi.mock("@/server/db", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@/server/env", () => ({ getEnv: () => ({ APP_URL: "http://localhost:3000", SESSION_SECRET: "s".repeat(64) }) }));
vi.mock("@/server/login-service", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/rate-limit", () => ({ clientKeyFromHeaders: () => "key", resultsLimiter: { allow: vi.fn(() => true) } }));
vi.mock("@/server/short-results-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/short-results-service")>()),
  saveShortAnswers: vi.fn(async () => ({ ok: true, id: "11111111-1111-1111-1111-111111111111" })),
}));

const attachment = getShortTest("attachment")!;
const answers = Object.fromEntries(attachment.items.map((item) => [item.id, 4]));
const INVITE = "a".repeat(24);
const request = (body: unknown, origin = "http://localhost:3000") =>
  new NextRequest("http://localhost:3000/api/short-results", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resultsLimiter.allow).mockReturnValue(true);
  vi.mocked(getCurrentUser).mockResolvedValue(null);
});

describe("POST /api/short-results", () => {
  test("rejects a foreign origin and a rate-limited client without saving", async () => {
    expect((await POST(request({ slug: "attachment", answers }, "https://foreign.example"))).status).toBe(403);
    vi.mocked(resultsLimiter.allow).mockReturnValue(false);
    expect((await POST(request({ slug: "attachment", answers }))).status).toBe(429);
    expect(saveShortAnswers).not.toHaveBeenCalled();
  });

  test("rejects a test without a paid report or pair mode", async () => {
    const temperament = getShortTest("temperament")!;
    const response = await POST(request({ slug: "temperament", answers: Object.fromEntries(temperament.items.map((i) => [i.id, 3])) }));
    expect(response.status).toBe(400);
  });

  test("a guest partner gets a signed cookie with the invite and goes to login", async () => {
    const response = await POST(request({ slug: "attachment", answers, invite: INVITE }));
    expect(await response.json()).toEqual({ ok: true, redirect: "/login" });
    const cookie = response.cookies.get("grani_short_pending")?.value ?? "";
    expect(await verifyShortPending(cookie, SECRET)).toMatchObject({ slug: "attachment", invite: INVITE });
    expect(saveShortAnswers).not.toHaveBeenCalled();
  });

  test("a signed-in user is sent to the invite, to the invite block or to the result", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "u1", displayName: "Аня", gender: null });
    expect(await (await POST(request({ slug: "attachment", answers, invite: INVITE }))).json()).toEqual({ ok: true, redirect: `/sp/${INVITE}` });
    expect(await (await POST(request({ slug: "attachment", answers, intent: "pair" }))).json()).toEqual({ ok: true, redirect: "/short/11111111-1111-1111-1111-111111111111#pair" });
    expect(await (await POST(request({ slug: "attachment", answers }))).json()).toEqual({ ok: true, redirect: "/short/11111111-1111-1111-1111-111111111111" });
  });
});
