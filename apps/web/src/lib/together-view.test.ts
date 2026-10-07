import { describe, expect, test } from "vitest";
import {
  CLOSED_NOTICE_TEXT,
  formatAccessUntil,
  inviteLine,
  POLL_INTERVAL_MS,
  POLL_MAX_ATTEMPTS,
  purchaseOutcome,
  spaceScreen,
  startErrorMessage,
  type SpaceView,
} from "./together-view";

const view = (patch: Partial<SpaceView> = {}, access: Partial<SpaceView["access"]> = {}): SpaceView => ({
  status: "active",
  myRole: "initiator",
  members: [
    { role: "initiator", displayName: "Анна" },
    { role: "partner", displayName: "Алексей" },
  ],
  pendingRequest: null,
  access: { active: false, accessUntil: null, stage: 0, canRenew: true, ...access },
  ...patch,
});

describe("spaceScreen", () => {
  test("no space means the start screen", () => {
    expect(spaceScreen(null)).toBe("start");
  });

  test("a pending space waits for the partner, or asks the inviter to confirm a request", () => {
    expect(spaceScreen(view({ status: "pending", members: [{ role: "initiator", displayName: "Анна" }] }))).toBe("invite");
    expect(spaceScreen(view({ status: "pending", pendingRequest: { displayName: "Алексей" } }))).toBe("confirm");
  });

  test("an active space without paid access offers checkout only while renewal is allowed", () => {
    expect(spaceScreen(view())).toBe("ready");
    expect(spaceScreen(view({}, { canRenew: false }))).toBe("ready");
  });

  test("paid access shows the space, with the renewal button only when the server allows it", () => {
    expect(spaceScreen(view({}, { active: true, accessUntil: "2026-11-05T13:30:00Z", canRenew: true }))).toBe("paid");
    expect(spaceScreen(view({}, { active: true, accessUntil: "2026-11-05T13:30:00Z", canRenew: false }))).toBe("limit");
  });
});

describe("purchaseOutcome", () => {
  const paidSpace = view({}, { active: true, accessUntil: "2026-11-05T13:30:00Z" });

  test("a pending payment keeps waiting; a canceled one is reported without another payment", () => {
    expect(purchaseOutcome({ status: "pending", granted: false }, view())).toBe("waiting");
    expect(purchaseOutcome({ status: "canceled", granted: false }, view())).toBe("cancelled");
  });

  test("a succeeded payment without a grant is never a success", () => {
    expect(purchaseOutcome({ status: "succeeded", granted: false }, view())).toBe("delayed");
  });

  test("success needs the grant and an active space with live access", () => {
    expect(purchaseOutcome({ status: "succeeded", granted: true }, paidSpace)).toBe("success");
  });

  test("a historical grant is not enough when the space is closed or access is not active", () => {
    expect(purchaseOutcome({ status: "succeeded", granted: true }, null)).toBe("closed");
    expect(purchaseOutcome({ status: "succeeded", granted: true }, view())).toBe("closed");
  });

  test("a refunded payment is shown as not completed", () => {
    expect(purchaseOutcome({ status: "refunded", granted: true }, paidSpace)).toBe("cancelled");
  });
});

describe("startErrorMessage", () => {
  test("busy means retry, not available means reread the state, unauthorized means sign in again", () => {
    expect(startErrorMessage("busy")).toMatchObject({ retry: true });
    expect(startErrorMessage("not_available")).toMatchObject({ reload: true });
    expect(startErrorMessage("unauthorized")).toMatchObject({ login: true });
  });

  test("a note that is too long names the limit; a changed space asks for a reload", () => {
    expect(startErrorMessage("too_long").text).toContain("200");
    expect(startErrorMessage("not_pending")).toMatchObject({ reload: true });
  });

  test("known and unknown errors always carry a readable text without the raw code", () => {
    for (const code of ["busy", "not_available", "payments_unavailable", "payment_failed", "invalid_email", "rate_limited", "too_long", "not_pending", "consent_required", "something_else"]) {
      const { text } = startErrorMessage(code);
      expect(text.length).toBeGreaterThan(10);
      expect(text).not.toContain(code);
    }
  });
});

describe("polling and dates", () => {
  test("polls every 5 seconds, at most 12 times", () => {
    expect(POLL_INTERVAL_MS).toBe(5000);
    expect(POLL_MAX_ATTEMPTS).toBe(12);
  });

  test("formats the end of access in the given time zone with date and time", () => {
    expect(formatAccessUntil("2026-11-05T13:30:00Z", "Europe/Moscow")).toBe("5 ноября в 16:30");
    expect(formatAccessUntil("2026-11-05T13:30:00Z", "Asia/Yekaterinburg")).toBe("5 ноября в 18:30");
  });
});

describe("spaceScreen after the access ended", () => {
  test("a pair whose paid access ended gets its own screen, not the one of a pair that has not paid yet", () => {
    expect(spaceScreen(view({}, { active: false, accessUntil: null }))).toBe("ready");
    expect(spaceScreen(view({}, { active: false, accessUntil: "2026-11-05T13:30:00Z" }))).toBe("expired");
    expect(spaceScreen(view({}, { active: true, accessUntil: "2026-11-05T13:30:00Z", canRenew: true }))).toBe("paid");
  });
});

describe("inviteLine", () => {
  test("says until when the link works, or that it ended; nothing without a live link", () => {
    expect(inviteLine({ expiresAt: "2026-10-14T10:00:00Z", expired: false }, "UTC")).toBe("Ссылка действует до 14 октября в 10:00.");
    expect(inviteLine({ expiresAt: "2026-10-14T10:00:00Z", expired: true }, "UTC")).toBe("Срок ссылки истёк. Выпустите новую и отправьте партнёру.");
    expect(inviteLine(null)).toBeNull();
    expect(inviteLine(undefined)).toBeNull();
  });
});

describe("CLOSED_NOTICE_TEXT", () => {
  test("explains each reason without naming or blaming anyone, and points to a way forward", () => {
    for (const reason of ["left", "account_deleted"] as const) {
      const { title, lead } = CLOSED_NOTICE_TEXT[reason];
      expect(title).toBe("Пространство закрыто");
      expect(lead, reason).toMatch(/второй участник/i);
      expect(lead, reason).toMatch(/новое пространство/i);
      expect(lead, reason).not.toMatch(/виноват|бросил|ушёл от/i);
    }
    expect(CLOSED_NOTICE_TEXT.left.lead).toMatch(/вышел/);
    expect(CLOSED_NOTICE_TEXT.account_deleted.lead).toMatch(/удалил/);
  });
});
