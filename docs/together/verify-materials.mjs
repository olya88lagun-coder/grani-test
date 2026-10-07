import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { buildCareCard } from "./rewards/care-card-engine.mjs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const json=path=>JSON.parse(read(path));

function verifyMaterialPack({library,example,book,careHtml,bookHtml},assert,build,makeCareSandbox){
  let count=0,cases=[];const test=(name,fn)=>{fn();count++;cases.push(name);};const copy=v=>JSON.parse(JSON.stringify(v));
  const all=[...library.cards,...library.reserveCards,...library.dates];
  test("month has 28 main, 3 reserve and 4 dates",()=>{assert.equal(library.cards.length,28);assert.equal(library.reserveCards.length,3);assert.equal(library.dates.length,4);});
  test("all activity IDs and titles are unique",()=>{assert.equal(new Set(all.map(c=>c.id)).size,35);assert.equal(new Set(all.map(c=>c.title)).size,35);});
  test("main and reserve prompts are distinct",()=>assert.equal(new Set([...library.cards,...library.reserveCards].map(c=>c.prompt)).size,31));
  test("main sequence has no gaps",()=>library.cards.forEach((c,i)=>assert.equal(c.order,i+1)));
  test("each short activity has a question, hint and action",()=>[...library.cards,...library.reserveCards].forEach(c=>{assert.ok(c.prompt.trim());assert.ok(c.hint.trim());assert.ok(c.jointAction.trim());assert.equal(c.skipAllowed,true);assert.equal(c.revealPolicy,"after_both_submit");}));
  test("field IDs and source mappings are valid",()=>library.cards.forEach(c=>{assert.equal(new Set(c.fields.map(f=>f.id)).size,c.fields.length);if(c.rewardBinding?.actionField){assert.ok(c.fields.some(f=>f.id===c.rewardBinding.actionField));assert.ok(c.fields.some(f=>f.id===c.rewardBinding.consentField));}}));
  test("book and reward selections appear only after reveal",()=>[...library.cards,...library.reserveCards].forEach(c=>c.fields.filter(f=>["share_in_book","allow_care_reward"].includes(f.id)).forEach(f=>assert.equal(f.availableAt,"after_reveal"))));
  test("dates have complete steps and alternatives",()=>library.dates.forEach(d=>{assert.equal(d.steps.length,4);assert.ok(d.homeAlternative.trim());assert.ok(d.conversation.trim());assert.equal(d.requiresBothConsent,true);}));
  test("example candidates map to real source categories",()=>example.candidates.forEach(c=>{const source=library.cards.find(x=>x.id===c.sourceId);assert.ok(source);assert.equal(source.rewardBinding.type,c.category);}));
  test("complete example contains five truthful items",()=>{const out=build(example);assert.equal(out.complete,true);assert.equal(out.items.length,5);assert.equal(out.items[0].text,example.candidates[0].action);});
  test("one person cannot select other person's preference",()=>{const d=copy(example);d.selections.a.attention="b-attention";assert.throws(()=>build(d));});
  test("category mismatch rejected",()=>{const d=copy(example);d.selections.a.attention="a-ease";assert.throws(()=>build(d));});
  test("nonconsented candidate is never included",()=>{const d=copy(example);d.candidates[0].allowReward=false;d.candidates[0].action="НЕ ПУБЛИКОВАТЬ";const out=build(d);assert.equal(out.items.length,4);assert.ok(!JSON.stringify(out).includes("НЕ ПУБЛИКОВАТЬ"));});
  test("missing preference does not invent content",()=>{const d=copy(example);delete d.selections.a.attention;const out=build(d);assert.equal(out.complete,false);assert.equal(out.items.length,4);assert.ok(out.missing.includes("a.attention"));});
  test("ritual requires both participants",()=>{const d=copy(example);d.ritual.confirmedBy=["a"];assert.equal(build(d).items.length,4);});
  test("fully empty selection produces empty card",()=>{const d=copy(example);d.selections={};delete d.ritual;const out=build(d);assert.equal(out.empty,true);assert.equal(out.items.length,0);assert.equal(out.missing.length,5);});
  test("duplicate candidates and members rejected",()=>{const d=copy(example);d.candidates.push(copy(d.candidates[0]));assert.throws(()=>build(d));const e=copy(example);e.members[1].id="a";assert.throws(()=>build(e));});
  test("length limits and whitespace validation",()=>{const d=copy(example);d.candidates[0].action="x".repeat(181);assert.throws(()=>build(d));const e=copy(example);e.members[0].name=" ";assert.throws(()=>build(e));});
  test("book has sixteen clearly fictional pages",()=>{assert.equal(book.isFictional,true);assert.equal(book.pages.length,16);book.pages.forEach(p=>assert.equal(p.isFictional,true));assert.equal((bookHtml.match(/<article class="page /g)||[]).length,16);assert.ok(bookHtml.includes("Демонстрационная история"));});
  test("previews use no external scripts or images",()=>{assert.ok(!/(?:src|href)="https?:/.test(careHtml));assert.ok(!/(?:src|href)="https?:/.test(bookHtml));});
  test("preview scripts parse",()=>[careHtml,bookHtml].forEach(html=>[...html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)].forEach(m=>new Function(m[1]))));
  test("care preview invalidates approvals and escapes text",()=>{
    const sb=makeCareSandbox(careHtml,example);const n=sb.nodes;
    assert.equal(n["print-care"].disabled,true);
    n["approve-a"].checked=true;sb.handlers["approve-a:change"]();
    assert.equal(n["print-care"].disabled,true);
    n["approve-b"].checked=true;sb.handlers["approve-b:change"]();
    assert.equal(n["print-care"].disabled,false);
    sb.handlers["print-care:click"]();assert.equal(sb.printCount(),1);
    const bad="<img src=x onerror=alert(1)>";sb.values["a-attention"]=bad;sb.handlers["care-form:input"]();
    assert.equal(n["approve-a"].checked,false);assert.equal(n["approve-b"].checked,false);
    assert.equal(n["print-care"].disabled,true);assert.ok(n["care-preview"].innerHTML.includes("&lt;img"));assert.ok(!n["care-preview"].innerHTML.includes(bad));
    sb.handlers["print-care:click"]();assert.equal(sb.printCount(),1);
  });
  return {count,cases};
}

function makeSandbox(html,example){
 const values={},nodes={},handlers={};let prints=0;
 example.members.forEach(m=>values["name-"+m.id]=m.name);
 example.candidates.forEach(c=>{values[c.id]=c.action;values[c.id+"-context"]=c.context;});
 values.ritual=example.ritual.name;values.schedule=example.ritual.schedule;values.duration=example.ritual.duration;
 const node=id=>nodes[id]??={checked:false,disabled:false,innerHTML:"",textContent:"",addEventListener(type,fn){handlers[id+":"+type]=fn;}};
 const context=vm.createContext({document:{getElementById:node},window:{print(){prints++;}},FormData:class{get(key){return values[key];}}});
 const scripts=[...html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n");
 vm.runInContext(scripts,context);
 return {nodes,handlers,values,printCount:()=>prints};
}
const result=verifyMaterialPack({library:json("./content/month-01.json"),example:json("./rewards/care-card-example.json"),book:json("./book/book-example.json"),careHtml:read("./rewards/care-card-preview.html"),bookHtml:read("./book/book-sample.html")},assert,buildCareCard,makeSandbox);
for(const name of result.cases)console.log("PASS",name);
console.log(result.count+" material checks passed. Visual layout, actual PDF rendering, backend rights and billing are not covered.");
