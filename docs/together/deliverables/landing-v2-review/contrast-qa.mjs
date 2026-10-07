import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
const require=createRequire('C:/dev/grani-test/package.json');
const {chromium}=require('@playwright/test');
const sharp=require('C:/dev/grani-test/node_modules/.pnpm/sharp@0.35.4_@types+node@26.5.1/node_modules/sharp');
const l=rgb=>rgb.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
for(const width of [320,390,768,1024,1440]){
 const page=await browser.newPage({viewport:{width,height:1100},deviceScaleFactor:1});
 await page.goto(pathToFileURL('C:/dev/grani-test/docs/together/deliverables/grani-together-landing-v2.html').href);
 await page.evaluate(()=>document.fonts.ready);
 const boxes=await page.evaluate(()=>{
  const intro=document.querySelector('main > section > div > div');
  const rows=[];
  for(const el of intro.querySelectorAll('h1,p,li,a')) for(const node of el.childNodes){
   if(node.nodeType!==Node.TEXT_NODE || !node.textContent.trim())continue;
   const range=document.createRange();range.selectNode(node);
   const color=getComputedStyle(el).color.match(/[\d.]+/g).slice(0,3).map(Number);
   for(const rect of range.getClientRects())if(rect.width&&rect.height)rows.push({text:node.textContent.trim(),color,x:rect.x,y:rect.y,width:rect.width,height:rect.height});
  }
  return rows;
 });
 await page.addStyleTag({content:'main h1,main h2,main h3,main p,main li,main a,main span {color:transparent!important}'});
 const {data,info}=await sharp(await page.screenshot()).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const measures=boxes.map(box=>{
  let ratio=99;
  const foreground=l(box.color);
  for(let y=Math.max(0,Math.floor(box.y));y<Math.min(info.height,Math.ceil(box.y+box.height));y++)for(let x=Math.max(0,Math.floor(box.x));x<Math.min(info.width,Math.ceil(box.x+box.width));x++){
   const i=(y*info.width+x)*3;const background=l([data[i],data[i+1],data[i+2]]);
   ratio=Math.min(ratio,(Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05));
  }
  return {text:box.text,ratio};
 });
 results.push({width,minimum:Math.min(...measures.map(x=>x.ratio)),measures});
 await page.close();
}
await browser.close();
await writeFile('C:/Users/olya8/Documents/Codex/2026-10-07/referenced-chatgpt-conversation-this-is-an/outputs/together-hero-contrast.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results.map(({width,minimum})=>({width,minimum})),null,2));
if(results.some(x=>x.minimum<4.5))process.exitCode=1;
