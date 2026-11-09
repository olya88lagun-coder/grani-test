import { expect, test } from "@playwright/test";
import { BASE_URL, signedInWithResult, uniqueName } from "./helpers";

const counter = Number(process.env.NEXT_PUBLIC_METRIKA_TEST_ID);
test.skip(!counter || counter === 112931559, "Requires a non-production test counter in the local app.");

for (const confirmed of [true, false]) {
  test(`purchase goal after ${confirmed ? "confirmation" : "cancellation"}`, async ({ browser }) => {
    const { context, page } = await signedInWithResult(browser, uniqueName("Покупатель"));
    try {
      const goals: unknown[][] = [];
      await context.exposeBinding("recordMetrikaPurchase", (_source, args: unknown[]) => goals.push(args));
      // Observe the browser SDK boundary without sending fake sales to Yandex.
      await context.route("https://mc.yandex.ru/**", async route => {
        if (!route.request().url().endsWith("/metrika/tag.js")) return route.abort();
        return route.fulfill({ contentType: "text/javascript", body: `
          window.ym = (counter, method, goal, params, done) => {
            if (method === "reachGoal" && goal.startsWith("purchase_")) {
              window.recordMetrikaPurchase([counter, method, goal, params]);
              done?.();
            }
          };
        ` });
      });
      await context.addInitScript(() => localStorage.setItem("grani-cookie-consent", "all"));
      const resultUrl = page.url();
      const checkout = await page.request.post("/api/purchases", {
        data: { product: "full", targetId: resultUrl.split("/").at(-1), email: "analytics@example.test" },
        headers: { origin: BASE_URL },
      });
      expect(checkout.ok()).toBe(true);
      const { url } = await checkout.json() as { url: string };
      await page.goto(url);
      await page.getByRole("button", { name: confirmed ? "Оплатить" : "Отменить", exact: true }).click();
      await expect(page).toHaveURL(/\/purchases\/[a-f0-9-]+$/);
      const purchaseUrl = page.url();
      const purchaseId = purchaseUrl.split("/").at(-1);
      const analyticsUrl = `/api/purchases/${purchaseId}/analytics`;

      if (confirmed) {
        await expect.poll(() => goals.length).toBe(1);
        expect(goals[0]).toEqual([counter, "reachGoal", "purchase_full", {
          product: "full", order_price: 299, currency: "RUB", order_id: expect.stringMatching(/^order_[a-f0-9]{64}$/),
        }]);
        for (const reopen of [() => page.reload(), () => page.goto(purchaseUrl)]) {
          const lookup = page.waitForResponse(response => response.url().endsWith(analyticsUrl));
          await reopen();
          expect((await lookup).ok()).toBe(true);
          if (page.url() === purchaseUrl) await page.goto(resultUrl);
        }
        expect(goals).toHaveLength(1);
      } else {
        await expect(page.getByRole("heading", { name: "Оплата не прошла" })).toBeVisible();
        expect(await (await page.request.get(analyticsUrl)).json()).toEqual({ ok: true, purchase: null });
        await page.reload();
        await expect(page.getByRole("heading", { name: "Оплата не прошла" })).toBeVisible();
        expect(goals).toHaveLength(0);
      }
    } finally {
      await context.close();
    }
  });
}
