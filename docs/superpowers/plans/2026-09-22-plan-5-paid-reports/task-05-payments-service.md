# Task 5: Шлюз ЮKassa, поддельный шлюз, проверка IP, сервис покупок

**Files:**
- Create: `apps/web/src/server/payments/gateway.ts`, `gateway.test.ts`, `apps/web/src/server/payments/yookassa.ts`, `yookassa.test.ts`, `apps/web/src/server/payments/fake.ts`, `fake.test.ts`, `apps/web/src/server/payments/ip.ts`, `ip.test.ts`
- Create: `apps/web/src/server/payments-service.ts`, `payments-service.test.ts`
- Modify: `apps/web/src/server/env.ts`, `env.test.ts`, `login-service.test.ts` (поле `payments`), `apps/web/src/server/queue.ts`, `apps/web/src/server/friends-service.ts`, `friends-service.test.ts`, `apps/web/src/app/api/f/[token]/route.ts`, `apps/web/.env.development.example`

**Interfaces:**
- Consumes: `PRODUCT_PRICES`, `isProduct`, `canBuy`, `productTarget`, `reportKindsFor`, `friendsReportDue`, `GenerateJob`, `QUEUES`, `GENERATE_JOB_OPTIONS`, `generateJobKey`, `MIN_FRIENDS` (`@grani/core`, Task 1); `createPurchase`, `attachPayment`, `getPurchase`, `getPurchaseByPaymentId`, `findOpenPurchase`, `markPurchaseSucceeded`, `markPurchaseCanceled`, `listOwnedProducts`, `listReports`, `ReportTarget`, `PurchaseRecord` (Task 2); `getResultForOwner`, `getPairForMember`, `getInviteForResult`, `countFriendResponses` (планы 3–4).
- Produces:
  ```ts
  // payments/gateway.ts
  type GatewayStatus = "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  type GatewayPayment = { id: string; status: GatewayStatus; paid: boolean; amountKopecks: number; purchaseId: string | null; confirmationUrl: string | null };
  type CreatePaymentInput = { purchaseId: string; amountKopecks: number; description: string; returnUrl: string };
  type PaymentGateway = { createPayment(input: CreatePaymentInput): Promise<GatewayPayment>; getPayment(paymentId: string): Promise<GatewayPayment | null> };
  function kopecksToValue(kopecks: number): string;           // 29900 → "299.00"
  function valueToKopecks(value: unknown): number | null;     // "299.00" → 29900

  // payments/yookassa.ts
  const YOOKASSA_API_URL = "https://api.yookassa.ru/v3";
  function createYooKassaGateway(p: { shopId: string; secretKey: string; fetchFn: typeof fetch; apiUrl?: string }): PaymentGateway;

  // payments/fake.ts
  type FakeGateway = PaymentGateway & { complete(paymentId: string, outcome: "succeeded" | "canceled"): boolean };
  function createFakeGateway(p: { appUrl: string; store?: Map<string, GatewayPayment> }): FakeGateway;

  // payments/ip.ts
  const YOOKASSA_NETWORKS: readonly string[];
  function isYooKassaIp(ip: string | null): boolean;
  function requestIp(headers: Headers): string | null;

  // env.ts
  type PaymentsConfig = { kind: "yookassa"; shopId: string; secretKey: string } | { kind: "fake" } | null;
  type AppEnv = … & { payments: PaymentsConfig };

  // queue.ts
  function enqueueGenerate(job: GenerateJob): Promise<void>;

  // payments-service.ts
  type PaymentsDeps = { db: Database; gateway: PaymentGateway; appUrl: string; now: () => Date; enqueueGenerate: (job: GenerateJob) => Promise<void> };
  type StartPurchaseOutcome = { ok: true; url: string } | { ok: false; error: "not_found" | "not_available" | "payment_failed" };
  type PurchaseView = { id: string; product: Product; status: PurchaseStatus; ready: boolean; reportUrl: string };
  const PRODUCT_DESCRIPTIONS: Readonly<Record<Product, string>>;
  function startPurchase(deps: PaymentsDeps, p: { userId: string; product: unknown; targetId: unknown }): Promise<StartPurchaseOutcome>;
  function syncPayment(deps: PaymentsDeps, paymentId: string): Promise<PurchaseRecord | null>;
  function getPurchaseView(deps: PaymentsDeps, p: { purchaseId: string; userId: string }): Promise<PurchaseView | null>;

  // friends-service.ts
  type FriendsDeps = { db; secret; enqueueNotify; enqueueGenerate: (job: GenerateJob) => Promise<void> };
  ```

Раздел 5.3 спецификации «Оплата» и Global Constraints плана.

