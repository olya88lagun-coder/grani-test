import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import { catalogBindings, assembleBook } from './book/book-assembler.mjs';
import { calculate, DEFAULTS } from './economics/model.mjs';
const text = path => readFile(new URL(path, import.meta.url), 'utf8');
const json = async path => JSON.parse(await text(path));
const catalogs = await Promise.all([1, 2, 3].map(n => json('./content/month-0' + n + '.json')));
const fixture = await json('./book/quarter-example.json');
const clone = value => structuredClone(value);
const bindings = catalogBindings(catalogs);
const draft = () => assembleBook(clone(fixture), bindings);
const approved = () => {
  const f = clone(fixture), d = assembleBook(f, bindings);
  f.approvals = f.memberIds.map(memberId => ({ memberId, digest: d.digest, active: true }));
  return f;
};
const rejects = (mutate, code) => {
  const f = clone(fixture); mutate(f);
  assert.throws(() => assembleBook(f, bindings), new RegExp(code));
};
const close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, actual + ' vs ' + expected);

test('M2 and M3: complete cadence, correctly indexed weeks and independent introductory block', () => {
  for (const m of catalogs.slice(1)) {
    assert.equal(m.status, 'editorial_draft_for_review');
    assert.equal(m.cards.length, 28); assert.equal(m.reserveCards.length, 3); assert.equal(m.dates.length, 4);
    assert.equal(m.introductorySessionsSeparate, true);
    assert.deepEqual(m.cards.map(c => c.order), Array.from({length:28},(_,i)=>i+1));
    for (const w of m.weeks) assert.equal(m.cards.filter(c=>w.days.includes(c.order)).length,7);
  }
});
test('All three months have globally distinct card IDs and semantic keys', () => {
  const cards = catalogs.flatMap(m=>[...m.cards,...m.reserveCards,...m.dates]);
  assert.equal(new Set(cards.map(c=>c.id)).size,cards.length);
  const prompts = cards.filter(c=>c.prompt);
  assert.equal(new Set(prompts.map(c=>c.semanticKey)).size,prompts.length);
  assert.equal(new Set(prompts.map(c=>c.prompt)).size,prompts.length);
});
test('New cards allow skipping, hide until both submit and require explicit book selection', () => {
  for (const m of catalogs.slice(1)) for (const c of [...m.cards,...m.reserveCards]) {
    assert.equal(c.skipAllowed,true); assert.equal(c.revealPolicy,'after_both_submit');
    assert.equal(c.bookBinding.requiresExplicitSelection,true);
    assert.equal(c.fields.find(f=>f.id==='share_in_book').default,false);
    assert.ok(c.prompt.length>20 && c.hint.length>20 && c.jointAction.length>20);
  }
});
test('New bindings only select existing text fields; date recipes have home alternatives', () => {
  for (const m of catalogs.slice(1)) for (const c of [...m.cards,...m.reserveCards,...m.dates]) {
    const fields=c.fields??c.outputFields;
    assert.ok(c.bookBinding.fields.every(id=>fields.some(f=>f.id===id&&f.type==='short_text')));
    if(c.kind==='date'){assert.equal(c.steps.length,4);assert.ok(c.homeAlternative.length>30);assert.equal(c.requiresBothConsent,true);}
  }
});
test('Book fixture is explicitly fictional and has no approvals by default', () => {
  assert.equal(fixture.isFictional,true); assert.match(fixture.notice,/вымышлены/);
  assert.equal(draft().status,'draft');assert.equal(draft().exportable,false);
});
test('Book includes selected exact quotes, omits unselected setting and empty sections', () => {
  const d=draft(), serialized=JSON.stringify(d.payload);
  assert.ok(serialized.includes(fixture.sources[0].values.answer));
  assert.ok(!serialized.includes(fixture.sources[0].values.setting));
  assert.equal(d.payload.sections.length,3);
  assert.match(d.digest,/^[a-f0-9]{64}$/);
});
test('Two different current members must approve the same digest', () => {
  const f=approved();assert.equal(assembleBook(f,bindings).exportable,true);
  f.approvals.pop();assert.equal(assembleBook(f,bindings).exportable,false);
});
test('Duplicate approval by same member never replaces the second approval', () => {
  const f=approved();f.approvals=[f.approvals[0],f.approvals[0]];
  assert.equal(assembleBook(f,bindings).exportable,false);
});
test('Approval by outsider, old digest or inactive consent does not count', () => {
  for(const patch of [{memberId:'outsider'},{digest:'old'},{active:false}]) {
    const f=approved();Object.assign(f.approvals[1],patch);
    assert.equal(assembleBook(f,bindings).exportable,false);
  }
});
test('Edited selected text resets export despite fresh source selection', () => {
  const f=approved();f.sources[0].revision=2;f.sources[0].selection.revision=2;
  f.sources[0].values.answer='Иная добровольно выбранная версия.';
  const d=assembleBook(f,bindings);assert.equal(d.exportable,false);
  assert.notEqual(d.digest,approved().approvals[0].digest);
});
test('Removing material, renaming display name or changing template resets approvals', () => {
  for(const mutate of [f=>f.sources.pop(), f=>f.displayNames.anna='Аня',f=>f.templateVersion='text-book-v2']) {
    const f=approved();mutate(f);assert.equal(assembleBook(f,bindings).exportable,false);
  }
});
test('Reordered input records and member IDs produce same deterministic digest', () => {
  const f=clone(fixture);f.sources.reverse();f.memberIds.reverse();
  assert.equal(assembleBook(f,bindings).digest,draft().digest);
});
test('Hidden answer rejected before any snapshot can be exported', () => rejects(f=>f.sources[0].visibility='waiting','SOURCE_NOT_REVEALED'));
test('Foreign space cannot leak material', () => rejects(f=>f.sources[0].spaceId='another-pair','FOREIGN_SPACE'));
test('Previous or outsider partner cannot supply sources', () => rejects(f=>f.sources[0].authorIds=['former'],'FOREIGN_AUTHOR'));
test('Stale field selection requires the author to reselect', () => rejects(f=>f.sources[0].revision=2,'STALE_SELECTION'));
test('Consent withdrawal blocks a fresh assembly', () => rejects(f=>f.sources[0].selection.revoked=true,'SELECTION_REVOKED'));
test('One person cannot select the other person’s personal source', () => rejects(f=>f.sources[0].selection.selectedBy=['alexey'],'SELECTION_NOT_BY_AUTHORS'));
test('Joint agreement needs two authors and two confirmations', () => {
  rejects(f=>f.sources[2].authorIds=['anna'],'JOINT_NEEDS_TWO_AUTHORS');
  rejects(f=>f.sources[2].confirmedBy=['anna'],'JOINT_NOT_CONFIRMED');
});
test('Joint agreement needs two independent selections for book', () => rejects(f=>f.sources[2].selection.selectedBy=['anna'],'SELECTION_NOT_BY_AUTHORS'));
test('One personal answer never becomes a joint agreement implicitly', () => rejects(f=>f.sources[0].authorIds=['anna','alexey'],'JOINT_NOT_CONFIRMED'));
test('Unknown card or private/nontext fields cannot enter book', () => {
  rejects(f=>f.sources[0].cardId='made-up-card','UNKNOWN_CARD');
  rejects(f=>f.sources[0].selection.fieldIds=['share_in_book'],'FIELD_NOT_ALLOWED');
});
test('Duplicate source ID rejected to prevent double inclusion', () => rejects(f=>f.sources.push(clone(f.sources[0])),'DUPLICATE_OR_INVALID_SOURCE'));
test('Oversized selected text rejected rather than silently truncated', () => rejects(f=>f.sources[0].values.answer='x'.repeat(1201),'INVALID_FIELD_TEXT'));
test('Empty book never exportable even with two matching approvals', () => {
  const f=clone(fixture);f.sources=[];const d=assembleBook(f,bindings);
  f.approvals=f.memberIds.map(memberId=>({memberId,digest:d.digest,active:true}));
  const result=assembleBook(f,bindings);assert.equal(result.status,'empty');assert.equal(result.exportable,false);
});
test('Unselected records contribute no invented narrative', () => {
  const f=clone(fixture);for(const s of f.sources)delete s.selection;
  assert.equal(assembleBook(f,bindings).payload.sections.length,0);
});
test('90 provided days required for stage3; payment count is not accepted instead', () => {
  rejects(f=>{f.providedPaidDays=89;f.paymentCount=3;},'MILESTONE_NOT_EARNED');
});
test('First chapter at 60 days cannot use future stage3 material', () => {
  const f=clone(fixture);f.milestone=2;f.providedPaidDays=60;
  assert.throws(()=>assembleBook(f,bindings),/SOURCE_FROM_FUTURE_STAGE/);
  f.sources.pop();assert.equal(assembleBook(f,bindings).payload.milestone,2);
});
test('Editor-only prompts are omitted from story', () => {
  const f=clone(fixture);f.sources.push({...clone(f.sources[1]),id:'editorial',cardId:'m02-d27',values:{answer:'Выбрать записи'}});
  assert.equal(assembleBook(f,bindings).digest,draft().digest);
});
test('Malicious markup remains literal text for escaping by PDF renderer', () => {
  const f=clone(fixture);f.sources[0].values.answer='<script>steal()</script>';
  assert.equal(assembleBook(f,bindings).payload.sections[0].entries[0].fields[0].text,'<script>steal()</script>');
  // Assembler does not render HTML. Renderer escaping remains a server acceptance criterion.
});
test('Economics: card fee VAT applies to fee, not full price', () => close(calculate().processing,25.5773));
test('Economics: includes support, infrastructure and book reserve', () => {
  const r=calculate();close(r.bookReserve,20/3);close(r.contribution,462.8460333333333);
});
test('Economics: base yearly capped cohort, payback and replacement break-even', () => {
  const r=calculate();close(r.expectedPaidPeriods,4.65640261632);
  close(r.marginLTV,2155.1974805666678);assert.equal(r.paybackPeriod,3);assert.equal(r.breakEvenActivePairs,149);
  assert.equal(r.cohort.length,12);
});
test('Economics: no churn remains capped at 12 periods', () => {
  const r=calculate({churnPct:0});assert.equal(r.expectedPaidPeriods,12);
});
test('Economics: complete churn gets one paid period only', () => {
  const r=calculate({churnPct:100});assert.equal(r.expectedPaidPeriods,1);
  close(r.marginLTV,r.contribution);
});
test('Economics: weak cohort does not produce imaginary payback/break-even', () => {
  const r=calculate({cac:1800,churnPct:35});
  assert.ok(r.netCohort<0);assert.equal(r.paybackPeriod,null);assert.equal(r.breakEvenActivePairs,null);
});
test('Economics: free acquisition, zero fixed costs and losses handled', () => {
  assert.equal(calculate({cac:0}).ltvToCac,null);assert.equal(calculate({cac:0}).paybackPeriod,0);
  assert.equal(calculate({fixed:0}).breakEvenActivePairs,0);
  assert.equal(calculate({price:0}).breakEvenActivePairs,null);
});
test('Economics: invalid values rejected and no horizon beyond prepared year', () => {
  for(const p of [{churnPct:101},{feePct:-1},{bookEvery:0},{price:NaN},{horizon:13},{horizon:1.5}])
    assert.throws(()=>calculate(p),/INVALID/);
});
test('Offline calculator embeds the exact reviewed model and parsable script', async () => {
  const html=await text('./economics/calculator.html'), source=await text('./economics/model.mjs');
  assert.ok(html.includes(source.replace(/export /g,'')));
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length,1);new Script(scripts[0][1]);
  assert.ok(!html.includes('<script src='));
});
test('Marketing copy clearly distinguishes electronic book and actual launch state', async () => {
  const copy=await text('./SALES_PAGE_COPY.md');
  assert.match(copy,/электронная книга PDF/i);assert.match(copy,/сервис не запущен/);
  assert.match(copy,/Тест «Грани» о себе проходить необязательно/);
  assert.match(copy,/ручным продлением/);
});
test('Pilot distinguishes interview intent from real payment/renewal observations', async () => {
  const copy=await text('./PILOT_PLAN.md');
  assert.match(copy,/не доказывает платёжный спрос/);assert.match(copy,/Первые 30 дней/);
  assert.match(copy,/никому не отправлены/);
});
