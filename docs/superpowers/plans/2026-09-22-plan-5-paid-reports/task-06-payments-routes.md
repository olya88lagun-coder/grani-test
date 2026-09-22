# Task 6: Маршруты покупки, статуса и уведомления ЮKassa, страница поддельной оплаты

**Files:**
- Create: `apps/web/src/server/payments-deps.ts`, `payments-deps.test.ts`
- Create: `apps/web/src/app/api/purchases/route.ts`, `apps/web/src/app/api/purchases/[id]/route.ts`, `apps/web/src/app/api/yookassa/notification/route.ts`
- Create: `apps/web/src/app/api/dev/pay/[id]/route.ts`, `apps/web/src/app/dev/pay/[id]/page.tsx`
- Modify: `apps/web/src/server/rate-limit.ts`

**Interfaces:**
- Consumes: `startPurchase`, `syncPayment`, `getPurchaseView`, `PaymentsDeps` (Task 5); `createYooKassaGateway`, `createFakeGateway`, `isYooKassaIp`, `requestIp`, `PaymentsConfig` (Task 5); `enqueueGenerate` (Task 5); `isSameOrigin`, `SESSION_COOKIE`, `getCurrentUser`, `loginDeps`, `clientKeyFromHeaders`, `currentUser` (план 3); `formatRub` (`@grani/core`).
- Produces:
  ```ts
  // payments-deps.ts
  function createGateway(config: PaymentsConfig, p: { appUrl: string; fetchFn: typeof fetch }): PaymentGateway | null;
  function paymentsDeps(): PaymentsDeps | null;   // null — оплата не настроена
  function fakeGateway(): FakeGateway | null;     // только при PAYMENTS_FAKE=1

  // rate-limit.ts
  const purchasesLimiter: RateLimiter;            // 10 в минуту
  ```

Маршруты:
- `POST /api/purchases` — тело `{ product, targetId }`, нужен вход и `Origin` = `APP_URL`. Ответы: `{ ok: true, url }` (адрес страницы оплаты); `401 unauthorized`; `403 bad_origin`; `404 not_found`; `409 not_available`; `429 rate_limited`; `502 payment_failed`; `503 payments_unavailable` (оплата не настроена).
- `GET /api/purchases/<id>` — нужен вход; ответ `PurchaseView` покупателя или `404`. Страница ожидания (Task 8) опрашивает его каждые 3 секунды.
- `POST /api/yookassa/notification` — без проверки `Origin`: подлинность подтверждают IP ЮKassa (иначе `403`) и повторный запрос статуса в `syncPayment`. Тело `{ event, object: { id } }`; при ошибке базы или API — `500`, чтобы ЮKassa повторила уведомление; иначе `200` (и для неизвестного платежа — повторять его бесполезно). При поддельном шлюзе или без настроек — `404`.
- `GET /dev/pay/<paymentId>` и `POST /api/dev/pay/<paymentId>` — только при `PAYMENTS_FAKE=1`: страница с суммой и кнопками «Оплатить» и «Отменить»; кнопка меняет платёж в поддельном шлюзе, синхронизирует покупку и возвращает на `/purchases/<id>`, как это сделала бы ЮKassa.

- [ ] **Step 1: Тест выбора шлюза (падает)**

`apps/web/src/server/payments-deps.test.ts`:
```ts
import { expect, test, vi } from "vitest";
import { createGateway } from "./payments-deps";

test("picks the gateway from the settings", async () => {
  const fetchFn = vi.fn();

  expect(createGateway(null, { appUrl: "http://localhost:3000", fetchFn })).toBeNull();
  const fake = createGateway({ kind: "fake" }, { appUrl: "http://localhost:3000", fetchFn })!;
  const payment = await fake.createPayment({ purchaseId: "p-deps", amountKopecks: 100, description: "d", returnUrl: "r" });
  expect(payment.confirmationUrl).toMatch(/^http:\/\/localhost:3000\/dev\/pay\/fake-/);
  expect(createGateway({ kind: "yookassa", shopId: "1", secretKey: "s" }, { appUrl: "x", fetchFn })).not.toBeNull();
  expect(fetchFn).not.toHaveBeenCalled();
});
```

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run apps/web/src/server/payments-deps.test.ts
```
Expected: FAIL — модуля нет.

- [ ] **Step 2: Зависимости оплаты**

`apps/web/src/server/payments-deps.ts`:
```ts
import { getDb } from "./db";
import { getEnv, type PaymentsConfig } from "./env";
import { createFakeGateway, type FakeGateway } from "./payments/fake";
import type { PaymentGateway } from "./payments/gateway";
import { createYooKassaGateway } from "./payments/yookassa";
import type { PaymentsDeps } from "./payments-service";
import { enqueueGenerate } from "./queue";

