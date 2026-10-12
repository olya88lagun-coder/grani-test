import { test as base } from "@playwright/test";

// Разные сценарии представляют разных локальных клиентов. Ограничитель сервера остаётся включён;
// внутри одного теста обе стороны используют один адрес и проходят обычные проверки.
export const test = base.extend({
  extraHTTPHeaders: async ({}, use, testInfo) => {
    const octet = testInfo.testId.split("").reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0);
    await use({ "x-forwarded-for": `198.18.${(octet >>> 8) % 256}.${octet % 256}` });
  },
});
