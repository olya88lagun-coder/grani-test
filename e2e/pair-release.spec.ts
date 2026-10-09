import { expect, test } from "@playwright/test";
import { createDb, purchases } from "../packages/db/src/index";
import { seedReportNightFixtures } from "./report-night-fixtures";

test.skip(!process.env.RESULT_QA_DATABASE_URL || !process.env.RESULT_QA_SESSION_SECRET, "Explicit local QA configuration required");
const baseURL=process.env.E2E_BASE_URL ?? "http://localhost:3000";
let fixtures: Awaited<ReturnType<typeof seedReportNightFixtures>>;
let paidPurchaseId: string;
let guarded: { id: string; state: string }[];

test.beforeAll(async () => {
  fixtures=await seedReportNightFixtures();
  const pair=fixtures.pairs.find(p=>p.state==="preparing")!;
  const db=createDb(process.env.RESULT_QA_DATABASE_URL!,{maxConnections:1});
  try {
    const paid=(await db.select().from(purchases)).find(p=>p.pairId===pair.pairId)!;
    paidPurchaseId=paid.id;
    guarded=[];
    for (const state of ["pending","canceled","refunded","free"] as const) {
      const [row]=await db.insert(purchases).values({userId:paid.userId,pairId:pair.pairId,product:"pair",amountKopecks:state==="free"?0:39900,
        status:state==="free"?"succeeded":state,paidAt:state==="free"||state==="refunded"?new Date():null}).returning({id:purchases.id});
      guarded.push({id:row!.id,state});
    }
  } finally { await (db as unknown as {$client:{end():Promise<void>}}).$client.end(); }
});

test.beforeEach(async ({page,context},testInfo) => {
  await context.addCookies([{name:"grani_session",value:fixtures.pairs.find(p=>p.state==="preparing")!.members[0]!.token,url:baseURL}]);
  await page.route("**/mc.yandex.ru/**",route=>route.abort());
  await page.addInitScript(deferred => {
    localStorage.setItem("grani-cookie-consent","all");
    const calls: unknown[]=[];
    Object.defineProperty(window,"__pairPurchaseCalls",{value:calls});
    if(!deferred) Object.defineProperty(window,"ym",{configurable:true,value:(_:number,method:string,goal:string,params:unknown)=>{
      if(method==="reachGoal"&&goal==="purchase_pair") calls.push(params);
    }});
  },testInfo.title.includes("delayed analytics"));
});

const purchaseCalls=()=>(window as unknown as {__pairPurchaseCalls:unknown[]}).__pairPurchaseCalls;

test("delayed analytics bootstrap keeps the purchase goal after early navigation",async ({page})=>{
  await page.goto(`/purchases/${paidPurchaseId}`);
  const link=page.getByRole("link",{name:"Открыть интерактивную карту пары",exact:true});
  await expect(link).toBeVisible();
  expect(await page.evaluate(id=>sessionStorage.getItem(`grani-goal-${id}`),paidPurchaseId)).toBeNull();
  await link.click();
  await expect(page).toHaveURL(/\/pair\//);
  await page.evaluate(()=>{
    const target=window as unknown as {ym?:(_:number,method:string,goal:string,params:unknown)=>void;__pairPurchaseCalls:unknown[]};
    target.ym=(_,method,goal,params)=>{if(method==="reachGoal"&&goal==="purchase_pair")target.__pairPurchaseCalls.push(params)};
    window.dispatchEvent(new Event("grani:analytics-ready"));
  });
  await expect.poll(()=>page.evaluate(purchaseCalls)).toEqual([{order_price:399,currency:"RUB"}]);
  expect(await page.evaluate(id=>sessionStorage.getItem(`grani-goal-${id}`),paidPurchaseId)).toBe("1");
});

test("necessary cookies suppress purchase analytics even when a SDK function exists",async ({page})=>{
  await page.addInitScript(()=>localStorage.setItem("grani-cookie-consent","necessary"));
  await page.goto(`/purchases/${paidPurchaseId}`);
  await page.getByRole("link",{name:"Открыть интерактивную карту пары",exact:true}).click();
  await expect(page).toHaveURL(/\/pair\//);
  expect(await page.evaluate(purchaseCalls)).toEqual([]);
  expect(await page.evaluate(id=>sessionStorage.getItem(`grani-goal-${id}`),paidPurchaseId)).toBeNull();
});

test("confirmed pair purchase is counted once before the early map link",async ({page})=>{
  await page.goto(`/purchases/${paidPurchaseId}`);
  await expect(page.getByRole("link",{name:"Открыть интерактивную карту пары",exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(purchaseCalls)).toEqual([{order_price:399,currency:"RUB"}]);
  await page.getByRole("link",{name:"Открыть интерактивную карту пары",exact:true}).click();
  await expect(page).toHaveURL(/\/pair\//);
  expect(await page.evaluate(purchaseCalls)).toHaveLength(1);
  await page.goto(`/purchases/${paidPurchaseId}`);
  await expect(page.getByRole("link",{name:"Открыть интерактивную карту пары",exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem(`grani-goal-${location.pathname.split("/").pop()}`))).toBe("1");
  await page.getByRole("link",{name:"Открыть интерактивную карту пары",exact:true}).click();
  await expect(page).toHaveURL(/\/pair\//);
  expect(await page.evaluate(purchaseCalls)).toEqual([]);
});

for (const state of ["pending","canceled","refunded","free"]) {
  test(`${state} pair purchase does not record revenue`,async ({page})=>{
    const purchase=guarded.find(p=>p.state===state)!;
    if(state==="pending") {
      const poll=page.waitForResponse(r=>r.url().endsWith(`/api/purchases/${purchase.id}`)&&r.status()===200);
      await page.goto(`/purchases/${purchase.id}`);
      await poll;
    } else {
      await page.goto(`/purchases/${purchase.id}`);
      await page.getByRole("link",{name:state==="free"?"Открыть интерактивную карту пары":"Вернуться",exact:true}).click();
      await expect(page).toHaveURL(/\/pair\//);
    }
    expect(await page.evaluate(purchaseCalls)).toEqual([]);
    expect(await page.evaluate(id=>sessionStorage.getItem(`grani-goal-${id}`),purchase.id)).toBeNull();
  });
}

test("production keeps dev login and fake payment endpoints disabled and serves PNG cards",async ({page})=>{
  test.skip(process.env.E2E_PRODUCTION_QA!=="1","Production-only guards");
  expect((await page.request.get("/api/dev/login?name=release-qa")).status()).toBe(404);
  expect((await page.request.get("/dev/pay/fake-release-qa")).status()).toBe(404);
  expect((await page.request.post("/api/dev/pay/fake-release-qa",{form:{outcome:"succeeded"},headers:{origin:baseURL}})).status()).toBe(404);
  const card=await page.request.get("/cards/pppp");
  expect(card.status()).toBe(200);
  expect(card.headers()["content-type"]).toContain("image/png");
  const bytes=await card.body();
  expect([...bytes.subarray(0,8)]).toEqual([137,80,78,71,13,10,26,10]);
  expect([bytes.readUInt32BE(16),bytes.readUInt32BE(20)]).toEqual([1080,1920]);
});