export function createGateway(config: PaymentsConfig, p: { appUrl: string; fetchFn: typeof fetch }): PaymentGateway | null {
  if (!config) return null;
  if (config.kind === "fake") return createFakeGateway({ appUrl: p.appUrl });
  return createYooKassaGateway({ shopId: config.shopId, secretKey: config.secretKey, fetchFn: p.fetchFn });
}

export function paymentsDeps(): PaymentsDeps | null {
  const env = getEnv();
  const gateway = createGateway(env.payments, { appUrl: env.APP_URL, fetchFn: (input, init) => fetch(input, init) });
  if (!gateway) return null;
  return { db: getDb(), gateway, appUrl: env.APP_URL, now: () => new Date(), enqueueGenerate };
}

export function fakeGateway(): FakeGateway | null {
  const env = getEnv();
  return env.payments?.kind === "fake" ? createFakeGateway({ appUrl: env.APP_URL }) : null;
}
```

В `apps/web/src/server/rate-limit.ts`:
```ts
const PURCHASES_PER_MINUTE = 10;

export const purchasesLimiter = createRateLimiter({ limit: PURCHASES_PER_MINUTE, windowMs: MINUTE_MS });
```

```bash
pnpm vitest run apps/web/src/server/payments-deps.test.ts
```
Expected: PASS.

- [ ] **Step 3: Маршруты покупки и статуса**

`apps/web/src/app/api/purchases/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { loginDeps } from "@/server/deps";
import { isSameOrigin, SESSION_COOKIE } from "@/server/http";
import { getCurrentUser } from "@/server/login-service";
import { paymentsDeps } from "@/server/payments-deps";
import { startPurchase, type StartPurchaseOutcome } from "@/server/payments-service";
import { clientKeyFromHeaders, purchasesLimiter } from "@/server/rate-limit";

const STATUS: Record<Extract<StartPurchaseOutcome, { ok: false }>["error"], number> = {
  not_found: 404,
  not_available: 409,
  payment_failed: 502,
};

export async function POST(request: NextRequest) {
  const login = loginDeps();
  if (!isSameOrigin(request, login.env.APP_URL)) return NextResponse.json({ ok: false, error: "bad_origin" }, { status: 403 });
  if (!purchasesLimiter.allow(clientKeyFromHeaders(request.headers))) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  const user = await getCurrentUser(login, request.cookies.get(SESSION_COOKIE)?.value ?? null);
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const deps = paymentsDeps();
  if (!deps) return NextResponse.json({ ok: false, error: "payments_unavailable" }, { status: 503 });

  const body: unknown = await request.json().catch(() => null);
  const { product, targetId } = typeof body === "object" && body !== null ? (body as { product?: unknown; targetId?: unknown }) : {};
  const outcome = await startPurchase(deps, { userId: user.id, product, targetId });
  if (!outcome.ok) return NextResponse.json({ ok: false, error: outcome.error }, { status: STATUS[outcome.error] });
  return NextResponse.json(outcome);
}
```

`apps/web/src/app/api/purchases/[id]/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { loginDeps } from "@/server/deps";
import { SESSION_COOKIE } from "@/server/http";
import { getCurrentUser } from "@/server/login-service";
import { paymentsDeps } from "@/server/payments-deps";
import { getPurchaseView } from "@/server/payments-service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const login = loginDeps();
  const user = await getCurrentUser(login, request.cookies.get(SESSION_COOKIE)?.value ?? null);
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const deps = paymentsDeps();
  const { id } = await params;
  const view = deps ? await getPurchaseView(deps, { purchaseId: id, userId: user.id }) : null;
  if (!view) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, ...view }, { headers: { "cache-control": "no-store" } });
}
```

- [ ] **Step 4: Уведомление ЮKassa**

`apps/web/src/app/api/yookassa/notification/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/server/env";
import { isYooKassaIp, requestIp } from "@/server/payments/ip";
import { paymentsDeps } from "@/server/payments-deps";
import { syncPayment } from "@/server/payments-service";