- **Сумма** берётся из `PRODUCT_PRICES`; клиент присылает только продукт и id результата или пары. Продукт и цель проверяются до создания покупки: результат должен принадлежать пользователю, пара — быть активной и включать его.
- **Повторное нажатие «Купить»** в течение 30 минут отдаёт ту же страницу оплаты: берётся ожидающая покупка того же продукта и цели с сохранённым `confirmation_url`. Так у пользователя не копятся незавершённые платежи.
- **Синхронизация** (`syncPayment`) — единственная точка, где меняется статус покупки. Её вызывают уведомление ЮKassa и страница ожидания. Статус запрашивается у шлюза; покупка меняется, только если совпали `purchase_id` в метаданных и сумма.
- **Задачи генерации** ставит только тот вызов, чей `markPurchaseSucceeded` вернул `true`. Если в этот момент очередь недоступна, их поставит заново страница ожидания: `getPurchaseView` проверяет, что для оплаченной покупки есть все разборы. Id задачи выводится из `generateJobKey`, поэтому повторная постановка безопасна.
- **Раздел друзей** ставится вместе с полным разбором, если друзей уже трое; иначе — при ответе друга (`friends-service`), когда полный разбор уже оплачен.
- **Поддельный шлюз** хранит платежи в памяти процесса (`globalThis`, переживает перезагрузку модулей в `next dev`). Страница оплаты — `/dev/pay/<paymentId>` (Task 6). Включается только `PAYMENTS_FAKE=1` и только вне production; `readEnv` в production с `PAYMENTS_FAKE=1` падает.
- **IP уведомления** берётся из первого адреса `X-Forwarded-For`. Caddy перед `web` заменяет заголовок, пришедший от клиента, своим, а контейнер `web` наружу не открыт (план 6), поэтому подделать адрес нельзя. Подсети ЮKassa проверяет `BlockList` из `node:net`; адреса вида `::ffff:185.71.76.1` приводятся к IPv4.
- **Описание платежа** — понятное название услуги до 128 знаков: оно попадает в чек «Мой налог».

- [ ] **Step 1: Тесты шлюзов и IP (падают)**

`apps/web/src/server/payments/gateway.test.ts`:
```ts
import { expect, test } from "vitest";
import { kopecksToValue, valueToKopecks } from "./gateway";

test("converts kopecks to the API amount and back", () => {
  expect(kopecksToValue(29900)).toBe("299.00");
  expect(kopecksToValue(9950)).toBe("99.50");
  expect(valueToKopecks("299.00")).toBe(29900);
  expect(valueToKopecks("99.5")).toBe(9950);
  expect(valueToKopecks("abc")).toBeNull();
  expect(valueToKopecks(299)).toBeNull();
});
```

`apps/web/src/server/payments/yookassa.test.ts`:
```ts
import { describe, expect, test, vi } from "vitest";
import { createYooKassaGateway, YOOKASSA_API_URL } from "./yookassa";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const PAYMENT = {
  id: "2c5a-pay",
  status: "pending",
  paid: false,
  amount: { value: "299.00", currency: "RUB" },
  metadata: { purchase_id: "purchase-1" },
  confirmation: { type: "redirect", confirmation_url: "https://yoomoney.ru/checkout/payments/v2/contract?orderId=2c5a-pay" },
};

describe("createYooKassaGateway", () => {
  test("creates a captured redirect payment with the purchase as the idempotence key", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(PAYMENT));
    const gateway = createYooKassaGateway({ shopId: "123", secretKey: "test_secret", fetchFn });

    const payment = await gateway.createPayment({ purchaseId: "purchase-1", amountKopecks: 29900, description: "Полный разбор", returnUrl: "https://grani-test.ru/purchases/purchase-1" });

    expect(payment).toEqual({ id: "2c5a-pay", status: "pending", paid: false, amountKopecks: 29900, purchaseId: "purchase-1", confirmationUrl: PAYMENT.confirmation.confirmation_url });
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe(`${YOOKASSA_API_URL}/payments`);
    expect(init.headers).toMatchObject({ authorization: `Basic ${Buffer.from("123:test_secret").toString("base64")}`, "idempotence-key": "purchase-1" });
    expect(JSON.parse(init.body as string)).toEqual({
      amount: { value: "299.00", currency: "RUB" },
      capture: true,
      confirmation: { type: "redirect", return_url: "https://grani-test.ru/purchases/purchase-1" },
      description: "Полный разбор",
      metadata: { purchase_id: "purchase-1" },
    });
  });

  test("reads a payment, unknown payments are null, errors throw", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(json({ ...PAYMENT, status: "succeeded", paid: true, confirmation: undefined })).mockResolvedValueOnce(json({}, 404)).mockResolvedValueOnce(json({}, 500));
    const gateway = createYooKassaGateway({ shopId: "1", secretKey: "s", fetchFn });

    expect(await gateway.getPayment("2c5a-pay")).toMatchObject({ status: "succeeded", paid: true, confirmationUrl: null });
    expect(fetchFn.mock.calls[0]![0]).toBe(`${YOOKASSA_API_URL}/payments/2c5a-pay`);
    expect(await gateway.getPayment("missing")).toBeNull();
    await expect(gateway.getPayment("broken")).rejects.toThrow(/500/);
  });

  test("rejects a malformed payment body", async () => {
    const gateway = createYooKassaGateway({ shopId: "1", secretKey: "s", fetchFn: vi.fn().mockResolvedValue(json({ id: 1 })) });

    await expect(gateway.getPayment("x")).rejects.toThrow(/malformed/);
  });
});
```

