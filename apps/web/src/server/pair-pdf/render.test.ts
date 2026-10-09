import { createElement } from "react";
import { writeFile } from "node:fs/promises";
import { expect, test, vi } from "vitest";

test("renders Cyrillic as selectable PDF text without external requests", async () => {
  const renderer = await import("./render").catch(() => null);
  expect(renderer, "A real local PDF renderer must exist").not.toBeNull();
  if (!renderer) return;
  const { Document, Page, Text } = await import("@react-pdf/renderer");
  const { extractPdfText } = await import("./testing");
  const originalFetch = globalThis.fetch;
  const externalRequests: string[] = [];
  const outbound = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (/^https?:/i.test(url)) { externalRequests.push(url); return Promise.reject(new Error("PDF must use local assets")); }
    return originalFetch(input, init);
  });
  try {
    const document = createElement(Document, {}, createElement(Page, { size: "A4", style: { fontFamily: "PairGolos", padding: 40, fontSize: 14 } },
      createElement(Text, {}, "Карта вашей пары · Ёж · 399 ₽"),
      createElement(Text, {}, "Открытость: 78 и 38. Поддержка\nИндивидуальная гипотеза.")));
    const bytes = await renderer.renderPairPdf(document);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    const text = await extractPdfText(bytes);
    expect(text).toContain("Карта вашей пары");
    expect(text).toContain("Ёж");
    expect(text).toContain("399 ₽");
    expect(text).toContain("78 и 38");
    expect(externalRequests).toEqual([]);
    if (process.env.PAIR_PDF_QA_OUTPUT) await writeFile(process.env.PAIR_PDF_QA_OUTPUT, bytes);
  } finally { outbound.mockRestore(); }
});
