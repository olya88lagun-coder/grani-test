import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { PurchaseView } from "@/server/payments-service";
import { flushPurchaseGoals, forgetPurchaseGoals, markPurchase } from "./purchase-analytics";
import { METRIKA_ID, notifyAnalyticsReady, OWNER_DEVICE_KEY } from "./analytics";

const orderId = "order_" + "a".repeat(64);
const confirmed = { id: orderId, product: "full", amountKopecks: 16900, currency: "RUB" };
const view = (patch: Partial<PurchaseView> = {}): PurchaseView => ({
  id: "00000000-0000-4000-8000-000000000001", product: "full", status: "succeeded",
  ready: false, reportUrl: "/report/private", free: false, since: new Date().toISOString(), ...patch,
});
function storage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    get length() { return data.size; },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}
function browser(choice: string | null = "all", localStorage = storage(choice ? { "grani-cookie-consent": choice } : {})) {
  const win = Object.assign(new EventTarget(), {
    location: { origin: "https://grani-test.ru" }, navigator: {}, localStorage, sessionStorage: storage(),
    ym: undefined as ReturnType<typeof vi.fn> | undefined,
  });
  vi.stubGlobal("window", win);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, purchase: confirmed }))));
  return win;
}
function sdk(win: ReturnType<typeof browser>, callback = true) {
  win.ym = vi.fn((_counter, _method, _goal, _params, done?: () => void) => { if (callback) done?.(); });
  notifyAnalyticsReady();
}
const journal = (win: ReturnType<typeof browser>) => win.localStorage.getItem("grani-purchase-v2-" + orderId);

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

test("a paid full report is counted before generation using verified paid amount and opaque order ID", async () => {
  const win = browser(); sdk(win);
  await markPurchase(view());
  expect(win.ym).toHaveBeenCalledExactlyOnceWith(METRIKA_ID, "reachGoal", "purchase_full",
    { order_price: 169, currency: "RUB", product: "full", order_id: orderId }, expect.any(Function));
  expect(journal(win)).toContain('"state":"sent"');
  expect(JSON.stringify(win.ym!.mock.calls)).not.toContain("/report/private");
});

test.each(["pending", "canceled", "refunded"] as const)("%s does not even request purchase analytics", async status => {
  const win = browser(); sdk(win);
  await markPurchase(view({ status }));
  expect(fetch).not.toHaveBeenCalled();
  expect(win.ym).not.toHaveBeenCalled();
});

test("free, owner and necessary-only visits never send purchase telemetry", async () => {
  const win = browser(); sdk(win);
  await markPurchase(view({ free: true }));
  win.localStorage.setItem(OWNER_DEVICE_KEY, "1");
  await markPurchase(view());
  win.localStorage.removeItem(OWNER_DEVICE_KEY);
  win.localStorage.setItem("grani-cookie-consent", "necessary");
  await markPurchase(view());
  expect(fetch).not.toHaveBeenCalled();
  expect(win.ym).not.toHaveBeenCalled();
});

test("provider-excluded or malformed responses never become a sale", async () => {
  const win = browser(); sdk(win);
  for (const purchase of [null, { ...confirmed, amountKopecks: -1 }, { ...confirmed, id: "private-result-token" }]) {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, purchase })));
    await markPurchase(view());
  }
  expect(win.ym).not.toHaveBeenCalled();
});

test("parallel polling performs one lookup and one goal", async () => {
  const win = browser(); sdk(win);
  await Promise.all([markPurchase(view()), markPurchase(view())]);
  await markPurchase(view());
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(win.ym).toHaveBeenCalledTimes(1);
});

test("a new page session shares acknowledged order markers", async () => {
  const first = browser(); sdk(first); await markPurchase(view());
  const next = browser("all", first.localStorage); sdk(next); await markPurchase(view());
  expect(next.ym).not.toHaveBeenCalled();
});

test("unavailable journal writes still deduplicate repeated polls in memory", async () => {
  const win = browser(); sdk(win);
  win.localStorage.setItem = () => { throw new Error("denied"); };
  await markPurchase(view()); await markPurchase(view());
  expect(win.ym).toHaveBeenCalledTimes(1);
});

test("an SDK stub does not consume the order; confirmed queue survives navigation until SDK load", async () => {
  const win = browser(); win.ym = vi.fn();
  await markPurchase(view());
  expect(win.ym).not.toHaveBeenCalled();
  expect(journal(win)).toContain('"state":"queued"');
  sdk(win); await flushPurchaseGoals();
  expect(win.ym).toHaveBeenCalledTimes(1);
});

test("consent given later can deliver the confirmed purchase", async () => {
  const win = browser(null);
  await markPurchase(view());
  expect(fetch).not.toHaveBeenCalled();
  win.localStorage.setItem("grani-cookie-consent", "all");
  sdk(win); await flushPurchaseGoals();
  expect(win.ym).toHaveBeenCalledTimes(1);
});

test("an unacknowledged request stays sending and is not blindly resent after reload", async () => {
  const first = browser(); sdk(first, false); await markPurchase(view());
  expect(journal(first)).toContain('"state":"sending"');
  const next = browser("all", first.localStorage); sdk(next); await markPurchase(view());
  expect(next.ym).not.toHaveBeenCalled();
});