`apps/web/src/server/payments/fake.test.ts`:
```ts
import { expect, test } from "vitest";
import { createFakeGateway } from "./fake";

const INPUT = { purchaseId: "p1", amountKopecks: 29900, description: "d", returnUrl: "http://localhost:3000/purchases/p1" };

test("a fake payment waits for the developer's decision on a local page", async () => {
  const gateway = createFakeGateway({ appUrl: "http://localhost:3000", store: new Map() });

  const payment = await gateway.createPayment(INPUT);

  expect(payment).toMatchObject({ status: "pending", paid: false, amountKopecks: 29900, purchaseId: "p1" });
  expect(payment.confirmationUrl).toBe(`http://localhost:3000/dev/pay/${payment.id}`);
  expect((await gateway.createPayment(INPUT)).id).toBe(payment.id);
  expect(gateway.complete(payment.id, "succeeded")).toBe(true);
  expect(await gateway.getPayment(payment.id)).toMatchObject({ status: "succeeded", paid: true });
  expect(gateway.complete("missing", "canceled")).toBe(false);
  expect(await gateway.getPayment("missing")).toBeNull();
});
```

`apps/web/src/server/payments/ip.test.ts`:
```ts
import { expect, test } from "vitest";
import { isYooKassaIp, requestIp } from "./ip";

test("accepts only YooKassa notification addresses", () => {
  for (const ip of ["185.71.76.1", "185.71.77.31", "77.75.153.100", "77.75.156.11", "77.75.156.35", "77.75.154.200", "2a02:5180::1", "::ffff:185.71.76.5"]) {
    expect(isYooKassaIp(ip), ip).toBe(true);
  }
  for (const ip of ["185.71.76.32", "77.75.156.12", "8.8.8.8", "::1", "not an ip", null]) {
    expect(isYooKassaIp(ip), String(ip)).toBe(false);
  }
});

test("takes the client address that Caddy puts first", () => {
  expect(requestIp(new Headers({ "x-forwarded-for": "185.71.76.1, 10.0.0.2" }))).toBe("185.71.76.1");
  expect(requestIp(new Headers())).toBeNull();
});
```

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run apps/web/src/server/payments
```
Expected: FAIL — модулей нет.

- [ ] **Step 2: Шлюзы и IP**

`apps/web/src/server/payments/gateway.ts`:
```ts
export type GatewayStatus = "pending" | "waiting_for_capture" | "succeeded" | "canceled";
export type GatewayPayment = {
  id: string;
  status: GatewayStatus;
  paid: boolean;
  amountKopecks: number;
  purchaseId: string | null;
  confirmationUrl: string | null;
};
export type CreatePaymentInput = { purchaseId: string; amountKopecks: number; description: string; returnUrl: string };
export type PaymentGateway = {
  createPayment(input: CreatePaymentInput): Promise<GatewayPayment>;
  getPayment(paymentId: string): Promise<GatewayPayment | null>;
};

const KOPECKS = 100;

export function kopecksToValue(kopecks: number): string {
  return (kopecks / KOPECKS).toFixed(2);
}

export function valueToKopecks(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+(\.\d{1,2})?$/.test(value)) return null;
  return Math.round(Number(value) * KOPECKS);
}
```

`apps/web/src/server/payments/yookassa.ts`:
```ts
import { kopecksToValue, valueToKopecks, type GatewayPayment, type GatewayStatus, type PaymentGateway } from "./gateway";

export const YOOKASSA_API_URL = "https://api.yookassa.ru/v3";
const STATUSES: readonly GatewayStatus[] = ["pending", "waiting_for_capture", "succeeded", "canceled"];
const NOT_FOUND = 404;

type PaymentBody = {
  id?: unknown;
  status?: unknown;
  paid?: unknown;
  amount?: { value?: unknown };
  metadata?: { purchase_id?: unknown };
  confirmation?: { confirmation_url?: unknown };
};

function parsePayment(body: PaymentBody): GatewayPayment {
  const amountKopecks = valueToKopecks(body.amount?.value);
  if (typeof body.id !== "string" || !STATUSES.includes(body.status as GatewayStatus) || typeof body.paid !== "boolean" || amountKopecks === null) {
    throw new Error("YooKassa returned a malformed payment");
  }
  return {
    id: body.id,
    status: body.status as GatewayStatus,
    paid: body.paid,
    amountKopecks,
    purchaseId: typeof body.metadata?.purchase_id === "string" ? body.metadata.purchase_id : null,
    confirmationUrl: typeof body.confirmation?.confirmation_url === "string" ? body.confirmation.confirmation_url : null,
  };
}

export function createYooKassaGateway(p: { shopId: string; secretKey: string; fetchFn: typeof fetch; apiUrl?: string }): PaymentGateway {
  const base = p.apiUrl ?? YOOKASSA_API_URL;
  const authorization = `Basic ${Buffer.from(`${p.shopId}:${p.secretKey}`).toString("base64")}`;

  return {
    async createPayment(input) {
      const response = await p.fetchFn(`${base}/payments`, {
        method: "POST",
        // Ключ идемпотентности — id покупки: повтор запроса после сбоя сети не создаст второй платёж
        headers: { authorization, "idempotence-key": input.purchaseId, "content-type": "application/json" },
        body: JSON.stringify({
          amount: { value: kopecksToValue(input.amountKopecks), currency: "RUB" },
          capture: true,
          confirmation: { type: "redirect", return_url: input.returnUrl },
          description: input.description,
          metadata: { purchase_id: input.purchaseId },
        }),
      });
      if (!response.ok) throw new Error(`YooKassa create payment responded ${response.status}`);
      return parsePayment((await response.json()) as PaymentBody);
    },
    async getPayment(paymentId) {
      const response = await p.fetchFn(`${base}/payments/${encodeURIComponent(paymentId)}`, { headers: { authorization } });
      if (response.status === NOT_FOUND) return null;
      if (!response.ok) throw new Error(`YooKassa get payment responded ${response.status}`);
      return parsePayment((await response.json()) as PaymentBody);
    },
  };
}
```

