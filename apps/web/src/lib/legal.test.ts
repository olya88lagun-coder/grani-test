import { describe, expect, it } from "vitest";
import { DATA_RECIPIENTS, LEGAL_VERSIONS, LOGIN_CONSENT_RECIPIENTS, OFFER_VERSION, OPERATOR } from "./legal";

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
    expect(LEGAL_VERSIONS).toEqual({ consent: "2026-09-v2", privacy: "2026-09-v1", offer: "2026-09-v2" });
    expect(OFFER_VERSION).toBe("2026-09-v2");
  });
});
