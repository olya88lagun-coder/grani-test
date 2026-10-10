import {expect,test} from "vitest";
import {writeFile,mkdir} from "node:fs/promises";
import {resolve} from "node:path";
import {buildPersonalityAtlas} from "@/lib/personality-atlas";
import {renderAtlasMemoPdf,type AtlasMemoPdfSource} from "./document";
import {extractPdfText,inspectPdfPages} from "@/server/pair-pdf/testing";
const model=buildPersonalityAtlas({openness:85,conscientiousness:90,extraversion:25,agreeableness:35,stability:65});
const source:AtlasMemoPdfSource={displayName:"София · условный QA-профиль",typeName:"Архитектор",typeCode:"++--",gemDir:"ppmm",model,memo:{quote:model.memo.quote,items:model.memo.items.map(i=>i.text)},revision:4,generatedAt:"2026-10-10T12:00:00Z"};
test("memo has selectable Cyrillic, real scores and saved text in a single A4 page",async()=>{
 const bytes=await renderAtlasMemoPdf(source);expect(bytes.subarray(0,5).toString()).toBe("%PDF-");const text=(await extractPdfText(bytes)).replace(/\s+/g," ");
 expect(text).toContain("София");expect(text).toContain("Архитектор");expect(text).toContain("Моя личная памятка");expect(text).toContain(source.memo.quote);expect(text).toContain("самонаблюдения");expect(text).toContain("85 / 100");expect(text).toContain("90 / 100");expect(text).toContain("25 / 100");expect(text).toContain("35 / 100");expect(text).toContain("65 / 100");expect(text).toContain("Версия 4");
 const pages=await inspectPdfPages(bytes);expect(pages).toHaveLength(1);expect(pages[0]!.images).toBeGreaterThan(0);
 if(process.env.ATLAS_PDF_QA_OUTPUT){await mkdir(process.env.ATLAS_PDF_QA_OUTPUT,{recursive:true});await writeFile(resolve(process.env.ATLAS_PDF_QA_OUTPUT,"sofia-personal-memo.pdf"),bytes);}
});
test("long text wraps over pages without losing endings; independent exports retain glyph mappings",async()=>{
 const long={...source,memo:{quote:"Текст ".repeat(330)+"КОНЕЦ-ФРАЗЫ",items:Array.from({length:5},(_,i)=>"Я".repeat(1950)+" КОНЕЦ-"+i)}};
 const [bytes,second]=await Promise.all([renderAtlasMemoPdf(long),renderAtlasMemoPdf({...source,displayName:"Ёж · Другой файл",memo:{...source.memo,quote:"Отдельная фраза 🙂"}})]);
 const text=await extractPdfText(bytes);expect(text).toContain("КОНЕЦ-ФРАЗЫ");for(let i=0;i<5;i++)expect(text).toContain("КОНЕЦ-"+i);
 expect((await extractPdfText(second)).replace(/\s+/g," ")).toContain("Отдельная фраза 🙂");expect(await extractPdfText(second)).not.toContain("КОНЕЦ-ФРАЗЫ");
 const pages=await inspectPdfPages(bytes);expect(pages.length).toBeGreaterThan(1);for(const page of pages)for(const item of page.textBounds)expect(item.y).toBeGreaterThan(20);
 if(process.env.ATLAS_PDF_QA_OUTPUT)await writeFile(resolve(process.env.ATLAS_PDF_QA_OUTPUT,"memo-long-qa.pdf"),bytes);
});