`apps/web/src/server/payments/fake.ts`:
```ts
import { randomUUID } from "node:crypto";
import type { GatewayPayment, PaymentGateway } from "./gateway";

export type FakeGateway = PaymentGateway & { complete(paymentId: string, outcome: "succeeded" | "canceled"): boolean };

// Платежи живут в памяти процесса; globalThis переживает перезагрузку модулей в next dev
const holder = globalThis as typeof globalThis & { __graniFakePayments?: Map<string, GatewayPayment> };

export function createFakeGateway(p: { appUrl: string; store?: Map<string, GatewayPayment> }): FakeGateway {
  const store = p.store ?? (holder.__graniFakePayments ??= new Map());
  return {
    async createPayment(input) {
      const existing = [...store.values()].find((payment) => payment.purchaseId === input.purchaseId);
      if (existing) return existing;
      const id = `fake-${randomUUID()}`;
      const payment: GatewayPayment = {
        id,
        status: "pending",
        paid: false,
        amountKopecks: input.amountKopecks,
        purchaseId: input.purchaseId,
        confirmationUrl: new URL(`/dev/pay/${id}`, p.appUrl).toString(),
      };
      store.set(id, payment);
      return payment;
    },
    async getPayment(paymentId) {
      return store.get(paymentId) ?? null;
    },
    complete(paymentId, outcome) {
      const payment = store.get(paymentId);
      if (!payment) return false;
      store.set(paymentId, { ...payment, status: outcome, paid: outcome === "succeeded" });
      return true;
    },
  };
}
```

`apps/web/src/server/payments/ip.ts`:
```ts
import { BlockList, isIP } from "node:net";

// Адреса, с которых ЮKassa присылает уведомления (документация «Входящие уведомления»)
export const YOOKASSA_NETWORKS: readonly string[] = [
  "185.71.76.0/27",
  "185.71.77.0/27",
  "77.75.153.0/25",
  "77.75.156.11/32",
  "77.75.156.35/32",
  "77.75.154.128/25",
  "2a02:5180::/32",
];

const allowed = new BlockList();
for (const network of YOOKASSA_NETWORKS) {
  const [address, prefix] = network.split("/") as [string, string];
  allowed.addSubnet(address, Number(prefix), isIP(address) === 6 ? "ipv6" : "ipv4");
}

const MAPPED_IPV4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;

export function isYooKassaIp(ip: string | null): boolean {
  if (!ip) return false;
  const address = ip.match(MAPPED_IPV4)?.[1] ?? ip;
  const family = isIP(address);
  if (family === 0) return false;
  return allowed.check(address, family === 6 ? "ipv6" : "ipv4");
}

// Caddy заменяет X-Forwarded-For, пришедший от клиента, поэтому первый адрес — настоящий
export function requestIp(headers: Headers): string | null {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}
```

```bash
pnpm vitest run apps/web/src/server/payments
```
Expected: PASS.

- [ ] **Step 3: Окружение и очередь**

В `apps/web/src/server/env.ts`:
- в схему добавить
  ```ts
  YOOKASSA_SHOP_ID: z.string().regex(/^\d+$/).optional(),
  YOOKASSA_SECRET_KEY: z.string().min(1).optional(),
  PAYMENTS_FAKE: z.enum(["0", "1"]).optional(),
  NODE_ENV: z.string().optional(),
  ```
- тип и сборку:
  ```ts
  export type PaymentsConfig = { kind: "yookassa"; shopId: string; secretKey: string } | { kind: "fake" } | null;
  const PAYMENT_KEYS = ["YOOKASSA_SHOP_ID", "YOOKASSA_SECRET_KEY", "PAYMENTS_FAKE", "NODE_ENV"] as const;
  export type AppEnv = Omit<ParsedEnv, (typeof VK_COMMUNITY_KEYS)[number] | (typeof PAYMENT_KEYS)[number]> & {
    vkCommunity: VkCommunityConfig | null;
    payments: PaymentsConfig;
  };

  function readPayments(env: ParsedEnv): PaymentsConfig {
    // Поддельная оплата — только для разработки и сквозных тестов, как dev-вход
    if (env.PAYMENTS_FAKE === "1") {
      if (env.NODE_ENV === "production") fail(["PAYMENTS_FAKE"]);
      return { kind: "fake" };
    }
    if (env.YOOKASSA_SHOP_ID && env.YOOKASSA_SECRET_KEY) return { kind: "yookassa", shopId: env.YOOKASSA_SHOP_ID, secretKey: env.YOOKASSA_SECRET_KEY };
    if (env.YOOKASSA_SHOP_ID || env.YOOKASSA_SECRET_KEY) fail(env.YOOKASSA_SHOP_ID ? ["YOOKASSA_SECRET_KEY"] : ["YOOKASSA_SHOP_ID"]);
    return null;
  }
  ```
