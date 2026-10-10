import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile, copyFile } from "node:fs/promises";
import { PAIR_MAP_CONSENT_VERSION, PAIR_MAP_QUESTIONS } from "../packages/core/src/index";
import { seedReportNightFixtures } from "./report-night-fixtures";
import { extractPdfText, inspectPdfPages } from "../apps/web/src/server/pair-pdf/testing";
test.skip(!process.env.RESULT_QA_DATABASE_URL || !process.env.RESULT_QA_SESSION_SECRET,"Explicit local QA only");
test.beforeEach(async({context})=>context.setExtraHTTPHeaders({"x-forwarded-for":`2001:db8::${randomUUID().slice(0,4)}`}));

test("actual PDF download works before consent/extras and includes answers only by explicit choice",async({page,context,browser})=>{
  const fixtures=await seedReportNightFixtures();const pair=fixtures.pairs.find(p=>p.state==="preparing")!;
  const baseURL=process.env.E2E_BASE_URL??"http://localhost:3000";
  await context.addCookies([{name:"grani_session",value:pair.members[0]!.token,url:baseURL}]);
  const b=await browser.newContext({baseURL,extraHTTPHeaders:{"x-forwarded-for":`2001:db8::${randomUUID().slice(0,4)}`}});
  try{
    await b.addCookies([{name:"grani_session",value:pair.members[1]!.token,url:baseURL}]);
    await page.goto(`/pair/${pair.pairId}`);
    const [download]=await Promise.all([page.waitForEvent("download"),page.getByRole("button",{name:"Скачать карту пары в PDF"}).click()]);
    expect(download.suggestedFilename()).toBe("grani-pair-map.pdf");expect(await download.failure()).toBeNull();
    const file=await download.path();expect(file).not.toBeNull();
    const basic=await extractPdfText(await readFile(file!));expect(basic).toContain("Карта вашей пары");expect(basic).toContain("Дополнительный текстовый разбор ещё готовится");expect(basic).not.toContain("SECRET-PDF");
    expect((await inspectPdfPages(await readFile(file!)))[0]!.distinctImages).toBe(2);
    if(process.env.PAIR_PDF_DOWNLOAD_QA_OUTPUT)await copyFile(file!,process.env.PAIR_PDF_DOWNLOAD_QA_OUTPUT);
    const api=`/api/pairs/${pair.pairId}/map`;
    const send=(request:typeof context.request,data:unknown)=>request.post(api,{headers:{origin:baseURL},data});
    for(const request of [context.request,b.request])expect((await send(request,{kind:"consent",accepted:true,version:PAIR_MAP_CONSENT_VERSION})).ok()).toBe(true);
    const answers=Object.fromEntries(PAIR_MAP_QUESTIONS.map(q=>[q.id,{text:"SECRET-PDF · ответ",skipped:false}]));
    expect((await send(context.request,{kind:"survey_submit",answers,expectedRevision:0})).ok()).toBe(true);
    let response=await b.request.get(`${api}/pdf?includeAnswers=1`);expect(response.ok()).toBe(true);expect(await extractPdfText(await response.body())).not.toContain("SECRET-PDF");
    expect((await send(b.request,{kind:"survey_submit",answers,expectedRevision:0})).ok()).toBe(true);
    await page.getByRole("button",{name:"Обновить общие данные"}).click();
    await expect(page.getByLabel("Добавить раскрытые ответы обоих")).not.toBeChecked();
    response=await context.request.get(`${api}/pdf`);expect(await extractPdfText(await response.body())).not.toContain("SECRET-PDF");
    await page.getByLabel("Добавить раскрытые ответы обоих").check();
    const [shared]=await Promise.all([page.waitForEvent("download"),page.getByRole("button",{name:"Скачать карту пары в PDF"}).click()]);
    expect(await extractPdfText(await readFile((await shared.path())!))).toContain("SECRET-PDF");
    response=await context.request.get(`${api}/pdf`);expect(response.status()).toBe(429);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect((await send(b.request,{kind:"survey_delete",expectedRevision:1})).ok()).toBe(true);
    response=await b.request.get(`${api}/pdf?includeAnswers=1`);expect(await extractPdfText(await response.body())).not.toContain("SECRET-PDF");
  }finally{await b.close();}
});

test("unpaid, signed-out, outsider and departed members never receive PDF",async({page,context,browser})=>{
  const fixtures=await seedReportNightFixtures();const unpaid=fixtures.pairs.find(p=>p.state==="available")!,paid=fixtures.pairs.find(p=>p.state==="ready")!;
  const baseURL=process.env.E2E_BASE_URL??"http://localhost:3000";
  expect((await context.request.get(`/api/pairs/${paid.pairId}/map/pdf`)).status()).toBe(401);
  await context.addCookies([{name:"grani_session",value:unpaid.members[0]!.token,url:baseURL}]);
  expect((await context.request.get(`/api/pairs/${unpaid.pairId}/map/pdf`)).status()).toBe(403);
  expect((await context.request.get(`/api/pairs/${paid.pairId}/map/pdf`)).status()).toBe(404);
  const a=await browser.newContext({baseURL,extraHTTPHeaders:{"x-forwarded-for":`2001:db8::${randomUUID().slice(0,4)}`}});
  try{await a.addCookies([{name:"grani_session",value:paid.members[0]!.token,url:baseURL}]);await a.request.post(`/api/pairs/${paid.pairId}/leave`,{headers:{origin:baseURL}});expect((await a.request.get(`/api/pairs/${paid.pairId}/map/pdf`)).status()).toBe(404);}finally{await a.close();}
});

test("JSON errors show a retry message and never become a downloaded file",async({page,context})=>{
  const fixtures=await seedReportNightFixtures();const pair=fixtures.pairs.find(p=>p.state==="ready")!;const baseURL=process.env.E2E_BASE_URL??"http://localhost:3000";
  await context.addCookies([{name:"grani_session",value:pair.members[0]!.token,url:baseURL}]);await page.goto(`/pair/${pair.pairId}`);
  const downloads:unknown[]=[];page.on("download",d=>downloads.push(d));
  await page.route(`**/api/pairs/${pair.pairId}/map/pdf`,r=>r.fulfill({status:409,contentType:"application/json",body:'{"ok":false,"error":"stale_version"}'}));
  await page.getByRole("button",{name:"Скачать карту пары в PDF"}).click();
  await expect(page.getByText("Общие данные изменились во время подготовки.",{exact:false})).toBeVisible();expect(downloads).toEqual([]);
});

test("ready extra chapters appear in the real PDF with actual profiles",async({page,context})=>{
  const fixtures=await seedReportNightFixtures();const pair=fixtures.pairs.find(p=>p.state==="ready")!;const baseURL=process.env.E2E_BASE_URL??"http://localhost:3000";
  await context.addCookies([{name:"grani_session",value:pair.members[0]!.token,url:baseURL}]);
  const response=await context.request.get(`/api/pairs/${pair.pairId}/map/pdf`);expect(response.ok()).toBe(true);const bytes=await response.body();
  const text=await extractPdfText(bytes);for(const title of ["В чём вы похожи","Где вы разные и как это использовать","Как поддерживать друг друга"])expect(text).toContain(title);
  expect(text).not.toContain("Дополнительный текстовый разбор ещё готовится");
  if(process.env.PAIR_PDF_READY_QA_OUTPUT)await import("node:fs/promises").then(fs=>fs.writeFile(process.env.PAIR_PDF_READY_QA_OUTPUT!,bytes));
});
