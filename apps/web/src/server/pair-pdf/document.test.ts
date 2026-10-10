import { afterEach, expect, test, vi } from "vitest";
import { writeFile } from "node:fs/promises";
import { buildPairGuide } from "@/lib/pair-guide";
import type { PairView } from "@/lib/pair-view";
import { renderPairPdf } from "./render";
import { extractPdfText, inspectPdfPages } from "./testing";
afterEach(()=>vi.restoreAllMocks());
const view:PairView={pairId:"qa",score:63,phrase:"Ваши грани",text:"Описание сочетания",you:{firstName:"Ёж",typeName:"Искра",dir:"pmpp"},partner:{firstName:"Тестовый партнёр",typeName:"Тихая хранительница",dir:"mpmp"},rows:[{trait:"openness",label:"Открытость",you:78,partner:38},{trait:"conscientiousness",label:"Добросовестность",you:25,partner:75},{trait:"extraversion",label:"Экстраверсия",you:75,partner:25},{trait:"agreeableness",label:"Доброжелательность",you:48,partner:53},{trait:"stability",label:"Эмоциональная устойчивость",you:88,partner:40}]};
test("complete selectable PDF includes all actual sections and long Unicode answers",async()=>{
  const m=await import("./document").catch(()=>null);expect(m,"Full PDF document must exist").not.toBeNull();if(!m)return;
  const {PAIR_MAP_QUESTIONS}=await import("@grani/core");
  const answers=Object.fromEntries(PAIR_MAP_QUESTIONS.map(q=>[q.id,{text:q.id==="conflict"?"SECRET-A · Ёж · 399 ₽ · 🙂 · 中\n"+"длинноеслово".repeat(40):"Ответ для разговора ".repeat(22),skipped:false}]));
  const source={view,generatedAt:"2026-10-09T12:00:00Z",guides:[buildPairGuide(view,"you"),buildPairGuide(view,"partner")],confirmedAgreements:[{slot:0,text:"CONFIRMED-CONTRACT",revision:2}],sharedAnswers:{mine:{answers,revision:1,updatedAt:"2026-10-09T12:00:00Z"},partner:{answers,revision:2,updatedAt:"2026-10-09T12:00:00Z"}},extras:{state:"preparing"},sharedRevisionToken:"qa",includeAnswers:true};
  const fetcher=vi.spyOn(globalThis,"fetch");
  const bytes=await renderPairPdf(m.buildPairPdfDocument(source as never));const text=await extractPdfText(bytes);
  if(process.env.PAIR_PDF_FULL_QA_OUTPUT)await writeFile(process.env.PAIR_PDF_FULL_QA_OUTPUT,bytes);
  for(const value of ["Карта вашей пары","Ёж","78","38","71", "Переводчик", "Проверьте готовность", "CONFIRMED-CONTRACT", "SECRET-A","🙂","U+4E2D"]){if(value!=="71")expect(text).toContain(value)}
  expect(text).not.toContain("71%");for(const q of PAIR_MAP_QUESTIONS)expect(text).toContain(q.title);
  expect(text).toContain("Грани · Карта вашей пары");
  const pages=await inspectPdfPages(bytes);expect(pages[0]!.images).toBe(2);
  for(const page of pages.slice(1)){expect(page.text).toContain("Грани · Карта вашей пары");expect(page.text).toContain(`${page.number} / ${pages.length}`);}
  expect(fetcher.mock.calls.filter(([input])=>!String(input).startsWith("data:"))).toEqual([]);
  if(process.env.PAIR_PDF_FULL_QA_OUTPUT)await writeFile(process.env.PAIR_PDF_FULL_QA_OUTPUT,bytes);
},30_000);