- в `readEnv` деструктурировать и отбросить новые ключи: `const { VK_GROUP_ID, VK_CALLBACK_SECRET, VK_CONFIRMATION_CODE, YOOKASSA_SHOP_ID: _shop, YOOKASSA_SECRET_KEY: _key, PAYMENTS_FAKE: _fake, NODE_ENV: _nodeEnv, ...rest } = parsed.data;` и вернуть `{ ...rest, vkCommunity, payments: readPayments(parsed.data) }`.

В `apps/web/src/server/env.test.ts`: ожидание `"accepts a complete environment"` — `{ ...VALID, vkCommunity: null, payments: null }`; дописать
```ts
describe("payment settings", () => {
  test("read YooKassa keys together", () => {
    expect(readEnv({ ...VALID, YOOKASSA_SHOP_ID: "123456", YOOKASSA_SECRET_KEY: "live_x" }).payments).toEqual({ kind: "yookassa", shopId: "123456", secretKey: "live_x" });
    expect(() => readEnv({ ...VALID, YOOKASSA_SHOP_ID: "123456" })).toThrow(/YOOKASSA_SECRET_KEY/);
  });

  test("fake payments work only outside production", () => {
    expect(readEnv({ ...VALID, PAYMENTS_FAKE: "1", NODE_ENV: "development" }).payments).toEqual({ kind: "fake" });
    expect(() => readEnv({ ...VALID, PAYMENTS_FAKE: "1", NODE_ENV: "production" })).toThrow(/PAYMENTS_FAKE/);
  });
});
```
В `apps/web/src/server/login-service.test.ts` в объект `ENV` добавить `payments: null,`.

В `apps/web/.env.development.example` добавить строки `PAYMENTS_FAKE=1` и `AI_PROVIDER=none` (вторая — для воркера, Task 7). Их же дописать себе в `apps/web/.env.development.local`.

В `apps/web/src/server/queue.ts`: в импорт из `@grani/core` добавить `GENERATE_JOB_OPTIONS`, `generateJobKey`, `type GenerateJob`; дописать
```ts
export async function enqueueGenerate(job: GenerateJob): Promise<void> {
  try {
    const boss = await queue();
    await boss.send(QUEUES.generate, job, { ...GENERATE_JOB_OPTIONS, id: jobIdFor(generateJobKey(job)) });
  } catch (error) {
    // Оплата уже зафиксирована; страница ожидания поставит задачу заново
    console.error("enqueue generate failed", { kind: job.kind, error: String(error) });
  }
}
```

- [ ] **Step 4: Тесты сервиса покупок (падают)**

