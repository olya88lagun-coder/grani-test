import { describe, expect, test } from "vitest";
import { PENDING_LONG_MS, pollDelayMs, PREPARING_LONG_MS, purchaseStage, STAGE_TEXT, type PurchaseStage } from "./purchase-view";

const SECOND = 1000;

describe("purchaseStage", () => {
  test("a purchase that is not confirmed is waiting for the payment, and after a while says it is still unconfirmed", () => {
    expect(purchaseStage({ status: "pending", ready: false }, 0)).toBe("awaiting_payment");
    expect(purchaseStage({ status: "pending", ready: false }, PENDING_LONG_MS - 1)).toBe("awaiting_payment");
    expect(purchaseStage({ status: "pending", ready: false }, PENDING_LONG_MS)).toBe("payment_unconfirmed");
  });

  test("a paid purchase without a report is preparing, then preparing for longer than usual, and ready is separate from paid", () => {
    expect(purchaseStage({ status: "succeeded", ready: false }, 0)).toBe("preparing");
    expect(purchaseStage({ status: "succeeded", ready: false }, PREPARING_LONG_MS - 1)).toBe("preparing");
    expect(purchaseStage({ status: "succeeded", ready: false }, PREPARING_LONG_MS)).toBe("preparing_long");
    expect(purchaseStage({ status: "succeeded", ready: true }, PREPARING_LONG_MS * 2)).toBe("ready");
  });

  test("a canceled or refunded purchase is final whatever the time", () => {
    expect(purchaseStage({ status: "canceled", ready: false }, 0)).toBe("not_paid");
    expect(purchaseStage({ status: "refunded", ready: false }, 0)).toBe("refunded");
    expect(purchaseStage({ status: "refunded", ready: true }, 0)).toBe("refunded");
  });

  test("a negative or missing elapsed time (clock skew) counts as just started", () => {
    expect(purchaseStage({ status: "pending", ready: false }, -5 * SECOND)).toBe("awaiting_payment");
    expect(purchaseStage({ status: "pending", ready: false }, Number.NaN)).toBe("awaiting_payment");
  });
});

describe("pollDelayMs", () => {
  test("polls often at first, then less often, and never faster than every 3 seconds", () => {
    expect(pollDelayMs(0)).toBe(3 * SECOND);
    expect(pollDelayMs(PENDING_LONG_MS)).toBeGreaterThanOrEqual(3 * SECOND);
    expect(pollDelayMs(10 * 60 * SECOND)).toBeGreaterThan(pollDelayMs(0));
    expect(pollDelayMs(2 * 60 * 60 * SECOND)).toBeGreaterThanOrEqual(pollDelayMs(10 * 60 * SECOND));
  });
});

describe("STAGE_TEXT", () => {
  const STAGES: PurchaseStage[] = ["awaiting_payment", "payment_unconfirmed", "preparing", "preparing_long", "ready", "not_paid", "refunded"];

  test("has a title and a lead for every stage", () => {
    for (const stage of STAGES) {
      expect(STAGE_TEXT[stage].title.length, stage).toBeGreaterThan(3);
      expect(STAGE_TEXT[stage].lead.length, stage).toBeGreaterThan(10);
    }
  });

  test("never claims the report is ready before it is, and a refund does not say that nothing was charged", () => {
    for (const stage of ["awaiting_payment", "payment_unconfirmed", "preparing", "preparing_long"] as const) {
      expect(`${STAGE_TEXT[stage].title} ${STAGE_TEXT[stage].lead}`, stage).not.toMatch(/разбор готов(?![а-я])|оплата прошла успешно/i);
    }
    expect(STAGE_TEXT.refunded.lead).not.toMatch(/не списан/i);
    expect(STAGE_TEXT.not_paid.lead).toMatch(/не списан/i);
  });

  test("a long wait for the payment does not tell a person who may have paid to pay again, and a long preparation says the payment went through", () => {
    expect(STAGE_TEXT.payment_unconfirmed.lead).toMatch(/если вы оплатили/i);
    expect(STAGE_TEXT.preparing_long.lead).toMatch(/оплата (прошла|получена)/i);
  });
});
