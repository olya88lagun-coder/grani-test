import { CONSENT_KEY, goalForProduct, isAnalyticsReady, isOwnerDevice, METRIKA_ID, readChoice } from "./analytics";
import { isConfirmedPurchase, type ConfirmedPurchase } from "./confirmed-purchase";
import { SITE_URL } from "./site";
import type { PurchaseView } from "@/server/payments-service";

const PREFIX = "grani-purchase-v2-";
const QUEUE_AGE_MS = 7 * 24 * 60 * 60_000;
type Delivery = { purchase: ConfirmedPurchase; state: "queued" | "sending" | "sent"; updatedAt: number };
type State = {
  win: Window;
  views: Map<string, PurchaseView>;
  lookups: Map<string, Promise<void>>;
  attempts: Map<string, number>;
  verified: Set<string>;
  entries: Map<string, Delivery>;
  generation: number;
  retryTimer?: ReturnType<typeof setTimeout>;
};
const states = new WeakMap<Window, State>();

function stateFor(win: Window): State {
  let state = states.get(win);
  if (!state) {
    state = { win, views: new Map(), lookups: new Map(), attempts: new Map(), verified: new Set(), entries: new Map(), generation: 0 };
    states.set(win, state);
    const current = state;
    win.addEventListener("storage", event => {
      if (event.key === CONSENT_KEY && event.newValue !== "all") forgetState(current, false);
    });
  }
  return state;
}

function storage(win: Window): Storage | null {
  try { return win.localStorage; } catch { return null; }
}

function allowed(win: Window): boolean {
  const local = storage(win);
  return win.location.origin === SITE_URL && !!local && readChoice(local) === "all" && !isOwnerDevice(local);
}

function readEntry(state: State, id: string): Delivery | null {
  try {
    const value: unknown = JSON.parse(storage(state.win)?.getItem(PREFIX + id) ?? "null");
    if (typeof value !== "object" || value === null) return null;
    const entry = value as Delivery;
    return isConfirmedPurchase(entry.purchase) && entry.purchase.id === id
      && ["queued", "sending", "sent"].includes(entry.state) && Number.isFinite(entry.updatedAt) ? entry : null;
  } catch { return null; }
}

function saveEntry(state: State, entry: Delivery): void {
  state.entries.set(entry.purchase.id, entry);
  try { storage(state.win)?.setItem(PREFIX + entry.purchase.id, JSON.stringify(entry)); } catch { /* Memory still prevents repeated polls. */ }
}

function currentEntry(state: State, id: string): Delivery | null {
  const persisted = readEntry(state, id);
  const memory = state.entries.get(id);
  const priority = { queued: 0, sending: 1, sent: 2 };
  return memory && (!persisted || priority[memory.state] >= priority[persisted.state]) ? memory : persisted;
}

function restoreQueue(state: State): void {
  try {
    const local = storage(state.win);
    if (!local) return;
    for (let i = local.length - 1; i >= 0; i--) {
      const key = local.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      const entry = readEntry(state, key.slice(PREFIX.length));
      if (!entry || (entry.state === "queued" && Date.now() - entry.updatedAt > QUEUE_AGE_MS)) {
        local.removeItem(key);
        state.entries.delete(key.slice(PREFIX.length));
      } else {
        state.entries.set(entry.purchase.id, currentEntry(state, entry.purchase.id) ?? entry);
      }
    }
  } catch { /* A restricted store does not affect paid access. */ }
}

async function verifyView(state: State, view: PurchaseView): Promise<void> {
  if (state.verified.has(view.id)) { state.views.delete(view.id); return; }
  const running = state.lookups.get(view.id);
  if (running) return running;
  if ((state.attempts.get(view.id) ?? 0) >= 3) return;
  const generation = state.generation;
  const lookup = (async () => {
    try {
      state.attempts.set(view.id, (state.attempts.get(view.id) ?? 0) + 1);
      const response = await fetch("/api/purchases/" + encodeURIComponent(view.id) + "/analytics", { cache: "no-store", signal: AbortSignal.timeout(5000) });
      if (!response.ok) return;
      const body: unknown = await response.json();
      if (generation !== state.generation) return;
      if (typeof body !== "object" || body === null || (body as { ok?: unknown }).ok !== true) return;
      const purchase = (body as { purchase?: unknown }).purchase;
      state.views.delete(view.id);
      // Excluded/unknown payments can be checked on a later status poll, but never emitted here.
      if (!isConfirmedPurchase(purchase) || purchase.product !== view.product || !allowed(state.win) || generation !== state.generation) return;
      state.verified.add(view.id);
      const existing = currentEntry(state, purchase.id);
      if (!existing) saveEntry(state, { purchase, state: "queued", updatedAt: Date.now() });
    } catch { /* A later bootstrap, online event or status poll may retry, at most three lookups per page. */ }
  })();
  state.lookups.set(view.id, lookup);
  try { await lookup; } finally {
    if (state.lookups.get(view.id) === lookup) state.lookups.delete(view.id);
    if (generation === state.generation && state.views.has(view.id) && (state.attempts.get(view.id) ?? 0) < 3
      && allowed(state.win) && state.retryTimer === undefined) {
      state.retryTimer = setTimeout(() => {
        state.retryTimer = undefined;
        void flushState(state);
      }, 1000 * (state.attempts.get(view.id) ?? 1));
    }
  }
}

