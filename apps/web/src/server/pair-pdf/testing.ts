import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// Test-only parser. Never import this file in a production route.
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const standardFontDataUrl = join(dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")), "standard_fonts").replaceAll("\\", "/") + "/";
  const loading = getDocument({ data: new Uint8Array(buffer), useSystemFonts: false, standardFontDataUrl });
  const pdf = await loading.promise;
  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const content = await (await pdf.getPage(pageNumber)).getTextContent();
      pages.push(content.items.map(item => "str" in item ? item.str : "").join(" "));
    }
    return pages.join("\n");
  } finally { await loading.destroy(); }
}
