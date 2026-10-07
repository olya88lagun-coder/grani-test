import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const repo='C:/dev/grani-test', dir=resolve(repo,'docs/together/design');
const require=createRequire(resolve(repo,'package.json'));
const {build}=require(resolve(repo,'node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild/lib/main.js'));
await build({absWorkingDir:repo,entryPoints:[resolve(dir,'extras-preview.tsx')],bundle:true,
 outfile:resolve(dir,'extras-preview.js'),jsx:'automatic',tsconfig:resolve(repo,'apps/web/tsconfig.json'),
 alias:{react:resolve(repo,'node_modules/.pnpm/react@19.3.0/node_modules/react'),
 'react-dom':resolve(repo,'node_modules/.pnpm/react-dom@19.3.0_react@19.3.0/node_modules/react-dom'),
 '@grani/core':resolve(repo,'packages/core/src/index.ts'),
 zod:resolve(repo,'node_modules/.pnpm/zod@4.6.5/node_modules/zod'),
 scheduler:resolve(repo,'node_modules/.pnpm/scheduler@0.28.0/node_modules/scheduler')},
 external:['/home/*'],
 define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'scoped-styles',setup(b){b.onLoad({filter:/\.module\.css$/},async a=>({contents:await readFile(a.path,'utf8'),loader:'local-css'}));}}]});
let fonts='';
for(const [family,file,weight] of [
 ['ExtraDisplay','cormorant-garamond-cyrillic-300-normal.woff',300],
 ['ExtraDisplay','cormorant-garamond-latin-300-normal.woff',300],
 ['ExtraBody','golos-text-cyrillic-400-normal.woff',400],
 ['ExtraBody','golos-text-latin-400-normal.woff',400],
 ['ExtraBody','golos-text-cyrillic-600-normal.woff',600],
 ['ExtraBody','golos-text-latin-600-normal.woff',600]]){
 const buf=await readFile(resolve(repo,'apps/web/assets/fonts',file));
 const range=file.includes('cyrillic')?'unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;':'';
 fonts+='@font-face{font-family:'+family+';src:url(data:font/woff;base64,'+buf.toString('base64')+');font-weight:'+weight+';'+range+'font-display:swap;}';
}
const extra=fonts+'\n:root{--font-cormorant:ExtraDisplay;--font-golos:ExtraBody}body{background:#FFFCFA}.extras-review{padding:9px 20px;background:#4A2230;color:#FFFCFA;text-align:center;font:11px/1.6 ExtraBody}.extras-tools{max-width:640px;margin:auto;padding:22px 16px 30px;border-top:1px dashed #E2C2B6;font-size:12px}.extras-tools label{display:grid;gap:9px}.extras-tools select{max-width:100%;width:100%;padding:13px;border:1px solid #F0E8E4;background:#FFFCFA;border-radius:10px;font:14px ExtraBody;color:#4A2230}main.page{min-height:0;padding-bottom:48px}';
const css=await readFile(resolve(dir,'extras-preview.css'),'utf8');
const js=await readFile(resolve(dir,'extras-preview.js'),'utf8');
const html='<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Грани. Вдвоём — новые блоки</title><style>'+css+'\n'+extra+'</style></head><body><div id="extras-root"></div><script>'+js.replaceAll('</script','<\\/script')+'</script></body></html>';
await mkdir(resolve(repo,'docs/together/deliverables'),{recursive:true});
await writeFile(resolve(repo,'docs/together/deliverables/grani-together-extras.html'),html);
console.log(JSON.stringify({status:'built',bytes:Buffer.byteLength(html),components:'actual application sources, mocked API, CSS modules'}));
