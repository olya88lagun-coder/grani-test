import {chromium} from 'file:///C:/Users/olya8/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const dir='C:/dev/grani-test/docs/together/design';
const out=dir+'/stage2-previews';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page=await browser.newPage({reducedMotion:'reduce'});
const results=[], consoleErrors=[], requests=[];
page.on('pageerror',e=>consoleErrors.push(e.message));
page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
const url=pathToFileURL(dir+'/stage2.html').href;
const states=['answer','partner-ready','waiting','revealed','edited','skipped','skipped-own','locked','payment-check','after-payment','history','history-empty','history-more','complete','loading','unavailable','network-error','rate-limit'];
const nav=async s=>{await page.evaluate(s=>stage2Demo.setScenario(s),s);await page.evaluate(()=>document.fonts.ready);};
const action=async a=>{await page.locator('main [data-action="'+a+'"]').click();};
const tick=async()=>{await page.waitForFunction(()=>!document.querySelector('#stage2').hasAttribute('aria-busy'));};
async function check(name,fn){try{await fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.message});}}
try{
await page.goto(url);
await check('Cyrillic display and body fonts are loaded',async()=>{await page.evaluate(()=>document.fonts.ready);assert.equal(await page.evaluate(()=>document.fonts.check('300 30px TogetherDisplay','Вдвоём')&&document.fonts.check('400 16px TogetherBody','Ответ')),true);});
for(const width of [320,390,768,1024,1440]){
 await page.setViewportSize({width,height:width<768?844:1000});
 for(const state of states){
  await nav(state);
  await check('layout '+state+' at '+width,async()=>{
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
   assert.equal(await page.locator('main h1').count(),1);
   assert.ok(await page.locator('main').isVisible());
   const boxes=await page.locator('main button:visible,main a:visible,main textarea:visible').evaluateAll(es=>es.map(e=>({text:e.textContent.trim().slice(0,40),height:e.getBoundingClientRect().height})));
   assert.equal(boxes.filter(b=>b.height<43).length,0,'small targets: '+JSON.stringify(boxes.filter(b=>b.height<43)));
  });
  if([390,1440].includes(width))await page.screenshot({path:out+'/'+state+'-'+width+'.jpg',type:'jpeg',quality:88,fullPage:true});
 }
}
await page.setViewportSize({width:390,height:844});
await check('answer payload omits every after_reveal field; double submit once',async()=>{
 await nav('answer');assert.equal(await page.locator('main input[type=checkbox]').count(),0);
 await page.locator('#answerInput').fill('Спасибо за утренний чай.');
 await page.locator('#answerForm button[type=submit]').evaluate(b=>{b.click();b.click();});await tick();
 const puts=await page.evaluate(()=>stage2Requests.filter(r=>r.method==='PUT'));assert.equal(puts.length,1);assert.deepEqual(puts[0].body,{fields:{answer:'Спасибо за утренний чай.'}});
 assert.equal(await page.locator('[data-state=waiting]').count(),1);
});
await check('waiting exposes own reply and no partner text or book checkbox',async()=>{
 assert.equal(await page.locator('main input[type=checkbox]').count(),0);assert.match(await page.locator('main').textContent(),/Спасибо за утренний чай/);
 assert.doesNotMatch(await page.locator('main').textContent(),/Ты встретила меня/);
 assert.equal(await page.locator('main [data-action=continue]').count(),0);
});
await check('optional fields use snapshot limits; before reveal all booleans omitted',async()=>{
 await nav('after-payment');assert.equal(await page.locator('#field-care_action').getAttribute('maxlength'),'180');
 assert.equal(await page.locator('#field-care_context').getAttribute('maxlength'),'100');
 await page.locator('#answerInput').fill('Мне нужны пять минут тишины.');
 await page.locator('#field-care_action').fill('Обними меня после небольшой паузы.');
 await page.locator('#field-care_context').fill('После работы.');
 await page.locator('#answerForm button[type=submit]').click();await tick();
 const body=await page.evaluate(()=>stage2Requests.find(r=>r.method==='PUT').body);
 assert.deepEqual(body.fields,{answer:'Мне нужны пять минут тишины.',care_action:'Обними меня после небольшой паузы.',care_context:'После работы.'});
 assert.equal(await page.locator('main input[type=checkbox]').count(),0);
 await nav('waiting');
});
await check('partner response reveals; refreshed result waits for Continue',async()=>{
 await page.locator('#reviewTools [data-action=demo-answer]').click();assert.equal(await page.locator('[data-state=revealed]').count(),1);
 const id=await page.evaluate(()=>stage2Demo.view().id);
 await page.evaluate(()=>stage2Demo.refresh());assert.equal(await page.evaluate(()=>stage2Demo.view().id),id);
 assert.equal(await page.locator('[data-state=revealed]').count(),1);
});
await check('book selection submits only after reveal and does not mark text edited',async()=>{
 await page.locator('[data-after-reveal=share_in_book]').check();await tick();
 const r=await page.evaluate(()=>stage2Requests.filter(r=>r.method==='PUT').at(-1));assert.equal(r.body.fields.share_in_book,true);
 assert.equal(await page.evaluate(()=>stage2Demo.view().mine.revision),1);
});
await check('done selection is local until Continue; sends done true',async()=>{
 const before=await page.evaluate(()=>stage2Requests.length);await page.locator('#doneInput').check();
 assert.equal(await page.evaluate(()=>stage2Requests.length),before);
 await action('continue');await tick();const last=await page.evaluate(()=>stage2Requests.filter(r=>r.method==='POST').at(-1));
 assert.deepEqual(last.body,{done:true});assert.equal(await page.evaluate(()=>stage2Demo.view().position),2);
 assert.equal(await page.evaluate(()=>document.activeElement.tagName),'H1');
});
await check('other person retains same terminal result after initiator continues',async()=>{
 await page.locator('#reviewTools [data-action=actor-1]').click();
 assert.equal(await page.evaluate(()=>stage2Demo.view().position),1);
 assert.equal(await page.locator('[data-state=revealed]').count(),1);assert.match(await page.locator('main').textContent(),/уже отметила этот шаг/);
 await action('continue');await tick();assert.equal(await page.evaluate(()=>stage2Demo.view().position),2);
});
await check('second respondent stays on reveal returned by submission',async()=>{
 await nav('partner-ready');assert.doesNotMatch(await page.locator('main').textContent(),/Ты встретила меня/);
 await page.locator('#answerInput').fill('Хочу сохранить этот момент.');await page.locator('#answerForm button[type=submit]').click();await tick();
 assert.equal(await page.locator('[data-state=revealed]').count(),1);assert.equal(await page.evaluate(()=>stage2Demo.view().position),1);
});
await check('text edit changes revision and partner sees edited marker',async()=>{
 await nav('revealed');await action('edit');await page.locator('#answerInput').fill('Теперь я добавила важную деталь.');
 await page.locator('#answerForm button[type=submit]').click();await tick();assert.equal(await page.evaluate(()=>stage2Demo.view().mine.revision),2);
 await page.locator('#reviewTools [data-action=actor-1]').click();assert.match(await page.locator('.s2-replies section').nth(1).textContent(),/изменено/);
 assert.match(await page.locator('.s2-replies section').nth(1).textContent(),/важную деталь/);
});
await check('failed edit retains typed draft and no false server changes',async()=>{
 await nav('revealed');await action('edit');await page.locator('#answerInput').fill('Текст после ошибки остался.');
 await page.locator('#failInput').selectOption('network');await page.locator('#answerForm button[type=submit]').click();await tick();
 assert.equal(await page.locator('#answerInput').inputValue(),'Текст после ошибки остался.');
 assert.equal(await page.evaluate(()=>stage2Demo.view().mine.revision),1);assert.equal(await page.locator('main [role=alert]').count(),1);
 await page.locator('#answerForm button[type=submit]').click();await tick();assert.equal(await page.evaluate(()=>stage2Demo.view().mine.revision),2);
});
await check('failed book selection rolls back checkbox',async()=>{
 await nav('revealed');await page.locator('#failInput').selectOption('network');await page.locator('[data-after-reveal=share_in_book]').check();await tick();
 assert.equal(await page.locator('[data-after-reveal=share_in_book]').isChecked(),false);
});
await check('delete draft only before reveal; dialog Escape returns focus',async()=>{
 await nav('waiting');await action('delete-confirm');assert.equal(await page.locator('#stage2Dialog').evaluate(d=>d.open),true);
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.dataset.action),'delete-confirm');
 await action('delete-confirm');await page.locator('#stage2Dialog [data-action=delete]').click();await tick();
 assert.equal(await page.locator('[data-state=answer]').count(),1);assert.equal(await page.evaluate(()=>stage2Requests.at(-1).method),'DELETE');
 await nav('revealed');assert.equal(await page.locator('main [data-action=delete-confirm]').count(),0);
});
await check('own skip needs confirmation and preserves receipt until Continue',async()=>{
 await nav('partner-ready');await action('skip-confirm');assert.match(await page.locator('#stage2Dialog').textContent(),/для обоих/);
 await page.locator('#stage2Dialog [data-action=skip]').click();await tick();assert.equal(await page.locator('[data-state=skipped]').count(),1);
 assert.doesNotMatch(await page.locator('main').textContent(),/Ты встретила меня/);await page.evaluate(()=>stage2Demo.refresh());assert.equal(await page.locator('[data-state=skipped]').count(),1);
 await action('continue');await tick();assert.equal(await page.evaluate(()=>stage2Demo.view().position),2);
});
await check('partner skip keeps own answer private and progress includes skip',async()=>{
 await nav('waiting');await page.locator('#reviewTools [data-action=demo-skip]').click();
 assert.equal(await page.locator('[data-state=skipped]').count(),1);assert.match(await page.locator('main').textContent(),/Только вам/);
 assert.equal(await page.locator('main input[type=checkbox]').count(),0);assert.equal(await page.evaluate(()=>stage2Demo.progress().done),1);
});
await check('locked card has no answer, skip, or book controls',async()=>{
 await nav('locked');assert.equal(await page.locator('#answerInput').count(),0);assert.equal(await page.locator('main [data-action=skip-confirm]').count(),0);
 assert.equal(await page.locator('main input[type=checkbox]').count(),0);assert.equal(await page.evaluate(()=>stage2Demo.view().position),4);
});
await check('return from payment remains locked until confirmed; same card after payment',async()=>{
 const id=await page.evaluate(()=>stage2Demo.view().id);await action('payment');await action('verify-payment');
 assert.equal(await page.locator('#answerInput').count(),0);assert.match(await page.locator('main').textContent(),/не получено/);
 await page.locator('#reviewTools [data-action=demo-paid]').click();
 assert.equal(await page.evaluate(()=>stage2Demo.view().id),id);assert.equal(await page.locator('#answerInput').count(),1);
 assert.match(await page.locator('main').textContent(),/Доступ открыт для вас двоих/);
});
await check('history is newest first and shows no partner text for skipped item',async()=>{
 await nav('history');const titles=await page.locator('.s2-history-item h2').allTextContents();assert.equal(titles[0],'Момент из нашей истории');
 await page.locator('.s2-history-item').nth(1).click();
 assert.match(await page.locator('#stage2Dialog').textContent(),/Мне хочется полчаса/);
 assert.doesNotMatch(await page.locator('#stage2Dialog').textContent(),/Обнять друг друга утром/);
 await page.keyboard.press('Escape');
});
await check('reading history does not Continue current result',async()=>{
 await nav('revealed');const id=await page.evaluate(()=>stage2Demo.view().id);await action('history');
 await page.locator('.s2-history-item').click();await page.keyboard.press('Escape');await action('card');
 assert.equal(await page.evaluate(()=>stage2Demo.view().id),id);assert.equal(await page.locator('[data-state=revealed]').count(),1);
 assert.equal(await page.evaluate(()=>stage2Requests.filter(r=>r.method==='POST').length),0);
});
await check('history pagination sends before position, appends without reorder',async()=>{
 await nav('history-more');assert.equal(await page.locator('.s2-history-item').count(),20);await action('more');
 assert.equal(await page.locator('.s2-history-item').count(),23);
 assert.equal(await page.evaluate(()=>stage2Requests.at(-1).path),'/api/together/history?before=4');
 assert.equal(await page.locator('main [data-action=more]').count(),0);
});
await check('empty history and null current route have distinct screens',async()=>{
 await nav('history-empty');assert.match(await page.locator('main').textContent(),/История ещё впереди/);await nav('complete');
 assert.equal(await page.evaluate(()=>stage2Demo.view()),null);assert.match(await page.locator('main').textContent(),/прошли этот маршрут/);
 assert.equal(await page.evaluate(()=>stage2Demo.progress().done),29);
});
await check('error 409 refresh retains same pending reveal',async()=>{
 await nav('revealed');await page.locator('#failInput').selectOption('409 reveal_pending');await action('continue');await tick();
 assert.equal(await page.locator('[data-state=revealed]').count(),1);assert.match(await page.locator('main [role=alert]').textContent(),/предыдущей/);
});
await check('429 prevents advance and retains draft',async()=>{
 await nav('answer');await page.locator('#answerInput').fill('Мой сохранённый здесь текст.');await page.locator('#failInput').selectOption('429');
 await page.locator('#answerForm button[type=submit]').click();await tick();assert.equal(await page.locator('#answerInput').inputValue(),'Мой сохранённый здесь текст.');
 assert.equal(await page.locator('[data-state=answer]').count(),1);
});
await check('404 clears joint screen without disclosure',async()=>{
 await nav('revealed');await page.locator('#failInput').selectOption('404');await action('continue');await tick();
 assert.match(await page.locator('main').textContent(),/Пространство недоступно/);assert.equal(await page.locator('.s2-replies').count(),0);
});
await check('long Cyrillic names and 1200 character unbroken reply wrap; literal XSS',async()=>{
 await nav('revealed');await page.evaluate(()=>{stage2Demo.setName(1,'А'+ 'я'.repeat(160));stage2Demo.setOwnText('<img src=x onerror=alert(1)>'+ 'я'.repeat(1170));});
 assert.equal(await page.locator('.s2-replies img').count(),0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
});
await check('keyboard focus and reduced motion',async()=>{
 await nav('answer');await page.locator('#answerInput').focus();assert.notEqual(await page.locator('#answerInput').evaluate(e=>getComputedStyle(e).outlineStyle),'none');
 assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion:reduce)').matches),true);
});
await check('no page errors or external requests in source prototype',async()=>{assert.deepEqual(consoleErrors,[]);assert.deepEqual(requests,[]);});
await check('standalone file opens offline and all fonts loaded',async()=>{
 await page.goto(pathToFileURL(dir+'/../deliverables/grani-together-stage2.html').href+'#revealed');
 await page.evaluate(()=>document.fonts.ready);assert.equal(await page.locator('[data-state=revealed]').count(),1);
 assert.equal(await page.evaluate(()=>document.fonts.check('300 30px TogetherDisplay','Вдвоём')),true);assert.deepEqual(consoleErrors,[]);assert.deepEqual(requests,[]);
});
}finally{
 await writeFile(out+'/evidence.json',JSON.stringify({date:'2026-10-06',scope:'static prototype only, file://, fictional accounts, no API/security validation',checks:results.length,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass),screenshots:36,results},null,2));
 await browser.close();
}
console.log(JSON.stringify({checks:results.length,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass)},null,2));
if(results.some(r=>!r.pass))process.exitCode=1;
