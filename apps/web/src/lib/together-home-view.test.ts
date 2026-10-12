import { describe, expect, test } from "vitest";
import type { CardView } from "./together-cards-view";
import type { SpaceView } from "./together-view";
import { buildTogetherHomeView } from "./together-home-view";

const space: SpaceView = { status: "active", myRole: "initiator", members: [{ role: "initiator", displayName: "Анна" }, { role: "partner", displayName: "Марк" }], pendingRequest: null, access: { active: false, accessUntil: null, stage: 0, canRenew: true } };
const card: CardView = { id: "intro-1", position: 1, kind: "intro", title: "Вопрос", prompt: "Вопрос?", hint: "", estimatedMinutes: 5, jointAction: "", fields: [], state: "answer", locked: false, lock: null, mine: null, partner: { status: "none" } };
const view = (current: CardView | null = card, currentSpace = space, cardLoad: "loading" | "ready" | "error" | "gone" = "ready") => buildTogetherHomeView({ space: currentSpace, card: current, cardLoad });

describe("личная главная использует независимые серверные состояния", () => {
  test("бесплатное знакомство без выдуманных статистики и счётчиков", () => {
    expect(view()).toMatchObject({ membership: "active", access: "free", activity: "available", theme: { month: null, title: "Знакомство с пространством" }, primaryAction: "answer", stats: null });
    expect(view()).not.toHaveProperty("progress");
  });
  test("ожидание не теряет платный доступ; тема определяется карточкой, не оплаченным временем", () => {
    const paid = { ...space, access: { active: true, accessUntil: "2026-12-01T00:00:00Z", stage: 5, canRenew: false } };
    expect(view({ ...card, position: 30, kind: "main", state: "waiting" }, paid)).toMatchObject({ access: "paid", activity: "waiting", primaryAction: "check", theme: { month: 2, title: "Наша история" } });
  });
  test("истёкший доступ не скрывает уже раскрытый итог", () => {
    const expired = { ...space, access: { ...space.access, accessUntil: "2026-10-01T00:00:00Z" } };
    expect(view({ ...card, state: "revealed" }, expired)).toMatchObject({ access: "expired", activity: "revealed", primaryAction: "continue", sectionsAvailability: { history: true } });
  });
  test.each([
    [{ ...card, locked: true, lock: { kind: "payment" } }, "payment_locked", "payment"],
    [{ ...card, position: 56, locked: true, lock: { kind: "month", month: 3, opensAt: null } }, "month_locked", null],
    [{ ...card, state: "skipped" }, "skipped", "continue"],
  ] as const)("%j", (current, activity, primaryAction) => {
    expect(view(current)).toMatchObject({ activity, primaryAction });
  });
  test.each(["loading", "error", "gone"] as const)("%s не выдаётся за завершённый маршрут", (cardLoad) => {
    expect(view(null, space, cardLoad)).toMatchObject({ activity: cardLoad, primaryAction: cardLoad === "error" ? "retry" : null, theme: null });
  });
  test("только успешный пустой current означает конец маршрута", () => {
    expect(view(null)).toMatchObject({ activity: "none", primaryAction: null, theme: null });
  });
  test("до подтверждения пары нет активных карточек и доступа", () => {
    expect(view(card, { ...space, status: "pending" })).toMatchObject({ membership: "pending", access: "unknown", activity: "none", sectionsAvailability: { history: false, care: false } });
    expect(buildTogetherHomeView({ space: null, card, cardLoad: "ready" }).membership).toBe("none");
  });
  test("проекция не содержит тексты, поля, ревизии и намерение публикации", () => {
    const privateCard = { ...card, state: "revealed" as const, mine: { fields: { answer: "MY_SECRET", keep: true }, revision: 2, done: true }, partner: { status: "answered" as const, fields: { answer: "PARTNER_SECRET" } } };
    const serialized = JSON.stringify(view(privateCard));
    expect(serialized).not.toMatch(/MY_SECRET|PARTNER_SECRET|fields|revision|keep/);
  });
});