test("withdrawn consent discards the queue and prevents a late SDK callback from restoring it", async () => {
  const win = browser(); sdk(win, false); await markPurchase(view());
  const callback = win.ym!.mock.calls[0]![4] as () => void;
  win.localStorage.setItem("grani-cookie-consent", "necessary");
  forgetPurchaseGoals(); callback(); await flushPurchaseGoals();
  expect(journal(win)).toBeNull();
  expect(win.ym).toHaveBeenCalledTimes(1);
});

test("an unavailable provider check is retried without marking the order sent", async () => {
  const win = browser(); sdk(win);
  vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
  await markPurchase(view());
  expect(journal(win)).toBeNull();
  await flushPurchaseGoals();
  expect(win.ym).toHaveBeenCalledTimes(1);
});

test("a transient failure after report navigation retries without another route or SDK event", async () => {
  const win = browser(); sdk(win);
  vi.mocked(fetch).mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
  await markPurchase(view({ ready: true }));
  expect(win.ym).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1000);
  expect(win.ym).toHaveBeenCalledTimes(1);
});

test("expired queued records are removed from memory as well as storage", async () => {
  const win = browser(); await markPurchase(view());
  vi.setSystemTime(Date.now() + 8 * 24 * 60 * 60_000);
  sdk(win); await flushPurchaseGoals();
  expect(journal(win)).toBeNull();
  expect(win.ym).not.toHaveBeenCalled();
});

test("a queued opaque order can be delivered after a page reload without a private purchase URL", async () => {
  const first = browser(); await markPurchase(view());
  const next = browser("all", first.localStorage); sdk(next);
  vi.mocked(fetch).mockClear();
  await flushPurchaseGoals();
  expect(next.ym).toHaveBeenCalledTimes(1);
  expect(fetch).not.toHaveBeenCalled();
});

test("a read-only journal cannot downgrade the in-memory sent marker", async () => {
  const win = browser(); await markPurchase(view());
  win.localStorage.setItem = () => { throw new Error("became read-only"); };
  sdk(win); await flushPurchaseGoals(); await flushPurchaseGoals();
  expect(win.ym).toHaveBeenCalledTimes(1);
});

test("revoking then granting consent does not resurrect a canceled in-flight lookup", async () => {
  const win = browser(); sdk(win);
  let resolve!: (value: Response) => void;
  vi.mocked(fetch).mockReturnValueOnce(new Promise<Response>(done => { resolve = done; }));
  const running = markPurchase(view());
  win.localStorage.setItem("grani-cookie-consent", "necessary"); forgetPurchaseGoals();
  win.localStorage.setItem("grani-cookie-consent", "all");
  resolve(new Response(JSON.stringify({ ok: true, purchase: confirmed })));
  await running;
  expect(win.ym).not.toHaveBeenCalled();
});

test("consent revoked in another tab cancels work even if that tab grants again before the response", async () => {
  const win = browser(); sdk(win);
  let resolve!: (value: Response) => void;
  vi.mocked(fetch).mockReturnValueOnce(new Promise<Response>(done => { resolve = done; }));
  const running = markPurchase(view());
  win.localStorage.setItem("grani-cookie-consent", "necessary");
  win.dispatchEvent(Object.assign(new Event("storage"), { key: "grani-cookie-consent", newValue: "necessary" }));
  win.localStorage.setItem("grani-cookie-consent", "all");
  win.dispatchEvent(Object.assign(new Event("storage"), { key: "grani-cookie-consent", newValue: "all" }));
  resolve(new Response(JSON.stringify({ ok: true, purchase: confirmed })));
  await running;
  expect(win.ym).not.toHaveBeenCalled();
});

test("a delayed refusal event cannot erase another tab's new post-consent transaction marker", async () => {
  const first = browser(); sdk(first);
  let resolve!: (value: Response) => void;
  vi.mocked(fetch).mockReturnValueOnce(new Promise<Response>(done => { resolve = done; }));
  const oldLookup = markPurchase(view());
  first.localStorage.setItem("grani-cookie-consent", "necessary");
  first.localStorage.setItem("grani-cookie-consent", "all");
  const second = browser("all", first.localStorage); sdk(second); await markPurchase(view());
  expect(journal(second)).toContain('"state":"sent"');
  vi.stubGlobal("window", first);
  first.dispatchEvent(Object.assign(new Event("storage"), { key: "grani-cookie-consent", newValue: "necessary" }));
  resolve(new Response(JSON.stringify({ ok: true, purchase: confirmed })));
  await oldLookup;
  expect(journal(first)).toContain('"state":"sent"');
  const reloaded = browser("all", first.localStorage); sdk(reloaded); await markPurchase(view());
  expect(reloaded.ym).not.toHaveBeenCalled();
});

test.each([
  ["chapter_money", "purchase_chapter", 9900],
  ["chapter_conflict", "purchase_chapter", 9900],
  ["chapter_stress", "purchase_chapter", 9900],
  ["chapter_relationships", "purchase_chapter", 9900],
  ["chapters_all", "purchase_chapter", 24900],
  ["pair", "purchase_pair", 39900],
] as const)("%s emits one %s transaction", async (product, goal, amountKopecks) => {
  const win = browser(); sdk(win);
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, purchase: { ...confirmed, product, amountKopecks } })));
  await markPurchase(view({ product }));
  expect(win.ym).toHaveBeenCalledExactlyOnceWith(METRIKA_ID, "reachGoal", goal,
    { order_price: amountKopecks / 100, currency: "RUB", product, order_id: orderId }, expect.any(Function));
});