`apps/web/src/server/payments-service.test.ts`:
```ts
import { FRIEND_ITEMS } from "@grani/content";
import {
  addFriendResponse,
  createTestDb,
  getOrCreateInvite,
  getPurchase,
  saveReport,
  seedPair,
  seedUserWithResult,
  type Database,
} from "@grani/db/testing";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createFakeGateway, type FakeGateway } from "./payments/fake";
import type { GatewayPayment } from "./payments/gateway";
import { getPurchaseView, startPurchase, syncPayment, type PaymentsDeps } from "./payments-service";

const APP_URL = "http://localhost:3000";
const NOW = new Date("2026-09-22T10:00:00Z");

let db: Database;
let store: Map<string, GatewayPayment>;
let gateway: FakeGateway;
let deps: PaymentsDeps;
let enqueue: ReturnType<typeof vi.fn>;
let anna: { userId: string; resultId: string };

beforeEach(async () => {
  db = await createTestDb();
  store = new Map();
  gateway = createFakeGateway({ appUrl: APP_URL, store });
  enqueue = vi.fn().mockResolvedValue(undefined);
  deps = { db, gateway, appUrl: APP_URL, now: () => NOW, enqueueGenerate: enqueue };
  anna = await seedUserWithResult(db, { externalId: "anna" });
});

const paymentOf = (url: string) => url.split("/dev/pay/")[1]!;

async function buyAndPay(product: string, targetId = anna.resultId, userId = anna.userId) {
  const outcome = await startPurchase(deps, { userId, product, targetId });
  if (!outcome.ok) throw new Error(outcome.error);
  gateway.complete(paymentOf(outcome.url), "succeeded");
  return syncPayment(deps, paymentOf(outcome.url));
}

describe("startPurchase", () => {
  test("creates a payment for the server price and returns the payment page", async () => {
    const outcome = await startPurchase(deps, { userId: anna.userId, product: "full", targetId: anna.resultId });

    expect(outcome.ok).toBe(true);
    const payment = store.get(paymentOf(outcome.ok ? outcome.url : ""))!;
    expect(payment.amountKopecks).toBe(29900);
    expect(await getPurchase(db, payment.purchaseId!)).toMatchObject({ status: "pending", yookassaPaymentId: payment.id, product: "full" });
  });

  test("reuses the payment page of a recent unfinished purchase", async () => {
    const first = await startPurchase(deps, { userId: anna.userId, product: "full", targetId: anna.resultId });
    const second = await startPurchase(deps, { userId: anna.userId, product: "full", targetId: anna.resultId });

    expect(second).toEqual(first);
    expect(store.size).toBe(1);
  });

  test("refuses unknown products, foreign targets and what the rules do not allow", async () => {
    const boris = await seedUserWithResult(db, { externalId: "boris" });

    expect(await startPurchase(deps, { userId: anna.userId, product: "gold", targetId: anna.resultId })).toEqual({ ok: false, error: "not_found" });
    expect(await startPurchase(deps, { userId: boris.userId, product: "full", targetId: anna.resultId })).toEqual({ ok: false, error: "not_found" });
    expect(await startPurchase(deps, { userId: anna.userId, product: "pair", targetId: anna.resultId })).toEqual({ ok: false, error: "not_found" });
    expect(await startPurchase(deps, { userId: anna.userId, product: "chapter_money", targetId: anna.resultId })).toEqual({ ok: false, error: "not_available" });
    await buyAndPay("full");
    expect(await startPurchase(deps, { userId: anna.userId, product: "full", targetId: anna.resultId })).toEqual({ ok: false, error: "not_available" });
  });

  test("a failed payment request cancels the purchase", async () => {
    deps.gateway = { ...gateway, createPayment: vi.fn().mockRejectedValue(new Error("503")) };

    expect(await startPurchase(deps, { userId: anna.userId, product: "full", targetId: anna.resultId })).toEqual({ ok: false, error: "payment_failed" });
  });
});

describe("syncPayment", () => {
  test("a pending payment changes nothing, a paid one succeeds once and enqueues generation once", async () => {
    const outcome = await startPurchase(deps, { userId: anna.userId, product: "full", targetId: anna.resultId });
    const paymentId = paymentOf(outcome.ok ? outcome.url : "");

    expect((await syncPayment(deps, paymentId))?.status).toBe("pending");
    gateway.complete(paymentId, "succeeded");
    expect((await syncPayment(deps, paymentId))?.status).toBe("succeeded");
    await syncPayment(deps, paymentId);

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith({ kind: "full", resultId: anna.resultId });
  });

  test("ignores a payment whose amount or purchase does not match", async () => {
    const outcome = await startPurchase(deps, { userId: anna.userId, product: "full", targetId: anna.resultId });
    const paymentId = paymentOf(outcome.ok ? outcome.url : "");
    store.set(paymentId, { ...store.get(paymentId)!, status: "succeeded", paid: true, amountKopecks: 100 });

    expect((await syncPayment(deps, paymentId))?.status).toBe("pending");
    expect(enqueue).not.toHaveBeenCalled();
    expect(await syncPayment(deps, "unknown")).toBeNull();
  });

  test("a canceled payment cancels the purchase", async () => {
    const outcome = await startPurchase(deps, { userId: anna.userId, product: "full", targetId: anna.resultId });
    const paymentId = paymentOf(outcome.ok ? outcome.url : "");
    gateway.complete(paymentId, "canceled");

    expect((await syncPayment(deps, paymentId))?.status).toBe("canceled");
  });

  test("the bundle enqueues four chapters, the pair report goes to the pair", async () => {
    await buyAndPay("full");
    enqueue.mockClear();
    await buyAndPay("chapters_all");
    const { pairId, b } = await seedPair(db);
    await buyAndPay("pair", pairId, b.userId);

    expect(enqueue.mock.calls.map((call) => call[0])).toEqual([
      { kind: "chapter_money", resultId: anna.resultId },
      { kind: "chapter_conflict", resultId: anna.resultId },
      { kind: "chapter_stress", resultId: anna.resultId },
      { kind: "chapter_relationships", resultId: anna.resultId },
      { kind: "pair", pairId },
    ]);
  });

  test("the full report brings the friends section when three friends already answered", async () => {
    const { id: inviteId } = await getOrCreateInvite(db, anna.resultId);
    const answers = Object.fromEntries(FRIEND_ITEMS.map((item) => [item.id, 3 as const]));
    for (const device of ["a", "b", "c"]) await addFriendResponse(db, { inviteId, answers, deviceHash: device });

    await buyAndPay("full");

    expect(enqueue).toHaveBeenCalledWith({ kind: "friends", resultId: anna.resultId });
  });
});

describe("getPurchaseView", () => {
  test("syncs a pending purchase, reports readiness and hides other people's purchases", async () => {
    const outcome = await startPurchase(deps, { userId: anna.userId, product: "full", targetId: anna.resultId });
    const payment = store.get(paymentOf(outcome.ok ? outcome.url : ""))!;
    gateway.complete(payment.id, "succeeded");
    const purchaseId = payment.purchaseId!;

    expect(await getPurchaseView(deps, { purchaseId, userId: anna.userId })).toEqual({
      id: purchaseId,
      product: "full",
      status: "succeeded",
      ready: false,
      reportUrl: `/report/${anna.resultId}`,
    });
    await saveReport(db, { target: { resultId: anna.resultId }, kind: "full", sections: {}, source: "fallback" });
    expect((await getPurchaseView(deps, { purchaseId, userId: anna.userId }))?.ready).toBe(true);
    expect(await getPurchaseView(deps, { purchaseId, userId: "00000000-0000-0000-0000-000000000000" })).toBeNull();
  });

  test("enqueues missing reports of a paid purchase again", async () => {
    await buyAndPay("full");
    const purchaseId = [...store.values()][0]!.purchaseId!;
    enqueue.mockClear();

    await getPurchaseView(deps, { purchaseId, userId: anna.userId });

    expect(enqueue).toHaveBeenCalledWith({ kind: "full", resultId: anna.resultId });
  });
});
```

