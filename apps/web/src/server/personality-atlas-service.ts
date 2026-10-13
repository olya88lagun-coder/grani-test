import { getReport, getResultForOwner, listOwnedProducts, loadAtlasDraft, writeAtlasDraft, type AtlasDraftData, type AtlasDraftRecord, type Database } from "@grani/db";
import type { LifeSections } from "@grani/ai";
import { unlockedKinds } from "@grani/core";
import { atlasDataSchema, MAX_ATLAS_EXPECTED_REVISION } from "@/lib/personality-atlas-draft";
export { atlasDataSchema, MAX_ATLAS_EXPECTED_REVISION } from "@/lib/personality-atlas-draft";
import { parseLifeReport } from "@/lib/life-report";
import { buildPersonalityAtlas, type PersonalityAtlas } from "@/lib/personality-atlas";

export function validateAtlasData(value:unknown):AtlasDraftData|null {const parsed=atlasDataSchema.safeParse(value);return parsed.success?parsed.data:null;}
// Пункт памятки «Что хочу попробовать» — пятый
const MEMO_TRY_ITEM=4;
// Карточки «В жизни» дают эпиграф и «Что хочу попробовать» только памятке, которой ещё нет в базе: сохранённую читаем как есть
export function initialAtlasData(model:PersonalityAtlas,life:LifeSections|null=null):AtlasDraftData{
  const first=life?.situations[0],items=model.memo.items.map(i=>i.text);
  if(first)items[MEMO_TRY_ITEM]=first.do;
  return {done:Array(7).fill(false),notes:Array(7).fill(""),decision:"",interaction:[...model.interaction],memo:{quote:first?first.say[0]!:model.memo.quote,items}};
}
export type AtlasResponse={ok:true;draft:AtlasDraftRecord}|{ok:false;error:"not_found"|"access_required"|"invalid"|"conflict"};
async function access(db:Database,p:{userId:string;resultId:string}){
  const result=await getResultForOwner(db,p.resultId,p.userId);
  if(!result)return {ok:false,error:"not_found"} as const;
  const products=await listOwnedProducts(db,{resultId:p.resultId});
  return unlockedKinds(products).has("full")?{ok:true,result} as const:{ok:false,error:"access_required"} as const;
}
export async function readPersonalAtlas(db:Database,p:{userId:string;resultId:string}):Promise<AtlasResponse>{
  const allowed=await access(db,p);if(!allowed.ok)return allowed;
  const stored=await loadAtlasDraft(db,p.resultId);
  if(stored)return {ok:true,draft:stored};
  const life=parseLifeReport(await getReport(db,{resultId:p.resultId},"life"));
  return {ok:true,draft:{revision:0,updatedAt:null,data:initialAtlasData(buildPersonalityAtlas(allowed.result.scores),life)}};
}
export async function savePersonalAtlas(db:Database,p:{userId:string;resultId:string;expectedRevision:number;data:unknown}):Promise<AtlasResponse>{
  const allowed=await access(db,p);if(!allowed.ok)return allowed;
  const data=validateAtlasData(p.data);
  if(!data||!Number.isSafeInteger(p.expectedRevision)||p.expectedRevision<0||p.expectedRevision>MAX_ATLAS_EXPECTED_REVISION)return {ok:false,error:"invalid"};
  const draft=await writeAtlasDraft(db,{resultId:p.resultId,expectedRevision:p.expectedRevision,data});
  return draft?{ok:true,draft}:{ok:false,error:"conflict"};
}
