import { expect, test, type Browser, type Page } from "@playwright/test";
import { BASE_URL, uniqueName } from "./helpers";

const EMAIL = "anna@example.ru";
const origin = { origin: BASE_URL };

// Пользователь без результата теста: «Вдвоём» его не требует
async function signedIn(browser: Browser, name: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/api/dev/login?name=${encodeURIComponent(name)}`);
  return page;
}

const post = (page: Page, url: string, data?: unknown) => page.request.post(url, { data, headers: origin });

test("two accounts without tests build a space, pay once, and leave", async ({ browser }) => {
  const anna = await signedIn(browser, uniqueName("Аня"));
  const boris = await signedIn(browser, uniqueName("Борис"));
  const vera = await signedIn(browser, uniqueName("Вера"));

  const created = await post(anna, "/api/together/spaces", { consent: true });
  expect(created.status()).toBe(200);
  const { inviteUrl, spaceId } = (await created.json()) as { inviteUrl: string; spaceId: string };
  const token = inviteUrl.split("/").at(-1)!;
  expect((await post(anna, "/api/together/spaces", { consent: true })).status()).toBe(409);

  // Ссылку можно проверить без входа, но она ничего не раскрывает
  const peek = await anna.request.get(`/api/together/invite/${token}`);
  expect(await peek.json()).toEqual({ ok: true, valid: true });
  expect(((await (await anna.request.get("/api/together/invite/not-a-real-token")).json()) as { valid: boolean }).valid).toBe(false);

  // Инициатор не может принять собственную ссылку, а запрос Бориса не открывает ему пространство
  expect((await post(anna, "/api/together/invite/request", { token, consent: true })).status()).toBe(409);
  expect((await post(boris, "/api/together/invite/request", { token, consent: true })).status()).toBe(200);
  expect(((await (await boris.request.get("/api/together/space")).json()) as { space: unknown }).space).toBeNull();
  // Третий человек получает нейтральный отказ, пока запрос Бориса ждёт
  expect((await post(vera, "/api/together/invite/request", { token, consent: true })).status()).toBe(404);

  const waiting = (await (await anna.request.get("/api/together/space")).json()) as { space: { status: string; pendingRequest: { displayName: string } } };
  expect(waiting.space.status).toBe("pending");
  expect(waiting.space.pendingRequest.displayName).toContain("Борис");
  expect((await post(boris, "/api/together/invite/confirm", { accept: true })).status()).toBe(404);
  expect((await post(anna, "/api/together/invite/confirm", { accept: "yes" })).status()).toBe(400);
  expect((await post(anna, "/api/together/invite/confirm", { accept: true })).status()).toBe(200);

  for (const page of [anna, boris]) {
    const view = (await (await page.request.get("/api/together/space")).json()) as { space: { status: string; members: unknown[]; access: { active: boolean; canRenew: boolean } } };
    expect(view.space.status).toBe("active");
    expect(view.space.members).toHaveLength(2);
    expect(view.space.access).toMatchObject({ active: false, canRenew: true });
  }
  expect((await post(vera, "/api/together/invite/request", { token, consent: true })).status()).toBe(404);

  // Оплата: сумма и срок задаются сервером; через старый маршрут отчётов этот продукт купить нельзя
  expect((await post(boris, "/api/purchases", { product: "together_30d", targetId: spaceId, email: EMAIL })).status()).toBe(404);
  expect((await post(vera, "/api/together/purchases", { email: EMAIL })).status()).toBe(404);
  expect((await post(boris, "/api/together/purchases", { email: "bad" })).status()).toBe(400);
  const started = await post(boris, "/api/together/purchases", { email: EMAIL });
  expect(started.status()).toBe(200);
  const { url, purchaseId } = (await started.json()) as { url: string; purchaseId: string };
  const paymentId = url.split("/dev/pay/")[1]!;

  const paid = await boris.request.post(`/api/dev/pay/${paymentId}`, { form: { outcome: "succeeded" }, headers: origin, maxRedirects: 0 });
  expect(paid.status()).toBe(303);
  expect(paid.headers().location).toContain("/together?purchase=");

  for (const page of [anna, boris]) {
    const view = (await (await page.request.get("/api/together/space")).json()) as { space: { access: { active: boolean; stage: number; accessUntil: string } } };
    expect(view.space.access).toMatchObject({ active: true, stage: 0 });
    expect(Date.parse(view.space.access.accessUntil)).toBeGreaterThan(Date.now());
  }
  expect(await (await anna.request.get(`/api/together/purchases/${purchaseId}`)).json()).toMatchObject({ ok: true, status: "succeeded", granted: true });
  expect((await vera.request.get(`/api/together/purchases/${purchaseId}`)).status()).toBe(404);
  // Служебный список виден только владелице
  expect((await vera.request.get("/api/admin/together")).status()).toBe(404);

  // Выход: нужно подтверждение, затем закрывается для обоих
  expect((await post(boris, "/api/together/leave", {})).status()).toBe(400);
  expect((await post(boris, "/api/together/leave", { acknowledged: true })).status()).toBe(200);
  for (const page of [anna, boris]) {
    expect(((await (await page.request.get("/api/together/space")).json()) as { space: unknown }).space).toBeNull();
  }
  expect((await post(anna, "/api/together/spaces", { consent: true })).status()).toBe(200);
});

test("the owner sees what needs a manual decision", async ({ browser }) => {
  test.skip(process.env.OWNER_IDENTITY !== "telegram:dev-Владелица", "needs OWNER_IDENTITY=telegram:dev-Владелица in the app and in the test process");
  const owner = await signedIn(browser, "Владелица");

  const response = await owner.request.get("/api/admin/together");

  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ ok: true, paidWithoutAccess: expect.any(Array), closedWithRemaining: expect.any(Array) });
});

test("requests from another origin and without a session are refused", async ({ browser }) => {
  const anonymous = await (await browser.newContext()).newPage();

  expect((await anonymous.request.post("/api/together/spaces", { headers: origin })).status()).toBe(401);
  expect((await anonymous.request.post("/api/together/spaces", { headers: { origin: "https://evil.example" } })).status()).toBe(403);
  expect((await anonymous.request.get("/api/together/space")).status()).toBe(401);
});
