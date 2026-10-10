import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

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

export async function inspectPdfPages(buffer: Buffer) {
  const { getDocument, OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const standardFontDataUrl = join(dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")), "standard_fonts").replaceAll("\\", "/") + "/";
  const loading = getDocument({data:new Uint8Array(buffer),useSystemFonts:false,standardFontDataUrl});
  const pdf = await loading.promise;
  try {
    const pages = [];
    for(let number=1;number<=pdf.numPages;number++) {
      const page=await pdf.getPage(number), content=await page.getTextContent(), operations=await page.getOperatorList();
      const imageKeys=operations.fnArray.flatMap((op,i)=>op===OPS.paintImageXObject?[String(operations.argsArray[i]?.[0])]:[]);
      const imageHashes=await Promise.all(imageKeys.map(async key=>{const image=await new Promise<{data:Uint8Array}>(resolve=>page.objs.get(key,resolve));return createHash("sha256").update(image.data).digest("hex")}));
      pages.push({number,text:content.items.map(item=>"str" in item?item.str:"").join(" "),height:page.view[3]!-page.view[1]!,textBounds:content.items.flatMap(item=>"str" in item&&item.str?[{text:item.str,y:item.transform[5]!,height:item.height}]:[]),images:operations.fnArray.filter(op=>[OPS.paintImageXObject,OPS.paintInlineImageXObject].includes(op)).length,distinctImages:new Set(imageHashes).size});
    }
    return pages;
  } finally { await loading.destroy(); }
}
