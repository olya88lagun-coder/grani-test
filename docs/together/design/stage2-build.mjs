import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const repo='C:/dev/grani-test';
const dir=resolve(repo,'docs/together/design');
const intro=JSON.parse(await readFile(resolve(repo,'packages/content/src/together/intro.json'),'utf8'));
const month=JSON.parse(await readFile(resolve(repo,'packages/content/src/together/month-01.json'),'utf8'));
const cards=[...intro.cards.map(c=>({...c,kind:'intro'})),...month.cards.filter(c=>/^m01-d(0[1-9]|1[0-9]|2[0-6])$/.test(c.id))];
if(cards.length!==29)throw new Error('Expected route of 29 cards');
await writeFile(resolve(dir,'stage2-catalog.js'),'/* Editorial fixtures from stage 2 catalog, not a server catalog replacement. */\nwindow.stage2Catalog = '+JSON.stringify(cards,null,2)+';\n');
let css=await readFile(resolve(dir,'together.css'),'utf8');
for(const m of [...css.matchAll(/url\('([^']+\.woff)'\)/g)]){
 const b=await readFile(resolve(dir,m[1]));
 css=css.replaceAll("url('"+m[1]+"')","url('data:font/woff;base64,"+b.toString('base64')+"')");
}
css+='\n'+(await readFile(resolve(dir,'stage2.css'),'utf8')).replace("@import url('./together.css');",'');
let html=await readFile(resolve(dir,'stage2.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="./stage2.css">','<style>'+css+'</style>');
html=html.replace('<script src="./stage2-catalog.js" defer></script>','<script>'+await readFile(resolve(dir,'stage2-catalog.js'),'utf8')+'</script>');
const js=await readFile(resolve(dir,'stage2.js'),'utf8');
html=html.replace('<script src="./stage2.js" defer></script>','');
html=html.replace('</body>','<script>'+js+'</script></body>');
html=html.replaceAll('href="./index.html"','href="../design/deliverables/grani-together-review.html"').replaceAll('href="./stage1.html"','href="./grani-together-stage1.html"');
await mkdir(resolve(repo,'docs/together/deliverables'),{recursive:true});
await writeFile(resolve(repo,'docs/together/deliverables/grani-together-stage2.html'),html);
console.log(JSON.stringify({catalog:cards.length,standaloneBytes:Buffer.byteLength(html)}));