// Origin здесь не проверяется: запрос приходит с серверов ЮKassa. Подлинность — IP и повторный запрос статуса
export async function POST(request: NextRequest) {
  if (getEnv().payments?.kind !== "yookassa") return new NextResponse(null, { status: 404 });
  if (!isYooKassaIp(requestIp(request.headers))) return new NextResponse(null, { status: 403 });
  const deps = paymentsDeps();
  if (!deps) return new NextResponse(null, { status: 404 });

  const body: unknown = await request.json().catch(() => null);
  const paymentId = typeof body === "object" && body !== null ? (body as { object?: { id?: unknown } }).object?.id : undefined;
  // Неизвестный формат или платёж — отвечаем 200: повтор ничего не изменит
  if (typeof paymentId !== "string") return new NextResponse(null, { status: 200 });
  try {
    await syncPayment(deps, paymentId);
  } catch (error) {
    console.error("payment notification failed", { paymentId, error: String(error) });
    return new NextResponse(null, { status: 500 });
  }
  return new NextResponse(null, { status: 200 });
}
```

- [ ] **Step 5: Поддельная оплата**

`apps/web/src/app/api/dev/pay/[id]/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/server/env";
import { isSameOrigin } from "@/server/http";
import { fakeGateway, paymentsDeps } from "@/server/payments-deps";
import { syncPayment } from "@/server/payments-service";

// Только локально и в сквозных тестах: заменяет страницу оплаты ЮKassa
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gateway = fakeGateway();
  const deps = paymentsDeps();
  if (!gateway || !deps) return new NextResponse(null, { status: 404 });
  if (!isSameOrigin(request, getEnv().APP_URL)) return new NextResponse(null, { status: 403 });
  const { id } = await params;
  const form = await request.formData();
  const outcome = form.get("outcome") === "succeeded" ? "succeeded" : "canceled";
  const payment = await gateway.getPayment(id);
  if (!payment || !gateway.complete(id, outcome)) return new NextResponse(null, { status: 404 });
  await syncPayment(deps, id);
  return NextResponse.redirect(new URL(`/purchases/${payment.purchaseId}`, getEnv().APP_URL), 303);
}
```

`apps/web/src/app/dev/pay/[id]/page.tsx`:
```tsx
import { formatRub } from "@grani/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fakeGateway } from "@/server/payments-deps";

export const metadata: Metadata = { title: "Тестовая оплата" };

export default async function FakePaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const gateway = fakeGateway();
  const { id } = await params;
  const payment = gateway ? await gateway.getPayment(id) : null;
  if (!payment) notFound();

  return (
    <main className="page stack">
      <p className="eyebrow">Тестовая оплата — только для разработки</p>
      <h1 className="display">{formatRub(payment.amountKopecks)}</h1>
      <p className="lead">Настоящие деньги не списываются. Выберите, чем закончится оплата.</p>
      <div className="row">
        <form action={`/api/dev/pay/${id}`} method="post">
          <input type="hidden" name="outcome" value="succeeded" />
          <button type="submit" className="button">Оплатить</button>
        </form>
        <form action={`/api/dev/pay/${id}`} method="post">
          <input type="hidden" name="outcome" value="canceled" />
          <button type="submit" className="button button--ghost">Отменить</button>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Проверка**

```bash
pnpm test && pnpm typecheck
```
Expected: всё зелёное.

С запущенными `pnpm dev:db` и `pnpm dev:web` (`PAYMENTS_FAKE=1` в `.env.development.local`):
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/yookassa/notification -H "content-type: application/json" -d '{}'
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/purchases -H "origin: http://localhost:3000" -H "content-type: application/json" -d '{"product":"full","targetId":"x"}'
```
Expected: `404` (уведомления выключены при поддельном шлюзе) и `401` (нет входа). Покупку целиком проверяет Task 8 в браузере.

- [ ] **Step 7: Коммит**

```bash
git add apps/web/src/server apps/web/src/app/api/purchases apps/web/src/app/api/yookassa apps/web/src/app/api/dev/pay apps/web/src/app/dev
git commit -m "feat(web): purchase, status and YooKassa notification routes, fake payment page for development"
```
