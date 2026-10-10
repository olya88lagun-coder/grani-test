import {test,expect,type BrowserContext} from "@playwright/test";
import {seedAtlasFixtures} from "./personality-atlas-fixtures";
const base=process.env.E2E_BASE_URL??"http://127.0.0.1:4340";
let fixtures:Awaited<ReturnType<typeof seedAtlasFixtures>>;
const login=(context:BrowserContext,index=0)=>context.addCookies([{name:"grani_session",value:fixtures[index]!.token,url:base,httpOnly:true,sameSite:"Lax"}]);
test.beforeAll(async()=>{fixtures=await seedAtlasFixtures({namespace:"atlas-readiness-"+crypto.randomUUID()});});
test("saved paid-owner data carries across independent desktop and mobile devices",async({page,context,browser})=>{
 await login(context);await page.setViewportSize({width:1440,height:1000});await page.goto("/report/"+fixtures[0]!.resultId);await expect(page.locator("[data-atlas-ready]")).toBeVisible();await page.locator("#atlas-decision-note").fill("Сохранено с компьютера");await page.getByRole("checkbox",{name:/Отметить день 2 выполненным/}).check();await expect(page.locator(".save-status")).toHaveText("Сохранено в вашем аккаунте");
 const mobile=await browser.newContext({viewport:{width:390,height:844},locale:"ru-RU"});try{await login(mobile);const second=await mobile.newPage();await second.goto(base+"/report/"+fixtures[0]!.resultId);await expect(second.locator("[data-atlas-ready]")).toBeVisible();await expect(second.locator("#atlas-decision-note")).toHaveValue("Сохранено с компьютера");await expect(second.getByRole("checkbox",{name:/Отметить день 2 выполненным/})).toBeChecked();await second.locator("#atlas-decision-note").fill("Сохранено с телефона");await expect(second.locator(".save-status")).toHaveText("Сохранено в вашем аккаунте");await page.reload();await expect(page.locator("#atlas-decision-note")).toHaveValue("Сохранено с телефона");}finally{await mobile.close();}
});
test("removing the disposable account removes its private draft and export access",async({page,context})=>{
 await login(context);const id=fixtures[0]!.resultId;const before=await page.request.get("/api/report/"+id+"/atlas");expect(before.status()).toBe(200);const prior=(await before.json()).draft;
 const saved=await page.request.put("/api/report/"+id+"/atlas",{headers:{Origin:base},data:{expectedRevision:prior.revision,data:{...prior.data,decision:"Удаляемый проверочный черновик"}}});expect(saved.status()).toBe(200);expect((await saved.json()).draft.revision).toBeGreaterThan(prior.revision);
 expect((await page.request.post("/api/me/delete",{headers:{Origin:base}})).status()).toBe(200);
 expect((await page.request.get("/api/report/"+id+"/atlas")).status()).toBe(401);expect((await page.request.get("/api/report/"+id+"/atlas/pdf?revision=0")).status()).toBe(401);
 const {createDb,loadAtlasDraft}=await import("../packages/db/src/index");const db=createDb(process.env.ATLAS_QA_DATABASE_URL!,{maxConnections:1});try{expect(await loadAtlasDraft(db,id)).toBeNull();}finally{await (db as unknown as {$client:{end():Promise<void>}}).$client.end();}
});
