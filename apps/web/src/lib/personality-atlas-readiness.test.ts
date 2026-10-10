import {expect,test} from "vitest";
import {mkdirSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {ATLAS_INTERACTION_STARTERS,ATLAS_MEMO_EXPERIMENTS} from "./personality-atlas-profile-copy";
import {ATLAS_TRAITS,ATLAS_BASE_RULES,ATLAS_PAIR_RULES,buildPersonalityAtlas,editorialWeight} from "./personality-atlas";
import {typeCodeOf,traitLevel,type TraitScores} from "@grani/core";
const scores=(o=85,c=90,e=25,a=35,s=65):TraitScores=>({openness:o,conscientiousness:c,extraversion:e,agreeableness:a,stability:s});
test("a grouped insight uses the strongest matching rule text and keeps all positive evidence",()=>{
 const focus=buildPersonalityAtlas(scores(85,56,25,55,65)).strengths.find(i=>i.group==="focus")!;
 expect(focus.id).toBe("R08");expect(focus.explanation).toBe(ATLAS_PAIR_RULES.find(r=>r.id==="R08")!.explanation);expect(focus.ruleIds).toEqual(expect.arrayContaining(["R04","R08"]));expect(focus.weight).toBe(1);
 const collaboration=buildPersonalityAtlas(scores(25,50,56,85,50)).strengths.find(i=>i.group==="collaboration")!;
 expect(collaboration.id).toBe("R12");expect(collaboration.explanation).toBe(ATLAS_PAIR_RULES.find(r=>r.id==="R12")!.explanation);
});
test("defaults intended for voluntary sharing use first-person wording rather than a command",()=>{
 const profile=buildPersonalityAtlas(scores(85,25,85,25,50));
 expect(profile.interaction[0]).not.toMatch(/подход: (выбери|сравни|попробуй|запиши|уточни|назови|отдели|оставь|сформулируй|раздели|после)/i);
 expect(profile.interaction[0]).toMatch(/^(Мне|Для меня)/);
});
test("high emotional stability is not equated with disregard for other people",()=>{
 const rule=ATLAS_BASE_RULES.find(r=>r.trait==="stability"&&r.level==="high")!;
 expect(rule.risk).not.toMatch(/значимость.*другого человека|чужие чувства|эмпати/i);
});
test("all 16 four-scale types across three stability bands keep complete, non-diagnostic content",()=>{
 const types=new Set<string>(),seenRules=new Set<string>(),review:unknown[]=[];
 for(let bits=0;bits<16;bits++)for(const s of [25,50,85]){
  const values=[0,1,2,3].map(i=>(bits&(1<<i))?85:25),input=scores(...values as [number,number,number,number],s),model=buildPersonalityAtlas(input);types.add(typeCodeOf(input));review.push({type:typeCodeOf(input),scores:input,theme:model.theme,formula:model.formulaText,strengths:model.strengths,interaction:model.interaction,memo:model.memo});
  expect(model.scores).toEqual(input);expect(model.strengths).toHaveLength(3);expect(new Set(model.strengths.map(i=>i.group)).size).toBe(3);expect(model.interaction).toHaveLength(3);expect(model.memo.items).toHaveLength(5);
  for(const insight of model.strengths){insight.ruleIds.forEach(id=>seenRules.add(id));for(const field of [insight.explanation,insight.application,insight.risk,insight.practice,insight.limit])expect(field.length).toBeGreaterThan(10);expect(insight.limit).toContain("гипотеза");}
  expect(JSON.stringify(model)).not.toMatch(/у тебя (депрессия|расстройство)|гарантирует успех|точно будешь|процентиль/i);
 }
 if(process.env.ATLAS_READINESS_OUTPUT){mkdirSync(process.env.ATLAS_READINESS_OUTPUT,{recursive:true});writeFileSync(resolve(process.env.ATLAS_READINESS_OUTPUT,"profiles-reviewed.json"),JSON.stringify(review,null,2));}
 expect(types.size).toBe(16);expect([...seenRules].filter(id=>/^R/.test(id)).sort()).toEqual(ATLAS_PAIR_RULES.map(r=>r.id));
});
test("all 16807 boundary combinations preserve categories, positive signals and three unique resources",()=>{
 const boundaries=[0,44,45,50,55,56,100];let checked=0;
 for(const o of boundaries)for(const c of boundaries)for(const e of boundaries)for(const a of boundaries)for(const s of boundaries){
  const input=scores(o,c,e,a,s),model=buildPersonalityAtlas(input);checked++;
  if(model.strengths.length!==3||new Set(model.strengths.map(i=>i.group)).size!==3)throw Error("Incomplete profile "+JSON.stringify(input));
  for(const trait of model.traits)if(trait.level!==traitLevel(input[trait.key])||trait.value!==input[trait.key])throw Error("Changed score/category");
  for(const insight of model.strengths){
   const candidates=ATLAS_PAIR_RULES.filter(rule=>insight.ruleIds.includes(rule.id)).map(rule=>({...rule,weight:Math.min(...rule.signals.map(([key,level])=>editorialWeight(level,input[key])))})).sort((a,b)=>b.weight-a.weight);
   if(candidates.length&&candidates[0]!.id!==insight.id)throw Error("Weaker group copy "+JSON.stringify(input));
  }
  for(const insight of model.strengths)for(const id of insight.ruleIds){const pair=ATLAS_PAIR_RULES.find(r=>r.id===id);if(pair&&pair.signals.some(([key,level])=>editorialWeight(level,input[key])<=0))throw Error("Inactive pair selected "+id);}
 }
 expect(checked).toBe(16807);
});

test("each base and pair rule has a suggested first-person card draft",()=>{
 for(const rule of [...ATLAS_BASE_RULES,...ATLAS_PAIR_RULES]){expect(ATLAS_INTERACTION_STARTERS[rule.id]).toMatch(/^(Мне|Для меня)/);expect(ATLAS_MEMO_EXPERIMENTS[rule.id]!.length).toBeGreaterThan(10);}
});

test("the personal memo experiment uses an infinitive instead of addressing its owner as a command",()=>{
 const model=buildPersonalityAtlas(scores(85,25,85,25,50));expect(model.memo.items[4]!.text).not.toMatch(/^(Выбери|Проверь|Запиши|Сравни|Определи|Попробуй|Назови|Отдели|Раздели|Оставь|Сформулируй)(?:\s|[,.]|$)/i);
});
