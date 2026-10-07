import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DATA_RECIPIENTS, LEGAL_DATE, LEGAL_VERSIONS, LOGIN_CONSENT_RECIPIENTS, OFFER_VERSION, OPERATOR, OPERATOR_DETAILS, TOGETHER_REFUND_DAYS, TOGETHER_REFUND_WORKING_DAYS } from "./legal";

describe("legal", () => {
  it("has a 12-digit INN of the self-employed operator", () => {
    expect(OPERATOR.inn).toMatch(/^\d{12}$/);
  });

  it("names every service that receives personal data", () => {
    const names = DATA_RECIPIENTS.map((r) => r.name);
    for (const service of ["Timeweb", "ЮKassa", "ВКонтакте", "Яндекс.Метрика"]) expect(names.some((n) => n.includes(service)), service).toBe(true);
    // Вход через Telegram выключен: иностранных получателей быть не должно
    expect(names).not.toContain("Telegram");
    expect(names.some((n) => n.includes("YandexGPT") && n.includes("GigaChat"))).toBe(true);
  });

  it("leaves Metrika out of the login consent because the cookie banner asks for it", () => {
    expect(LOGIN_CONSENT_RECIPIENTS.map((r) => r.name)).not.toContain("Яндекс.Метрика");
    expect(LOGIN_CONSENT_RECIPIENTS).toHaveLength(DATA_RECIPIENTS.length - 1);
  });

  it("uses the new document versions", () => {
    expect(LEGAL_VERSIONS).toEqual({ consent: "2026-10-v3", privacy: "2026-10-v3", offer: "2026-10-v3" });
    expect(OFFER_VERSION).toBe("2026-10-v3");
    expect(LEGAL_DATE).toBe("7 октября 2026 года");
  });

  it("keeps every operator in the recipient list a named legal entity", () => {
    for (const recipient of DATA_RECIPIENTS) expect(recipient.name, recipient.name).toMatch(/^(ООО|ПАО|АО)/);
  });

  it("never prints unfilled placeholders or the old retention period on the legal pages", () => {
    for (const page of ["offer", "privacy", "consent"]) {
      const source = readFileSync(new URL(`../app/${page}/page.tsx`, import.meta.url), "utf8");
      expect(source, page).not.toMatch(/\[(адрес|номер)/i);
      expect(source, page).not.toContain("5 лет");
    }
  });

  it("keeps the operator details empty until the owner fills them in, so the pages omit those sentences", () => {
    expect(OPERATOR_DETAILS).toEqual({ address: null, rknNumber: null });
    expect(OPERATOR.nameDative).toBe("Лагутенковой Ольге Валентиновне");
  });

  it("states the Together refund terms in one place", () => {
    expect(TOGETHER_REFUND_DAYS).toBe(7);
    expect(TOGETHER_REFUND_WORKING_DAYS).toBe(10);
  });
});