В `apps/web/src/server/friends-service.test.ts`: в `beforeEach` к `deps` добавить `enqueueGenerate: vi.fn().mockResolvedValue(undefined)`; дописать
```ts
describe("friends report", () => {
  test("the third answer enqueues the friends section only when the full report is paid", async () => {
    await answer(3);
    await answer(3);
    await answer(3);
    expect(deps.enqueueGenerate).not.toHaveBeenCalled();

    const purchase = await createPurchase(db, { userId: owner.userId, product: "full", target: { resultId: owner.resultId }, amountKopecks: 29900 });
    await markPurchaseSucceeded(db, purchase.id, new Date());
    await answer(4);

    expect(deps.enqueueGenerate).toHaveBeenCalledWith({ kind: "friends", resultId: owner.resultId });
  });
});
```
с `createPurchase` и `markPurchaseSucceeded` в импорте из `@grani/db/testing`.

```bash
pnpm vitest run apps/web/src/server
```
Expected: FAIL — нет `./payments-service`, `enqueueGenerate` в `FriendsDeps`.

- [ ] **Step 5: Сервис покупок и раздел друзей**

`apps/web/src/server/payments-service.ts`:
```ts
import { canBuy, friendsReportDue, isProduct, PRODUCT_PRICES, productTarget, reportKindsFor, type GenerateJob, type Product } from "@grani/core";
import {
  attachPayment,
  countFriendResponses,
  createPurchase,
  findOpenPurchase,
  getInviteForResult,
  getPairForMember,
  getPurchase,
  getPurchaseByPaymentId,
  getResultForOwner,
  listOwnedProducts,
  listReports,
  markPurchaseCanceled,
  markPurchaseSucceeded,
  type Database,
  type PurchaseRecord,
  type PurchaseStatus,
  type ReportTarget,
} from "@grani/db";
import type { PaymentGateway } from "./payments/gateway";

export type PaymentsDeps = { db: Database; gateway: PaymentGateway; appUrl: string; now: () => Date; enqueueGenerate: (job: GenerateJob) => Promise<void> };
export type StartPurchaseOutcome = { ok: true; url: string } | { ok: false; error: "not_found" | "not_available" | "payment_failed" };
export type PurchaseView = { id: string; product: Product; status: PurchaseStatus; ready: boolean; reportUrl: string };

const REUSE_WINDOW_MS = 30 * 60_000;

// Попадает в чек «Мой налог» — название услуги, до 128 знаков
export const PRODUCT_DESCRIPTIONS: Readonly<Record<Product, string>> = {
  full: "Полный разбор личности «Грани»",
  chapter_money: "Глава «Деньги» к разбору личности «Грани»",
  chapter_conflict: "Глава «Конфликты» к разбору личности «Грани»",
  chapter_stress: "Глава «Стресс» к разбору личности «Грани»",
  chapter_relationships: "Глава «Отношения» к разбору личности «Грани»",
  chapters_all: "Четыре главы к разбору личности «Грани»",
  pair: "Разбор совместимости пары «Грани»",
};

async function resolveTarget(db: Database, userId: string, product: Product, targetId: string): Promise<ReportTarget | null> {
  if (productTarget(product) === "pair") return (await getPairForMember(db, targetId, userId)) ? { pairId: targetId } : null;
  return (await getResultForOwner(db, targetId, userId)) ? { resultId: targetId } : null;
}

const purchaseTarget = (purchase: PurchaseRecord): ReportTarget | null =>
  purchase.pairId ? { pairId: purchase.pairId } : purchase.resultId ? { resultId: purchase.resultId } : null;

function jobsFor(product: Product, target: ReportTarget): GenerateJob[] {
  if ("pairId" in target) return [{ kind: "pair", pairId: target.pairId }];
  return reportKindsFor(product).flatMap((kind): GenerateJob[] => (kind === "pair" ? [] : [{ kind, resultId: target.resultId }]));
}

async function friendsCount(db: Database, resultId: string): Promise<number> {
  const invite = await getInviteForResult(db, resultId);
  return invite ? countFriendResponses(db, invite.id) : 0;
}

async function enqueuePaid(deps: PaymentsDeps, purchase: PurchaseRecord): Promise<void> {
  const target = purchaseTarget(purchase);
  if (!target) return;
  const jobs = jobsFor(purchase.product, target);
  if ("resultId" in target && purchase.product === "full" && friendsReportDue(["full"], await friendsCount(deps.db, target.resultId))) {
    jobs.push({ kind: "friends", resultId: target.resultId });
  }
  for (const job of jobs) await deps.enqueueGenerate(job);
}

export async function startPurchase(deps: PaymentsDeps, p: { userId: string; product: unknown; targetId: unknown }): Promise<StartPurchaseOutcome> {
  if (!isProduct(p.product) || typeof p.targetId !== "string") return { ok: false, error: "not_found" };
  const product = p.product;
  const target = await resolveTarget(deps.db, p.userId, product, p.targetId);
  if (!target) return { ok: false, error: "not_found" };
  if (!canBuy(product, await listOwnedProducts(deps.db, target))) return { ok: false, error: "not_available" };

  const since = new Date(deps.now().getTime() - REUSE_WINDOW_MS);
  const open = await findOpenPurchase(deps.db, { userId: p.userId, product, target, since });
  if (open?.confirmationUrl) return { ok: true, url: open.confirmationUrl };

  const purchase = await createPurchase(deps.db, { userId: p.userId, product, target, amountKopecks: PRODUCT_PRICES[product] });
  try {
    const payment = await deps.gateway.createPayment({
      purchaseId: purchase.id,
      amountKopecks: purchase.amountKopecks,
      description: PRODUCT_DESCRIPTIONS[product],
      returnUrl: new URL(`/purchases/${purchase.id}`, deps.appUrl).toString(),
    });
    if (!payment.confirmationUrl) throw new Error("payment has no confirmation url");
    await attachPayment(deps.db, purchase.id, { paymentId: payment.id, confirmationUrl: payment.confirmationUrl });
    return { ok: true, url: payment.confirmationUrl };
  } catch (error) {
    console.error("payment was not created", { purchaseId: purchase.id, error: String(error) });
    await markPurchaseCanceled(deps.db, purchase.id);
    return { ok: false, error: "payment_failed" };
  }
}

// Единственное место, где меняется статус покупки: по ответу API шлюза, а не по телу уведомления
export async function syncPayment(deps: PaymentsDeps, paymentId: string): Promise<PurchaseRecord | null> {
  const purchase = await getPurchaseByPaymentId(deps.db, paymentId);
  if (!purchase) return null;
  if (purchase.status !== "pending") return purchase;
  const payment = await deps.gateway.getPayment(paymentId);
  if (!payment) return purchase;
  if (payment.purchaseId !== purchase.id || payment.amountKopecks !== purchase.amountKopecks) {
    console.warn("payment does not match the purchase", { purchaseId: purchase.id, paymentId });
    return purchase;
  }
  if (payment.status === "succeeded" && payment.paid) {
    if (await markPurchaseSucceeded(deps.db, purchase.id, deps.now())) await enqueuePaid(deps, purchase);
  } else if (payment.status === "canceled") {
    await markPurchaseCanceled(deps.db, purchase.id);
  }
  return getPurchase(deps.db, purchase.id);
}

export async function getPurchaseView(deps: PaymentsDeps, p: { purchaseId: string; userId: string }): Promise<PurchaseView | null> {
  let purchase = await getPurchase(deps.db, p.purchaseId);
  if (!purchase || purchase.userId !== p.userId) return null;
  if (purchase.status === "pending" && purchase.yookassaPaymentId) purchase = (await syncPayment(deps, purchase.yookassaPaymentId)) ?? purchase;

  const target = purchaseTarget(purchase);
  const reportUrl = !target ? "/me" : "pairId" in target ? `/pair/${target.pairId}` : `/report/${target.resultId}`;
  if (!target) return { id: purchase.id, product: purchase.product, status: purchase.status, ready: false, reportUrl };

  const kinds = new Set((await listReports(deps.db, target)).map((report) => report.kind));
  const ready = jobsFor(purchase.product, target).every((job) => kinds.has(job.kind));
  // Задачи могли не встать в очередь в момент оплаты — ставим недостающие ещё раз, id задачи тот же
  if (purchase.status === "succeeded" && !ready) {
    for (const job of jobsFor(purchase.product, target)) if (!kinds.has(job.kind)) await deps.enqueueGenerate(job);
  }
  return { id: purchase.id, product: purchase.product, status: purchase.status, ready, reportUrl };
}
```