async function deliver(state: State, original: Delivery): Promise<void> {
  const send = () => {
    if (!allowed(state.win) || !isAnalyticsReady(state.win)) return;
    const entry = currentEntry(state, original.purchase.id);
    if (!entry || entry.state !== "queued") return;
    if (Date.now() - entry.updatedAt > QUEUE_AGE_MS) {
      state.entries.delete(entry.purchase.id);
      try { storage(state.win)?.removeItem(PREFIX + entry.purchase.id); } catch { /* Memory entry is already gone. */ }
      return;
    }
    const ym = (state.win as Window & { ym?: (...args: unknown[]) => void }).ym;
    if (typeof ym !== "function") return;
    const sending: Delivery = { ...entry, state: "sending", updatedAt: Date.now() };
    const generation = state.generation;
    saveEntry(state, sending);
    try {
      ym(METRIKA_ID, "reachGoal", goalForProduct(entry.purchase.product), {
        order_price: entry.purchase.amountKopecks / 100, currency: entry.purchase.currency,
        product: entry.purchase.product, order_id: entry.purchase.id,
      }, () => {
        // SDK dispatch is not accounting reconciliation or guaranteed server ingestion.
        if (allowed(state.win) && generation === state.generation) saveEntry(state, { ...sending, state: "sent", updatedAt: Date.now() });
      });
    } catch {
      if (allowed(state.win)) saveEntry(state, { ...entry, state: "queued", updatedAt: Date.now() });
    }
  };
  // Web Locks serialize the journal claim across tabs. Older browsers keep best-effort protection.
  const locks = state.win.navigator?.locks;
  if (locks) {
    try { await locks.request(PREFIX + original.purchase.id, send); } catch { /* Retry queued work on the next flush. */ }
  } else {
    send();
  }
}

async function flushState(state: State): Promise<void> {
  if (!allowed(state.win)) return;
  restoreQueue(state);
  await Promise.all([...state.views.values()].map(view => verifyView(state, view)));
  if (!state.views.size && state.retryTimer !== undefined) {
    clearTimeout(state.retryTimer);
    state.retryTimer = undefined;
  }
  if (!allowed(state.win) || !isAnalyticsReady(state.win)) return;
  await Promise.all([...state.entries.values()].filter(entry => entry.state === "queued").map(entry => deliver(state, entry)));
}

export async function flushPurchaseGoals(): Promise<void> {
  return flushState(stateFor(window));
}

export async function markPurchase(view: PurchaseView): Promise<void> {
  if (view.status !== "succeeded" || view.free) return;
  const state = stateFor(window);
  const local = storage(state.win);
  if (local && (readChoice(local) === "necessary" || isOwnerDevice(local))) return;
  try {
    if (state.win.sessionStorage.getItem("grani-goal-" + view.id)) return;
  } catch { /* The v2 journal and memory cover restricted session storage. */ }
  state.views.set(view.id, view);
  await flushPurchaseGoals();
}

function forgetState(state: State, clearJournal = true): void {
  state.generation++;
  if (state.retryTimer !== undefined) clearTimeout(state.retryTimer);
  state.retryTimer = undefined;
  state.views.clear();
  state.lookups.clear();
  state.entries.clear();
  state.verified.clear();
  state.attempts.clear();
  // Only the tab making the choice removes shared records. Delayed events must preserve newer purchases from other tabs.
  if (!clearJournal) return;
  try {
    const local = storage(state.win);
    if (!local) return;
    for (let i = local.length - 1; i >= 0; i--) {
      const key = local.key(i);
      if (key?.startsWith(PREFIX)) local.removeItem(key);
    }
  } catch { /* Consent refusal must not fail if storage is restricted. */ }
}

export function forgetPurchaseGoals(): void {
  forgetState(stateFor(window));
}
