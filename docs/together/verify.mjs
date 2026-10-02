import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function verifyTogetherPrototype(html,assert,makeSandbox) {
  const scripts=[...html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  assert.equal(scripts.length,2);
  scripts.forEach(s=>new Function(s));
  const logic=makeSandbox(scripts[0]).context.TogetherDemo;
  let count=0; const cases=[];
  function test(name,fn){fn();count++;cases.push(name);}
  const joined=()=>logic.join(logic.create(logic.initial()));
  const answered=()=>logic.submit(logic.submit(joined(),"intro-01","a","Спасибо за прогулку"),"intro-01","b","Спасибо за чай");
  test("three distinct introductory sessions",()=>assert.equal(new Set(logic.cards.map(c=>c.id)).size,3));
  test("new space requires no personality result",()=>{const s=logic.create(logic.initial());assert.equal(s.created,true);assert.equal("resultId" in s,false);});
  test("partner cannot answer before accepting",()=>assert.throws(()=>logic.submit(logic.create(logic.initial()),"intro-01","b","Ответ")));
  test("uninvited participant sees no answers",()=>{let s=logic.create(logic.initial());s=logic.submit(s,"intro-01","a","Личный ответ");assert.equal(logic.visible(s,"intro-01","b").a,null);});
  test("other answer stays hidden until both answer",()=>{const s=logic.submit(joined(),"intro-01","a","Личный ответ");assert.equal(logic.visible(s,"intro-01","b").a,null);assert.equal(logic.visible(s,"intro-01","a").a,"Личный ответ");});
  test("blank and oversized answers rejected",()=>{assert.throws(()=>logic.submit(joined(),"intro-01","a","  "));assert.throws(()=>logic.submit(joined(),"intro-01","a","x".repeat(1201)));});
  test("unknown session rejected",()=>assert.throws(()=>logic.submit(joined(),"missing","a","Ответ")));
  test("both answers reveal after both submissions",()=>assert.equal(logic.visible(answered(),"intro-01","a").b,"Спасибо за чай"));
  test("completion requires both participants",()=>assert.throws(()=>logic.complete(joined(),"intro-01")));
  test("completion is idempotent",()=>{let s=logic.complete(answered(),"intro-01");s=logic.complete(s,"intro-01");assert.equal(s.completed.length,1);});
  test("only selected material enters book",()=>{const s=logic.select(answered(),"intro-01","a");assert.equal(logic.materials(s).length,1);assert.equal(logic.materials(s)[0].actor,"a");});
  test("milestone alone does not permit printing",()=>assert.equal(logic.canPrint(logic.stage(answered(),3)),false));
  test("approval requires selected content and third stage",()=>{assert.throws(()=>logic.approve(logic.stage(answered(),3),"a"));assert.throws(()=>logic.approve(logic.select(answered(),"intro-01","a"),"a"));});
  test("both must approve the same revision",()=>{let s=logic.stage(logic.select(answered(),"intro-01","a"),3);s=logic.approve(s,"a");assert.equal(logic.canPrint(s),false);s=logic.approve(s,"b");assert.equal(logic.canPrint(s),true);});
  test("editing approved text invalidates both approvals",()=>{let s=logic.stage(logic.select(answered(),"intro-01","a"),3);s=logic.approve(logic.approve(s,"a"),"b");s=logic.submit(s,"intro-01","a","Другой текст");assert.equal(logic.canPrint(s),false);assert.equal(s.approvals.a,null);assert.equal(s.approvals.b,null);});
  test("removing selected content invalidates publication",()=>{let s=logic.stage(logic.select(answered(),"intro-01","a"),3);s=logic.approve(logic.approve(s,"a"),"b");s=logic.select(s,"intro-01","a");assert.equal(logic.materials(s).length,0);assert.equal(logic.canPrint(s),false);});
  test("demo stage validates input",()=>{assert.throws(()=>logic.stage(logic.initial(),3));assert.throws(()=>logic.stage(joined(),13));assert.throws(()=>logic.stage(joined(),2.5));});
  test("interactive path escapes answers and protects print action",()=>{
    const sb=makeSandbox(scripts.join("\n")), nodes=sb.nodes, handlers=sb.handlers;
    const click=(action,extra={})=>handlers.click({target:{closest:()=>({dataset:{action,...extra},disabled:false})}});
    const submit=value=>handlers.submit({target:{id:"answer-form",value},preventDefault(){}});
    click("create");click("activity",{id:"intro-01"});
    const malicious="<img src=x onerror=alert(1)>";
    submit(malicious);assert.ok(nodes.app.innerHTML.includes("&lt;img"));assert.ok(!nodes.app.innerHTML.includes(malicious));
    click("switch",{actor:"b"});click("join");click("activity",{id:"intro-01"});submit("Вечерняя прогулка");click("select");
    click("switch",{actor:"a"});click("select");click("view",{view:"history"});
    assert.ok(nodes.app.innerHTML.includes("Вечерняя прогулка"));assert.ok(nodes.app.innerHTML.includes("&lt;img"));
    handlers.stage({target:{value:"3"}});click("approve");click("switch",{actor:"b"});click("approve");click("print");
    assert.equal(sb.printCount(),1);assert.ok(!nodes["print-book"].innerHTML.includes(malicious));
    click("switch",{actor:"a"});click("activity",{id:"intro-01"});submit("Изменённый ответ");click("view",{view:"history"});click("print");
    assert.equal(sb.printCount(),1);assert.ok(nodes.notice.textContent.includes("одобрить оба"));
  });
  return {count,cases};
}

function makeSandbox(source) {
  const handlers = {}, nodes = {}; let printCount = 0;
  const node = id => nodes[id] ??= ({ innerHTML: "", textContent: "", value: "", disabled: false, setAttribute() {}, addEventListener(type, fn) { if (id === "demo-stage" && type === "change") handlers.stage = fn; }, querySelector() { return { focus() {} }; } });
  const context = vm.createContext({ document: { getElementById: node, addEventListener(type, fn) { handlers[type] = fn; }, querySelector() { return { scrollIntoView() {} }; } }, window: { scrollTo() {}, print() { printCount++; } }, FormData: class { constructor(form) { this.form = form; } get() { return this.form.value; } } });
  vm.runInContext(source, context);
  return { context, nodes, handlers, printCount: () => printCount };
}

const html = readFileSync(new URL("./prototype.html", import.meta.url), "utf8");
const result = verifyTogetherPrototype(html, assert, makeSandbox);
for (const name of result.cases) console.log("PASS", name);
console.log(result.count + " prototype checks passed. Browser layout and production server access are not covered.");
