import {chromium} from 'file:///C:/Users/olya8/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const dir='C:/dev/grani-test/docs/together/design',out=dir+'/extras-previews';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page=await browser.newPage({reducedMotion:'reduce'});
const results=[], errors=[], externalRequests=[], images=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('request',r=>{if(/^https?:/.test(r.url()))externalRequests.push(r.url());});
const url=pathToFileURL(dir+'/../deliverables/grani-together-extras.html').href;
const scenes=['pilot-login','pilot-code','note','invitation','invitation-empty','friends','care','care-partial','care-empty','care-pending','care-long'];
async function check(name,fn){try{await fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.message});}}
const nav=async s=>{await page.evaluate(s=>extrasSetScene(s),s);await page.waitForTimeout(80);await page.evaluate(()=>document.fonts.ready);};
const screenshot=async(name,width)=>{const file=name+'-'+width+'.jpg';await page.screenshot({path:out+'/'+file,type:'jpeg',quality:88,fullPage:true});images.push(file);};
const geometry=async()=>{assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
 const small=await page.locator('main button:visible,main a:visible,main input:visible,main textarea:visible,main summary:visible').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().height<43).map(e=>e.textContent));
 assert.deepEqual(small,[]);assert.equal(await page.locator('main h1').count(),1);
};
try{
await page.goto(url);await page.locator('#pilot-code').waitFor();
for(const width of [320,390,768,1024,1440]){
 await page.setViewportSize({width,height:width<768?844:1000});
 for(const scene of scenes){
  await nav(scene);
  if(scene.startsWith('care')&&scene!=='care-pending')await page.locator('#care-card-title').waitFor();
  await check('layout '+scene+' at '+width,geometry);
  if([390,1440].includes(width))await screenshot(scene,width);
  if(scene==='friends'){
   await page.locator('main summary').click();await check('layout friends expanded at '+width,geometry);
   if([390,1440].includes(width))await screenshot('friends-expanded',width);
  }
 }
}
await page.setViewportSize({width:390,height:844});
await check('pilot has no price or offer, and login keeps from code',async()=>{
 await nav('pilot-login');const main=await page.locator('main').textContent();assert.doesNotMatch(main,/399|599|₽|полгода|подписк/i);
 assert.equal(await page.locator('main a').getAttribute('href'),'/api/together/enter?next=space&from=AbCdEfGh23');assert.match(main,/VK ID/);
});
await check('pilot form binds accessible labels and disables empty submission',async()=>{
 await nav('pilot-code');assert.equal(await page.getByRole('button',{name:'Войти по коду'}).isDisabled(),true);
 assert.equal(await page.getByLabel('Код доступа').count(),1);assert.equal(await page.locator('#pilot-code').getAttribute('maxlength'),'64');
});
await check('invalid pilot code uses existing API body, error described by input',async()=>{
 await page.locator('#pilot-code').fill('invalid-demo-code');await page.getByRole('button',{name:'Войти по коду'}).click();
 await page.locator('[role=alert]').waitFor();assert.match(await page.locator('[role=alert]').textContent(),/Код не подошёл/);
 const calls=await page.evaluate(()=>extrasRequests);assert.deepEqual(calls[0],{url:'/api/together/pilot',method:'POST',body:{code:'invalid-demo-code'}});
 assert.equal(await page.locator('#pilot-code').inputValue(),'invalid-demo-code');assert.equal(await page.locator('#pilot-code').getAttribute('aria-invalid'),'true');
 assert.match(await page.locator('#pilot-code').getAttribute('aria-describedby'),/pilot-code-error/);
 await screenshot('pilot-code-error',390);
});
await check('pilot busy state blocks editing and double click while request pending',async()=>{
 await nav('pilot-code');await page.locator('#pilot-code').fill('test');await page.evaluate(()=>extrasDelay=250);
 await page.getByRole('button',{name:'Войти по коду'}).click();assert.equal(await page.locator('#pilot-code').isDisabled(),true);
 assert.equal(await page.getByRole('button',{name:'Проверяем…'}).isDisabled(),true);
 await page.locator('[role=alert]').waitFor();assert.equal(await page.evaluate(()=>extrasRequests.length),1);
});
for(const [failure,copy]of[['429','Слишком много попыток'],['network','связаться с сервером'],['limit','Все места']]){
 await check('pilot error '+failure,async()=>{await nav('pilot-code');await page.locator('#pilot-code').fill('test');await page.evaluate(f=>extrasFail=f,failure);
  await page.getByRole('button',{name:'Войти по коду'}).click();await page.locator('[role=alert]').waitFor();
  assert.match(await page.locator('[role=alert]').textContent(),new RegExp(copy));assert.equal(await page.locator('#pilot-code').inputValue(),'test');
 });
}
await check('note counters, limit, saving and existing PUT shape',async()=>{
 await nav('note');await page.locator('#together-note').fill('Хочу немного времени для нас двоих.');
 assert.equal(await page.locator('#together-note').getAttribute('maxlength'),'200');
 assert.match(await page.locator('#invite-note-count').textContent(),/35 \/ 200/);
 await page.getByRole('button',{name:'Сохранить записку'}).click();assert.equal(await page.locator('#together-note').isDisabled(),true);
 await page.getByRole('status').waitFor();assert.deepEqual((await page.evaluate(()=>extrasRequests)).at(-1),{url:'/api/together/invite/note',method:'PUT',body:{note:'Хочу немного времени для нас двоих.'}});
});
await check('empty note makes destructive meaning explicit without auto save',async()=>{
 await nav('note');await page.locator('#together-note').fill('');assert.equal(await page.evaluate(()=>extrasRequests.length),0);
 assert.equal(await page.getByRole('button',{name:'Убрать записку'}).count(),1);
 assert.match(await page.locator('main').textContent(),/удалит прежнюю записку/);
 await page.getByRole('button',{name:'Убрать записку'}).click();await page.getByRole('status').waitFor();
 assert.deepEqual((await page.evaluate(()=>extrasRequests)).at(-1).body,{note:''});await screenshot('note-empty',390);
});
await check('invitation with and without note preserves question and no answer form',async()=>{
 await nav('invitation');assert.equal(await page.getByRole('blockquote').count(),1);assert.match(await page.locator('main').textContent(),/Анна приглашает вас/);
 assert.equal(await page.locator('main input,main textarea').count(),0);await nav('invitation-empty');assert.equal(await page.getByRole('blockquote').count(),0);
 assert.equal(await page.getByRole('heading',{name:'Первый вопрос'}).count(),1);
});
await check('friends link only requested on explicit click, expandable by keyboard',async()=>{
 await nav('friends');assert.equal(await page.evaluate(()=>extrasRequests.length),0);
 await page.locator('main summary').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('main details').getAttribute('open'),'');
 await page.getByRole('button',{name:'Получить ссылку'}).click();await page.locator('#together-share-link').waitFor();
 assert.deepEqual((await page.evaluate(()=>extrasRequests)).at(-1),{url:'/api/together/share',method:'POST',body:{}});
 assert.equal(await page.locator('#together-share-link').inputValue(),'https://grani-test.ru/together?from=AbCdEfGh23');assert.equal(await page.locator('#together-share-link').getAttribute('readonly'),'');
 await screenshot('friends-ready',390);
});
await check('copy feedback only after clipboard success',async()=>{
 await page.getByRole('button',{name:'Скопировать ссылку'}).click();await page.getByRole('status').waitFor();
 assert.equal(await page.evaluate(()=>extrasCopied),'https://grani-test.ru/together?from=AbCdEfGh23');assert.match(await page.getByRole('status').textContent(),/скопирована/);
});
await check('clipboard refusal selects link for manual copy',async()=>{
 await page.evaluate(()=>extrasClipboardFails=true);await page.getByRole('button',{name:'Скопировать ссылку'}).click();
 assert.match(await page.getByRole('status').textContent(),/вручную/);
 assert.equal(await page.locator('#together-share-link').evaluate(e=>e.selectionEnd-e.selectionStart),46);
});
await check('friends request error does not create a fake URL',async()=>{
 await nav('friends');await page.locator('main summary').click();await page.evaluate(()=>extrasFail='network');
 await page.getByRole('button',{name:'Получить ссылку'}).click();await page.getByRole('alert').waitFor();
 assert.equal(await page.locator('#together-share-link').count(),0);
});
await check('care calls actual endpoint, preserves authors and contexts',async()=>{
 await nav('care');await page.locator('#care-card-title').waitFor();assert.deepEqual(await page.evaluate(()=>extrasRequests),[{url:'/api/together/care',method:'GET'}]);
 assert.equal(await page.getByRole('heading',{name:'Анна',exact:true}).count(),1);assert.equal(await page.getByRole('heading',{name:'Алексей',exact:true}).count(),1);
 assert.equal(await page.getByText('После работы',{exact:true}).count(),1);assert.match(await page.locator('main').textContent(),/Личные предложения/);
 assert.doesNotMatch(await page.locator('main').textContent(),/ИИ|скачать|мы договорились|открыть свои ответы в истории/i);
});
await check('empty and partial care are explicit, no unavailable edit or reward CTA',async()=>{
 await nav('care-empty');await page.locator('#care-card-title').waitFor();assert.match(await page.locator('main').textContent(),/Пока без выбранных пунктов/);
 await nav('care-partial');await page.locator('#care-card-title').waitFor();assert.match(await page.locator('main').textContent(),/Выбранных пунктов пока нет/);
 assert.match(await page.locator('main').textContent(),/Необязательно заполнять все разделы/);assert.equal(await page.locator('main button,main a').count(),0);
});
await check('care not ready stays hidden',async()=>{await nav('care-pending');assert.equal(await page.locator('#care-card-title').count(),0);});
await check('long text wraps and HTML stays literal',async()=>{await nav('care-long');await page.locator('#care-card-title').waitFor();
 assert.equal(await page.locator('main img').count(),0);assert.match(await page.locator('main').textContent(),/<img src=x/);await geometry();
});
await check('keyboard focus and reduced motion, loaded Cyrillic fonts',async()=>{
 await nav('pilot-code');await page.locator('#pilot-code').focus();assert.notEqual(await page.locator('#pilot-code').evaluate(e=>getComputedStyle(e).outlineStyle),'none');
 assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion:reduce)').matches),true);
 assert.equal(await page.evaluate(()=>document.fonts.check('300 30px ExtraDisplay','Вдвоём')&&document.fonts.check('400 16px ExtraBody','Записка')),true);
});
await check('no React/JS errors and no external browser requests',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);});
}finally{
 await writeFile(out+'/evidence.json',JSON.stringify({date:'2026-10-07',scope:'actual React components and CSS, mocked API/clipboard, file://; no real auth or payment verification',
 checks:results.length,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass),images,errors,externalRequests,results},null,2));
 await browser.close();
}
console.log(JSON.stringify({checks:results.length,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass),images:images.length},null,2));
if(results.some(x=>!x.pass))process.exitCode=1;
