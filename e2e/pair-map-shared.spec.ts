import { expect, test } from "@playwright/test";
import { seedReportNightFixtures } from "./report-night-fixtures";
import { randomUUID } from "node:crypto";

test.skip(!process.env.RESULT_QA_DATABASE_URL || !process.env.RESULT_QA_SESSION_SECRET,"Explicit local QA only");
test.beforeEach(async({context})=>context.setExtraHTTPHeaders({"x-forwarded-for":`2001:db8::${randomUUID().slice(0,4)}`}));
test("private drafts, mutual answers, versioned agreements and dirty refresh in two real sessions",async({browser})=>{
  const fixtures=await seedReportNightFixtures();const pair=fixtures.pairs.find(p=>p.state==="ready")!;
  const baseURL=process.env.E2E_BASE_URL??"http://localhost:3000";
  const a=await browser.newContext({baseURL,extraHTTPHeaders:{"x-forwarded-for":`2001:db8::${randomUUID().slice(0,4)}`}}),b=await browser.newContext({baseURL,extraHTTPHeaders:{"x-forwarded-for":`2001:db8::${randomUUID().slice(0,4)}`}});
  try{
    await a.addCookies([{name:"grani_session",value:pair.members[0]!.token,url:baseURL}]);
    await b.addCookies([{name:"grani_session",value:pair.members[1]!.token,url:baseURL}]);
    const pa=await a.newPage(),pb=await b.newPage();
    await Promise.all([pa.goto(`/pair/${pair.pairId}`),pb.goto(`/pair/${pair.pairId}`)]);
    for(const page of [pa,pb]){
      await page.getByLabel("Я согласен(на) на хранение и раскрытие ответов карты пары").check();
      await page.getByRole("button",{name:"Принять отдельное согласие"}).click();
      await expect(page.getByText("Отдельное согласие принято.",{exact:true})).toBeVisible();
    }
    const question=pa.getByLabel("Ответ: Когда вы спорите");
    await question.fill("SECRET-A: мне нужна пауза");
    await pa.getByRole("button",{name:"Сохранить мои ответы"}).click();
    await expect(pa.getByText("Личный черновик сохранён. Партнёр его не видит.",{exact:true})).toBeVisible();
    let response=await b.request.get(`/api/pairs/${pair.pairId}/map`);
    expect(await response.text()).not.toContain("SECRET-A");
    expect(await (await b.request.get(`/pair/${pair.pairId}`)).text()).not.toContain("SECRET-A");
    for(const page of [pa,pb]){
      for(const id of ["home","money","social","closeness","support","plans","decisions"])await page.locator(`#skip-${id}`).check();
    }
    await pa.getByRole("button",{name:"Опубликовать мои ответы"}).click();
    await pb.getByLabel("Ответ: Когда вы спорите").fill("SECRET-B: сначала выслушай");
    await pb.getByRole("button",{name:"Опубликовать мои ответы"}).click();
    await expect(pb.locator("[data-shared-answers]")).toContainText("SECRET-A");
    await pa.getByRole("button",{name:"Обновить общие данные"}).click();
    await expect(pa.locator("[data-shared-answers]")).toContainText("SECRET-B");
    await question.fill("Мой новый личный черновик");
    await pa.getByRole("button",{name:"Обновить общие данные"}).click();
    await expect(question).toHaveValue("Мой новый личный черновик");
    const agreementA=pa.locator("[data-agreement-slot='0']"),agreementB=pb.locator("[data-agreement-slot='0']");
    await agreementA.getByLabel("01 Как мы спорим").fill("Пауза двадцать минут");
    await agreementA.getByRole("button",{name:"Предложить партнёру"}).click();
    await agreementA.getByRole("button",{name:"Подтвердить эту версию"}).click();
    await pb.getByRole("button",{name:"Обновить общие данные"}).click();
    await agreementB.getByRole("button",{name:"Подтвердить эту версию"}).click();
    await expect(agreementB).toContainText("Подтверждено обоими");
    await pa.getByRole("button",{name:"Обновить общие данные"}).click();
    await agreementA.getByLabel("01 Как мы спорим").fill("Пауза тридцать минут");
    await agreementA.getByRole("button",{name:"Предложить партнёру"}).click();
    response=await b.request.post(`/api/pairs/${pair.pairId}/map`,{headers:{origin:baseURL},data:{kind:"agreement_confirm",slot:0,expectedRevision:1}});
    expect(response.status()).toBe(409);
    await pb.getByRole("button",{name:"Обновить общие данные"}).click();
    await expect(agreementB).toContainText("Версия 2");
    await expect(agreementB.getByRole("button",{name:"Подтвердить эту версию"})).toBeVisible();
    await pa.getByRole("button",{name:"Удалить мои ответы"}).click();
    await pa.getByRole("button",{name:"Удалить ответы окончательно"}).click();
    response=await b.request.get(`/api/pairs/${pair.pairId}/map`);
    expect(await response.text()).not.toContain("SECRET-A");
    expect(await (await b.request.get(`/pair/${pair.pairId}`)).text()).not.toContain("SECRET-A");
    await pb.getByRole("button",{name:"Обновить общие данные"}).click();
    await expect(pb.locator("[data-shared-answers]")).toHaveCount(0);
  }finally{await a.close();await b.close();}
});

