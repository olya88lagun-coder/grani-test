import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const root=process.cwd(),out=resolve(root,'visual-output');
await mkdir(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.woff':'font/woff'};
const server=createServer(async(req,res)=>{try{if(req.url==='/favicon.ico'){res.writeHead(204).end();return;}const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(relative(root,path).startsWith('..')){res.writeHead(403).end();return;}const data=await readFile(path);res.writeHead(200,{'content-type':types[extname(path)]??'application/octet-stream'});res.end(data);}catch{res.writeHead(404).end('not found');}});
await new Promise(r=>server.listen(4173,'127.0.0.1',r));
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({locale:'ru-RU',reducedMotion:'reduce',deviceScaleFactor:1});
const page=await context.newPage(),errors=[],badRequests=[],checks=[],images=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('response',response=>{if(response.status()>=400)badRequests.push({url:response.url(),status:response.status()});});
page.on('request',request=>{if(!request.url().startsWith('http://127.0.0.1:4173/'))badRequests.push({external:request.url()});});
const base='http://127.0.0.1:4173/docs/together/design/index.html';
const cases=[{screen:'landing'},{screen:'invite'},{screen:'invite',state:'accept'},{screen:'invite',state:'pending'},{screen:'dashboard'},{screen:'meeting'},{screen:'meeting',state:'waiting'},{screen:'meeting',state:'revealed'},{screen:'book'},{screen:'book',state:'empty'},{screen:'book',state:'ready'}];
const widths=[320,390,768,1024,1440];
const navigate=async(query)=>{await page.goto(base+'?'+new URLSearchParams(query));await page.locator('main h1').waitFor();await page.evaluate(()=>document.fonts.ready);};
const save=async(name,fullPage=true)=>{const data=await page.screenshot({path:resolve(out,name+'.jpg'),type:'jpeg',quality:80,fullPage,animations:'disabled'});images.push({name,bytes:data.length});};
async function check(name,fn){await fn();checks.push({name,status:'pass'});}
try{
for(const width of widths){
 await page.setViewportSize({width,height:width<768?844:1000});
 for(const c of cases){
  await navigate(c);
  await check('layout '+width+' '+c.screen+' '+(c.state??'default'),async()=>{
    const dimensions=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,view:innerWidth,offenders:[...document.querySelectorAll('main *')].filter(el=>{if(el.closest('svg')||getComputedStyle(el).display==='none')return false;if(el.closest('.hero-art')||el.classList.contains('orbit'))return false;const r=el.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+2||r.left< -2);}).map(el=>({tag:el.tagName,cls:el.className,text:el.textContent?.slice(0,80)})).slice(0,8)}));
    assert.ok(dimensions.doc<=dimensions.view+1,JSON.stringify(dimensions));assert.equal(dimensions.offenders.length,0,JSON.stringify(dimensions));
  });
  if([390,1440].includes(width))await save(c.screen+'-'+(c.state??'default')+'-'+width,true);
 }
}
await page.setViewportSize({width:1440,height:1000});await navigate({screen:'landing'});
await check('real brand fonts loaded including Cyrillic',async()=>{const fontState=await page.evaluate(()=>[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family));assert.ok(fontState.includes('TogetherDisplay')&&fontState.includes('TogetherBody'),JSON.stringify(fontState));assert.match(await page.locator('main h1').evaluate(el=>getComputedStyle(el).fontFamily),/TogetherDisplay/);});
await check('landing free CTA leads to invite',async()=>{await page.getByRole('button',{name:'Попробовать 3 встречи →',exact:true}).click();await page.locator('#inviteLink').waitFor();});
await check('invite preview then accepting leads to shared space',async()=>{await page.getByRole('button',{name:'Посмотреть приглашение →',exact:true}).click();await page.getByRole('button',{name:'Присоединиться как Алексей →',exact:true}).click();assert.match(await page.locator('main h1').textContent(),/подтверждения/);await page.locator('[data-actor=anna]').click();await page.getByRole('button',{name:'Подтвердить Алексея →',exact:true}).click();assert.match(await page.locator('main h1').textContent(),/Анна и Алексей/);});
await check('first free meeting uses actual introductory question',async()=>{await page.getByRole('button',{name:'Начать встречу →',exact:true}).click();assert.match(await page.locator('main h1').textContent(),/небольшой поступок/);});
await navigate({screen:'meeting'});
await check('first answer waits without partner text',async()=>{await page.locator('#answerInput').fill('Тестовый вымышленный ответ Анны.');await page.getByRole('button',{name:'Сохранить мой ответ →',exact:true}).click();assert.equal(await page.locator('.revealed-grid').count(),0);assert.match(await page.locator('.waiting').textContent(),/Пока ответ партнёра скрыт/);});
await check('second actor reveals both and can select only own record',async()=>{await page.locator('[data-actor=alexey]').click();await page.locator('#answerInput').fill('Тестовый вымышленный ответ Алексея.');await page.getByRole('button',{name:'Сохранить мой ответ →',exact:true}).click();assert.equal(await page.locator('.revealed-answer').count(),2);assert.equal(await page.locator('[data-select-own]').count(),1);await page.locator('[data-select-own]').check();});
await check('malicious input remains text',async()=>{await navigate({screen:'meeting'});await page.locator('#answerInput').fill('<img src=x onerror="window.evil=true">');await page.getByRole('button',{name:'Сохранить мой ответ →',exact:true}).click();assert.equal(await page.locator('.own-answer img').count(),0);assert.equal(await page.evaluate(()=>window.evil),undefined);assert.match(await page.locator('.own-answer').textContent(),/<img src=x/);});
await check('long unbroken personal text wraps at 320',async()=>{await page.setViewportSize({width:320,height:844});await navigate({screen:'meeting'});await page.locator('#answerInput').fill('д'.repeat(1200));await page.getByRole('button',{name:'Сохранить мой ответ →',exact:true}).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));});
await page.setViewportSize({width:1440,height:1000});await navigate({screen:'book'});
await check('PDF locked until two different actors approve',async()=>{assert.equal(await page.locator('[data-action=print-book]').isDisabled(),true);await page.locator('[data-action=approve-book]').click();assert.equal(await page.locator('[data-action=print-book]').isDisabled(),true);await page.locator('[data-actor=alexey]').click();await page.locator('[data-action=approve-book]').click();assert.equal(await page.locator('[data-action=print-book]').isDisabled(),false);});
await check('source edit resets both approvals',async()=>{await page.locator('[data-actor=anna]').click();await page.getByRole('button',{name:'Изменить мой фрагмент',exact:true}).click();await page.locator('#bookEditInput').fill('Другая выбранная вымышленная история.');await page.getByRole('button',{name:'Сохранить изменение',exact:true}).click();assert.equal(await page.locator('.approval-state.yes').count(),0);assert.equal(await page.locator('[data-action=print-book]').isDisabled(),true);});
await check('empty book keeps export disabled',async()=>{await navigate({screen:'book',state:'empty'});assert.equal(await page.locator('[data-action=print-book]').isDisabled(),true);});
await check('dialog closes with Escape',async()=>{await navigate({screen:'dashboard'});await page.locator('[data-dialog=care]').click();assert.equal(await page.locator('#dialog').evaluate(el=>el.open),true);await save('care-dialog-1440',false);await page.keyboard.press('Escape');assert.equal(await page.locator('#dialog').evaluate(el=>el.open),false);});
await check('mobile menu reaches book and closes after navigation',async()=>{await page.setViewportSize({width:390,height:844});await navigate({screen:'dashboard'});await page.getByRole('button',{name:'Открыть меню',exact:true}).click();await page.locator('#dialog [data-go=book]').click();assert.equal(await page.locator('#dialog').evaluate(el=>el.open),false);assert.match(await page.locator('main h1').textContent(),/Книга о нас/);});
await check('keyboard focus visible and reduced motion enabled',async()=>{await navigate({screen:'landing'});await page.keyboard.press('Tab');const focus=await page.evaluate(()=>({tag:document.activeElement.tagName,outline:getComputedStyle(document.activeElement).outlineStyle,motion:matchMedia('(prefers-reduced-motion: reduce)').matches}));assert.ok(['A','BUTTON'].includes(focus.tag));assert.notEqual(focus.outline,'none');assert.equal(focus.motion,true);});
await page.setViewportSize({width:1440,height:1000});await navigate({screen:'book',state:'ready'});
await check('actual fictional A5 PDF generated',async()=>{const pdf=await page.pdf({path:resolve(out,'fictional-book.pdf'),preferCSSPageSize:true,printBackground:true});assert.equal(pdf.subarray(0,4).toString(),'%PDF');const pages=(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;assert.ok(pages>=4&&pages<=8,'Unexpected print pagination '+pages);checks.push({name:'PDF page count',value:pages,status:'pass'});});
await page.emulateMedia({media:'print'});await page.screenshot({path:resolve(out,'book-print.jpg'),type:'jpeg',quality:80,fullPage:true});await page.emulateMedia({media:'screen'});

await check('portable HTML opens offline with embedded brand fonts',async()=>{
 let css=await readFile(resolve(root,'docs/together/design/together.css'),'utf8');
 const fontUrls=[...css.matchAll(/url\('([^']+\.woff)'\)/g)].map(m=>m[1]);
 for(const fontUrl of fontUrls){const bytes=await readFile(resolve(root,'docs/together/design',fontUrl));css=css.replaceAll("url('"+fontUrl+"')","url('data:font/woff;base64,"+bytes.toString('base64')+"')");}
 const js=await readFile(resolve(root,'docs/together/design/together.js'),'utf8');
 let html=await readFile(resolve(root,'docs/together/design/index.html'),'utf8');
 html=html.replace('<link rel="stylesheet" href="./together.css">','<style>'+css+'</style>').replace('<script src="./together.js" defer></script>','').replace('</body>','<script>'+js+'</script></body>');
 const path=resolve(out,'grani-together-review.html');await writeFile(path,html);
 const offline=await context.newPage();const offlineErrors=[];offline.on('pageerror',e=>offlineErrors.push(String(e)));
 await offline.goto(pathToFileURL(path).href);await offline.locator('main h1').waitFor();await offline.evaluate(()=>document.fonts.ready);
 await offline.getByRole('button',{name:'Попробовать 3 встречи →',exact:true}).click();await offline.locator('#inviteLink').waitFor();
 assert.deepEqual(offlineErrors,[]);
 await offline.close();
 console.log('PORTABLE_BEGIN');
 const encoded=Buffer.from(html).toString('base64');for(let i=0;i<encoded.length;i+=12000)console.log('PORTABLE_DATA:'+encoded.slice(i,i+12000));
 console.log('PORTABLE_END');
});

assert.deepEqual(errors,[]);assert.deepEqual(badRequests,[]);
await writeFile(resolve(out,'evidence.json'),JSON.stringify({status:'pass',head:process.env.GITHUB_SHA,widths,cases,checks,errors,badRequests,images},null,2));
console.log('VISUAL_QA_PASS '+JSON.stringify({checks:checks.length,layouts:widths.length*cases.length,images:images.length,pages:checks.find(c=>c.name==='PDF page count')?.value}));
for(const name of ['landing-default-1440','dashboard-default-1440','meeting-default-1440','book-default-1440','invite-default-1440','landing-default-390','book-default-390','meeting-revealed-1440','book-ready-1440']){
 const c=cases.find(c=>name.startsWith(c.screen+'-'+(c.state??'default')+'-'));
 await page.setViewportSize({width:name.endsWith('390')?390:1440,height:name.endsWith('390')?844:1000});await navigate(c);
 const data=await page.screenshot({type:'jpeg',quality:76,fullPage:name==='landing-default-390'||name==='meeting-revealed-1440'||name==='book-ready-1440',animations:'disabled'});console.log('IMG_BEGIN:'+name);const base64=data.toString('base64');for(let i=0;i<base64.length;i+=12000)console.log('IMG_DATA:'+base64.slice(i,i+12000));console.log('IMG_END:'+name);
}
}catch(error){await writeFile(resolve(out,'evidence.json'),JSON.stringify({status:'fail',head:process.env.GITHUB_SHA,checks,errors,badRequests,error:String(error)},null,2));await page.screenshot({path:resolve(out,'failure.jpg'),type:'jpeg',quality:80,fullPage:true});console.log('VISUAL_QA_FAIL '+JSON.stringify({checks:checks.length,last:checks.at(-1),errors,badRequests,error:String(error)}));console.error(error);process.exitCode=1;}finally{await browser.close();server.close();}
