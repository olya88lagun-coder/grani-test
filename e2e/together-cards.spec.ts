import { expect, test, type APIResponse, type Browser, type Page } from "@playwright/test";
import { BASE_URL, uniqueName } from "./helpers";

const origin = { origin: BASE_URL };

async function signedIn(browser: Browser, name: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`/api/dev/login?name=${encodeURIComponent(name)}`);
  return page;
}

const post = (page: Page, url: string, data?: unknown) => page.request.post(url, { data, headers: origin });
const put = (page: Page, url: string, data: unknown) => page.request.put(url, { data, headers: origin });

type CardJson = { id: string; position: number; state: string; mine: { fields: Record<string, unknown> } | null; partner: { status: string; fields?: Record<string, unknown> } };
type Current = { ok: boolean; card: CardJson | null; progress: { done: number; total: number } };

async function json<T>(response: APIResponse): Promise<T> {
  return (await response.json()) as T;
}

test("two accounts play the first free cards: hidden until both answer, reveal, skip, continue", async ({ browser }) => {
  test.setTimeout(120_000);
  const anna = await signedIn(browser, uniqueName("Аня"));
  const boris = await signedIn(browser, uniqueName("Борис"));
  const vera = await signedIn(browser, uniqueName("Вера"));

  // Пространство из двух человек
  const created = await json<{ inviteUrl: string }>(await post(anna, "/api/together/spaces"));
  const token = created.inviteUrl.split("/").at(-1)!;
  expect((await post(boris, "/api/together/invite/request", { token })).status()).toBe(200);
  expect((await post(anna, "/api/together/invite/confirm", { accept: true })).status()).toBe(200);

  // Вне пространства карточек нет
  expect((await anna.request.get("/api/together/cards/current")).status()).toBe(200);
  expect((await vera.request.get("/api/together/cards/current")).status()).toBe(404);

  const first = await json<Current>(await anna.request.get("/api/together/cards/current"));
  expect(first.progress).toEqual({ done: 0, total: 159 });
  expect(first.card).toMatchObject({ position: 1, state: "answer" });
  const id = first.card!.id;

  // Ответ Ани не виден Борису до его собственного ответа
  const secret = `тайна-${Date.now()}`;
  expect((await put(anna, `/api/together/cards/${id}/answer`, { fields: { answer: secret } })).status()).toBe(200);
  const borisBefore = await boris.request.get("/api/together/cards/current");
  expect(await borisBefore.text()).not.toContain(secret);
  expect((await json<Current>(borisBefore)).card?.partner).toEqual({ status: "answered" });

  // Чужой человек и проверки входа
  expect((await put(vera, `/api/together/cards/${id}/answer`, { fields: { answer: "я чужая" } })).status()).toBe(404);
  expect((await anna.request.put(`/api/together/cards/${id}/answer`, { data: { fields: { answer: "без origin" } } })).status()).toBe(403);
  expect((await put(boris, `/api/together/cards/${id}/answer`, { fields: { answer: "" } })).status()).toBe(400);
  expect((await put(boris, `/api/together/cards/${id}/answer`, { fields: { answer: "ок", share_in_book: false } })).status()).toBe(400);

  // Второй ответ раскрывает карточку
  const revealed = await json<{ ok: boolean; state: string; revealed: { card: CardJson } }>(await put(boris, `/api/together/cards/${id}/answer`, { fields: { answer: "Борис ответил" } }));
  expect(revealed.state).toBe("revealed");
  expect(revealed.revealed.card.partner.fields).toEqual({ answer: secret });

  // Аня, ждавшая, видит раскрытие, а не следующую карточку; пока не нажмёт «Продолжить», отвечать дальше нельзя
  const annaReveal = await json<Current>(await anna.request.get("/api/together/cards/current"));
  expect(annaReveal.card).toMatchObject({ position: 1, state: "revealed", partner: { fields: { answer: "Борис ответил" } } });
  expect(annaReveal.progress.done).toBe(1);
  expect((await post(boris, `/api/together/cards/${id}/continue`, { done: "yes" })).status()).toBe(400);
  expect((await post(boris, `/api/together/cards/${id}/continue`, { done: true })).status()).toBe(200);
  expect((await post(anna, `/api/together/cards/${id}/continue`, {})).status()).toBe(200);

  // Борис пропускает вторую карточку: Аня видит «пропущено», текст не раскрывается
  const second = await json<Current>(await anna.request.get("/api/together/cards/current"));
  expect(second.card).toMatchObject({ position: 2, state: "answer" });
  const nextId = second.card!.id;
  expect((await put(anna, `/api/together/cards/${nextId}/answer`, { fields: { answer: "Мой второй" } })).status()).toBe(200);
  expect((await post(boris, `/api/together/cards/${nextId}/skip`)).status()).toBe(200);
  const skipped = await anna.request.get("/api/together/cards/current");
  expect((await json<Current>(skipped)).card).toMatchObject({ position: 2, state: "skipped", partner: { status: "skipped" } });
  expect((await post(anna, `/api/together/cards/${nextId}/skip`)).status()).toBe(409);
  expect((await post(anna, `/api/together/cards/${nextId}/continue`, {})).status()).toBe(200);

  // История и прогресс
  const history = await json<{ items: { position: number; outcome: string }[] }>(await anna.request.get("/api/together/history"));
  expect(history.items.map((item) => [item.position, item.outcome])).toEqual([
    [2, "skipped"],
    [1, "revealed"],
  ]);
  expect((await anna.request.get("/api/together/history?before=abc")).status()).toBe(400);
  const space = await json<{ space: { progress: { done: number; total: number } } }>(await anna.request.get("/api/together/space"));
  expect(space.space.progress).toEqual({ done: 2, total: 159 });

  // После выхода карточки закрыты для обоих
  expect((await post(boris, "/api/together/leave", { acknowledged: true })).status()).toBe(200);
  expect((await anna.request.get("/api/together/cards/current")).status()).toBe(404);
  expect((await boris.request.get("/api/together/history")).status()).toBe(404);
});
