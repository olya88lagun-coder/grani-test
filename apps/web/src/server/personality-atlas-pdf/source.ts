import {getResultForOwner,listOwnedProducts,listReports,loadAtlasDraft,type Database,type UserRecord} from "@grani/db";
import {typeName,unlockedKinds} from "@grani/core";
import {typeCodeToDir} from "@grani/content";
import {gemAssetDir} from "@/lib/gem-assets";
import {buildPersonalityAtlas,type PersonalityAtlas} from "@/lib/personality-atlas";
import {buildReportPageView} from "@/lib/report-view";
import {initialAtlasData,validateAtlasData} from "@/server/personality-atlas-service";
import type {GemAssetDir} from "@/lib/gem-assets";

export type AtlasMemoPdfSource={displayName:string;typeName:string;typeCode:string;gemDir:GemAssetDir;model:PersonalityAtlas;memo:{quote:string;items:string[]};revision:number;generatedAt:string};
export type AtlasPdfFailure={ok:false;error:"not_found"|"access_required"|"not_ready"|"stale_version"|"invalid"};
export async function loadAtlasMemoPdfSource(db:Database,p:{user:UserRecord;resultId:string;expectedRevision:number;generatedAt:string}):Promise<AtlasMemoPdfSource|AtlasPdfFailure>{
 const result=await getResultForOwner(db,p.resultId,p.user.id);
 if(!result)return {ok:false,error:"not_found"};
 const owned=await listOwnedProducts(db,{resultId:p.resultId});
 if(!unlockedKinds(owned).has("full"))return {ok:false,error:"access_required"};
 const view=buildReportPageView({owned,reports:await listReports(db,{resultId:p.resultId}),friendsCount:0});
 if(!view.full)return {ok:false,error:"not_ready"};
 const model=buildPersonalityAtlas(result.scores),stored=await loadAtlasDraft(db,p.resultId);
 const revision=stored?.revision??0;
 if(revision!==p.expectedRevision)return {ok:false,error:"stale_version"};
 const data=stored?validateAtlasData(stored.data):initialAtlasData(model);
 if(!data)return {ok:false,error:"invalid"};
 return {displayName:p.user.displayName,typeName:typeName(result.typeCode,p.user.gender),typeCode:result.typeCode,gemDir:gemAssetDir(typeCodeToDir(result.typeCode)),model,memo:data.memo,revision,generatedAt:p.generatedAt};
}
export function sameAtlasMemoPdfSnapshot(a:AtlasMemoPdfSource,b:AtlasMemoPdfSource):boolean{
 const content=({generatedAt:_time,...snapshot}:AtlasMemoPdfSource)=>JSON.stringify(snapshot);
 return content(a)===content(b);
}
