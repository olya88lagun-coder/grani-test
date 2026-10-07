import { describe, expect, it } from "vitest";
import { DATA_RECIPIENTS, LEGAL_DATE, LEGAL_VERSIONS, LOGIN_CONSENT_RECIPIENTS, OFFER_VERSION, OPERATOR, TOGETHER_REFUND_DAYS, TOGETHER_REFUND_WORKING_DAYS } from "./legal";

describe("legal", () => {
  it("has a 12-digit INN of the self-employed operator", () => {
    expect(OPERATOR.inn).toMatch(/^\d{12}$/);
  });

  it("names every service that receives personal data", () => {
    const names = DATA_RECIPIENTS.map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(["ЮKassa", "ВКонтакте", "Яндекс.Метрика"]));
    // Вход через Telegram выключен: иностранных получателей быть не должно
    expect(names).not.toContain("Telegram");
    expect(names.some((n) => n.includes("YandexGPT") && n.includes("GigaChat"))).toBe(true);
  });

  it("leaves Metrika out of the login consent because the cookie banner asks for it", () => {
    expect(LOGIN_CONSENT_RECIPIENTS.map((r) => r.name)).not.toContain("Яндекс.Метрика");
    expect(LOGIN_CONSENT_RECIPIENTS).toHaveLength(DATA_RECIPIENTS.length - 1);
  });

  it("uses the new document versions", () => {
    expect(LEGAL_VERSIONS).toEqual({ consent: "2026-10-v2", privacy: "2026-10-v2", offer: "2026-10-v2" });
    expect(OFFER_VERSION).toBe("2026-10-v2");
    expect(LEGAL_DATE).toBe("7 октября 2026 года");
  });

  it("states the Together refund terms in one place", () => {
    expect(TOGETHER_REFUND_DAYS).toBe(7);
    expect(TOGETHER_REFUND_WORKING_DAYS).toBe(10);
  });
});
