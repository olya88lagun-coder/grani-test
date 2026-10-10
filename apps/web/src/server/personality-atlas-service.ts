import { getResultForOwner, listOwnedProducts, loadAtlasDraft, writeAtlasDraft, type AtlasDraftData, type AtlasDraftRecord, type Database } from "@grani/db";
import { unlockedKinds } from "@grani/core";
import { atlasDataSchema, MAX_ATLAS_EXPECTED_REVISION } from "@/lib/personality-atlas-draft";
export { atlasDataSchema, MAX_ATLAS_EXPECTED_REVISION } from "@/lib/personality-atlas-draft";
import { buildPersonalityAtlas, type PersonalityAtlas } from "@/lib/personality-atlas";

export function validateAtlasData(value:unknown):AtlasDraftData|null {const parsed=atlasDataSchema.safeParse(value);return parsed.success?parsed.data:null;}
export function initialAtlasData(model:PersonalityAtlas):AtlasDraftData{return {done:Array(7).fill(false),notes:Array(7).fill(""),decision:"",interaction:[...model.interaction],memo:{quote:model.memo.quote,items:model.memo.items.map(i=>i.text)}};}
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
  return {ok:true,draft:stored??{revision:0,updatedAt:null,data:initialAtlasData(buildPersonalityAtlas(allowed.result.scores))}};
}
export async function savePersonalAtlas(db:Database,p:{userId:string;resultId:string;expectedRevision:number;data:unknown}):Promise<AtlasResponse>{
  const allowed=await access(db,p);if(!allowed.ok)return allowed;
  const data=validateAtlasData(p.data);
  if(!data||!Number.isSafeInteger(p.expectedRevision)||p.expectedRevision<0||p.expectedRevision>MAX_ATLAS_EXPECTED_REVISION)return {ok:false,error:"invalid"};
  const draft=await writeAtlasDraft(db,{resultId:p.resultId,expectedRevision:p.expectedRevision,data});
  return draft?{ok:true,draft}:{ok:false,error:"conflict"};
}