test("consent stays optional, legacy transfer is explicit, forms fit five widths",async({page,context},testInfo)=>{
  const fixtures=await seedReportNightFixtures();const pair=fixtures.pairs.find(p=>p.state==="ready")!;
  const baseURL=process.env.E2E_BASE_URL??"http://localhost:3000";
  await context.addCookies([{name:"grani_session",value:pair.members[0]!.token,url:baseURL}]);
  const storageKey=`grani-pair-drafts-v1:${pair.pairId}:${pair.members[0]!.resultId}`;
  await page.addInitScript(({key})=>sessionStorage.setItem(key,JSON.stringify(["Старый личный черновик","Быт без спешки","Поддержка делом"])),{key:storageKey});
  await page.goto(`/pair/${pair.pairId}`);
  await expect(page.getByRole("button",{name:"Сохранить мои ответы"})).toBeDisabled();
  await expect(page.locator("#translator")).toBeVisible();
  let data=await context.request.get(`/api/pairs/${pair.pairId}/map`);
  expect(await data.text()).not.toContain("Старый личный черновик");
  for(const width of [320,390,768,1024,1440]){
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.locator("#answer-conflict")).toBeVisible();
    const output=process.env.PAIR_SHARED_QA_OUTPUT;
    if(output){await page.locator("#pair-survey").screenshot({path:`${output}/survey-${width}.png`});await page.locator("#agreements").screenshot({path:`${output}/agreements-${width}.png`});}
  }
  await page.getByLabel("Я согласен(на) на хранение и раскрытие ответов карты пары").check();
  await page.getByRole("button",{name:"Принять отдельное согласие"}).click();
  await page.getByRole("button",{name:"Перенести в личные черновики"}).click();
  await expect(page.getByLabel("01 Как мы спорим")).toHaveValue("Старый личный черновик");
  await expect(page.getByText("Три личных черновика перенесены. Партнёр их не видит.",{exact:true})).toBeVisible();
  expect(await page.evaluate(key=>sessionStorage.getItem(key),storageKey)).toBeNull();
  data=await context.request.get(`/api/pairs/${pair.pairId}/map`);
  expect(await data.text()).toContain("Старый личный черновик");
  await page.getByLabel("Ответ: Когда вы спорите").fill("🙂".repeat(600));
  await expect(page.getByRole("button",{name:"Сохранить мои ответы"})).toBeEnabled();
  await page.getByLabel("Ответ: Когда вы спорите").fill("🙂".repeat(601));
  await expect(page.getByRole("button",{name:"Сохранить мои ответы"})).toBeDisabled();
});

test("network failures and conflicting saves keep input; losing membership hides shared data",async({page,context})=>{
  const fixtures=await seedReportNightFixtures();const pair=fixtures.pairs.find(p=>p.state==="ready")!;
  const baseURL=process.env.E2E_BASE_URL??"http://localhost:3000";
  await context.addCookies([{name:"grani_session",value:pair.members[0]!.token,url:baseURL}]);
  await page.goto(`/pair/${pair.pairId}`);
  await page.getByLabel("Я согласен(на) на хранение и раскрытие ответов карты пары").check();
  await page.getByRole("button",{name:"Принять отдельное согласие"}).click();
  const field=page.getByLabel("Ответ: Когда вы спорите");await field.fill("Сохраните мой ввод");
  await page.route(`**/api/pairs/${pair.pairId}/map`,route=>route.request().method()==="POST"?route.abort():route.continue());
  await page.getByRole("button",{name:"Сохранить мои ответы"}).click();
  await expect(page.getByText("Не удалось обновить данные.",{exact:false})).toBeVisible();
  await expect(field).toHaveValue("Сохраните мой ввод");
  await page.unroute(`**/api/pairs/${pair.pairId}/map`);
  const answers=Object.fromEntries(["conflict","home","money","social","closeness","support","plans","decisions"].map(id=>[id,{text:"Другое устройство",skipped:false}]));
  expect((await context.request.post(`/api/pairs/${pair.pairId}/map`,{headers:{origin:baseURL},data:{kind:"survey_draft",answers,expectedRevision:0}})).ok()).toBe(true);
  await page.getByRole("button",{name:"Сохранить мои ответы"}).click();
  await expect(page.getByText("Версия изменилась на другом устройстве.",{exact:false})).toBeVisible();
  await expect(field).toHaveValue("Сохраните мой ввод");
  await context.request.post(`/api/pairs/${pair.pairId}/leave`,{headers:{origin:baseURL}});
  await page.getByRole("button",{name:"Обновить общие данные"}).click();
  await expect(page.locator("#pair-survey textarea,[data-agreement-slot]")).toHaveCount(0);
});
