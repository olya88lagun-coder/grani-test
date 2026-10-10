import {test,expect,type BrowserContext} from "@playwright/test";
import {mkdir,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {seedAtlasFixtures} from "./personality-atlas-fixtures";
import {extractPdfText} from "../apps/web/src/server/pair-pdf/testing";
const base=process.env.E2E_BASE_URL??"http://127.0.0.1:4340",out=resolve(process.env.ATLAS_PDF_QA_OUTPUT??"../../output/pdf");
let fixtures:Awaited<ReturnType<typeof seedAtlasFixtures>>;
const login=(context:BrowserContext,index=0)=>context.addCookies([{name:"grani_session",value:fixtures[index]!.token,url:base,httpOnly:true,sameSite:"Lax"}]);
test.beforeAll(async()=>{fixtures=await seedAtlasFixtures();await mkdir(out,{recursive:true});});
test("memo editor must be applied; PDF saves latest text and downloads on desktop and mobile",async({page,context})=>{
 await login(context);await page.setViewportSize({width:1440,height:1000});await page.goto("/report/"+fixtures[0]!.resultId);await expect(page.locator("[data-atlas-ready]")).toBeVisible();
 const button=page.getByRole("button",{name:"Скачать памятку в PDF",exact:true});await expect(button).toBeEnabled();await page.locator("#atlas-section-9").getByRole("button",{name:"Редактировать",exact:true}).click();await page.locator("#atlas-memo-quote").fill("Проверить идею раньше - мой выбор");await expect(button).toBeDisabled();await page.getByRole("button",{name:"Применить к памятке"}).click();
 const downloadPromise=page.waitForEvent("download");await button.click();const download=await downloadPromise;expect(download.suggestedFilename()).toBe("grani-personal-memo.pdf");await download.saveAs(resolve(out,"sofia-downloaded-memo.pdf"));const text=await extractPdfText(await (await import("node:fs/promises")).readFile(resolve(out,"sofia-downloaded-memo.pdf")));expect(text).toContain("Проверить идею раньше - мой выбор");expect(text).toContain("София");
 await expect(page.getByRole("status").filter({hasText:"PDF подготовлен"})).toBeVisible();await page.locator("#atlas-section-9").scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,"desktop-pdf-export.png")});
 for(const width of [320,360,390,768,1024,1440,1920]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
 await page.setViewportSize({width:390,height:844});await page.locator("#atlas-section-9").scrollIntoViewIfNeeded();const mobile=page.waitForEvent("download");await button.click();expect((await mobile).suggestedFilename()).toBe("grani-personal-memo.pdf");expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:resolve(out,"mobile-pdf-export.png")});
});
test("no export with failed save; latest revision and owner/purchase/readiness protect the endpoint",async({page,context})=>{
 await login(context,1);expect((await page.request.get("/api/report/"+fixtures[0]!.resultId+"/atlas/pdf?revision=0")).status()).toBe(404);
 await login(context,2);expect((await page.request.get("/api/report/"+fixtures[2]!.resultId+"/atlas/pdf?revision=0")).status()).toBe(403);
 await login(context,3);expect((await page.request.get("/api/report/"+fixtures[3]!.resultId+"/atlas/pdf?revision=0")).status()).toBe(409);
 await login(context);await page.goto("/report/"+fixtures[0]!.resultId);await expect(page.locator("[data-atlas-ready]")).toBeVisible();const api="/api/report/"+fixtures[0]!.resultId+"/atlas";const draft=(await(await page.request.get(api)).json()).draft;
 expect((await page.request.get(api+"/pdf?revision="+(draft.revision+1))).status()).toBe(409);let pdfCalls=0;await page.route("**/atlas/pdf?*",route=>{pdfCalls++;return route.abort();});await page.route("**/atlas",route=>route.request().method()==="PUT"?route.abort():route.continue());await page.locator("#atlas-decision-note").fill("Нет подтверждения записи");await page.getByRole("button",{name:"Скачать памятку в PDF",exact:true}).click();await expect(page.getByRole("status").filter({hasText:"Сначала сохраните"})).toBeVisible();expect(pdfCalls).toBe(0);
});
test("slow generation handles a stale snapshot and generic server failure without downloading",async({page,context})=>{
 await login(context,1);await page.goto("/report/"+fixtures[1]!.resultId);await expect(page.locator("[data-atlas-ready]")).toBeVisible();const button=page.getByRole("button",{name:"Скачать памятку в PDF",exact:true});let downloads=0;page.on("download",()=>downloads++);
 await page.route("**/atlas/pdf?*",route=>route.fulfill({status:409,contentType:"application/json",body:JSON.stringify({ok:false,error:"stale_version"})}));await button.click();await expect(page.getByRole("status").filter({hasText:"Памятка изменилась"})).toBeVisible();await expect(button).toBeEnabled();
 await page.route("**/atlas/pdf?*",route=>route.fulfill({status:500,contentType:"application/json",body:JSON.stringify({ok:false,error:"pdf_failed"})}));await button.click();await expect(page.getByRole("status").filter({hasText:"Не удалось подготовить PDF"})).toBeVisible();expect(downloads).toBe(0);
});

test("PDF timeout releases the button while a slow save remains unconfirmed",async({page,context})=>{
 await login(context);await page.goto("/report/"+fixtures[0]!.resultId);await expect(page.locator("[data-atlas-ready]")).toBeVisible();await page.clock.install();
 let release!:()=>void,received!:()=>void;const gate=new Promise<void>(r=>release=r),started=new Promise<void>(r=>received=r);
 await page.route("**/atlas",async route=>{if(route.request().method()==="PUT"){received();await gate;}await route.continue();});
 try{await page.locator("#atlas-decision-note").fill("Медленная запись остаётся неподтверждённой");await page.getByRole("button",{name:"Скачать памятку в PDF",exact:true}).click();await started;await page.clock.fastForward(60_001);await expect(page.getByRole("button",{name:"Скачать памятку в PDF",exact:true})).toBeEnabled();await expect(page.getByRole("status").filter({hasText:"слишком много времени"})).toBeVisible();await expect(page.locator(".save-status")).toHaveText("Сохраняем…");}
 finally{release();}
 await expect(page.locator(".save-status")).toHaveText("Сохранено в вашем аккаунте");
});
