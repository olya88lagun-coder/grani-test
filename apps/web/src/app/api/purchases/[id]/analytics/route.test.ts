import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";
import { GET } from "./route";

const deps = vi.hoisted(() => ({ currentUser: vi.fn(), payments: vi.fn(), read: vi.fn() }));
vi.mock("@/server/deps", () => ({ loginDeps: () => ({}) }));
vi.mock("@/server/login-service", () => ({ getCurrentUser: deps.currentUser }));
vi.mock("@/server/payments-deps", () => ({ paymentsDeps: deps.payments }));
vi.mock("@/server/purchase-analytics", () => ({ readPurchaseAnalytics: deps.read }));
const request = () => new NextRequest("https://grani-test.ru/api/purchases/fixture/analytics");
const params = { params: Promise.resolve({ id: "fixture" }) };

beforeEach(() => {
  vi.clearAllMocks();
  deps.currentUser.mockResolvedValue({ id: "owner" });
  deps.payments.mockReturnValue({});
  deps.read.mockResolvedValue({ found: true, purchase: null });
});

test("anonymous requests do not read payment data and cannot be cached", async () => {
  deps.currentUser.mockResolvedValue(null);
  const response = await GET(request(), params);
  expect(response.status).toBe(401);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(deps.payments).not.toHaveBeenCalled();
});

test("a foreign or missing purchase returns only 404", async () => {
  deps.read.mockResolvedValue({ found: false });
  const response = await GET(request(), params);
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ ok: false });
  expect(deps.read).toHaveBeenCalledWith({}, { purchaseId: "fixture", userId: "owner" });
});

test("provider failures stay isolated in the analytics request", async () => {
  deps.read.mockRejectedValue(new Error("provider unavailable"));
  const response = await GET(request(), params);
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ ok: false });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});

test("provider lookups have a separate per-user budget without consuming checkout attempts", async () => {
  deps.currentUser.mockResolvedValue({ id: "analytics-budget-owner" });
  const statuses: number[] = [];
  for (let i = 0; i < 31; i++) statuses.push((await GET(request(), params)).status);
  expect(statuses.slice(0, 30)).toEqual(Array(30).fill(200));
  expect(statuses[30]).toBe(429);
  expect(deps.read).toHaveBeenCalledTimes(30);
});