В `apps/web/src/server/friends-service.ts`:
- `FriendsDeps` дополнить полем `enqueueGenerate: (job: GenerateJob) => Promise<void>` (тип `GenerateJob` — в импорт из `@grani/core`, туда же `friendsReportDue`), `listOwnedProducts` — в импорт из `@grani/db`;
- в `submitFriendAnswers` после постановки уведомления:
  ```ts
  // Раздел «как меня видят другие» генерируется один раз, когда оплачен полный разбор и ответили трое
  const owned = friendsCount >= MIN_FRIENDS ? await listOwnedProducts(deps.db, { resultId: invite.resultId }) : [];
  if (friendsReportDue(owned, friendsCount)) await deps.enqueueGenerate({ kind: "friends", resultId: invite.resultId });
  ```

В `apps/web/src/app/api/f/[token]/route.ts` в вызов `submitFriendAnswers` передать `enqueueGenerate` (импорт из `@/server/queue`).

- [ ] **Step 6: Запуск и коммит**

```bash
pnpm test && pnpm typecheck
```
Expected: всё зелёное.

```bash
git add apps/web/src/server apps/web/src/app/api/f apps/web/.env.development.example
git commit -m "feat(web): YooKassa and fake payment gateways, notification IP check, purchases service with idempotent success"
```
