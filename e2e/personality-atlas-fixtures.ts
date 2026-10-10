import {readFileSync} from "node:fs";
import {SELF_ITEMS,parseLibrary} from "../packages/content/src/index";
import {buildPersonalInput,fallbackSections} from "../packages/ai/src/index";
import {PRODUCT_PRICES,scoreItems,stabilityOf,typeCodeOf,type Answer} from "../packages/core/src/index";
import {createDb,createResult,purchases,saveReport,upsertUserFromIdentity} from "../packages/db/src/index";
import {signSession} from "../apps/web/src/server/auth/tokens";
import {LEGAL_VERSIONS} from "../apps/web/src/lib/legal";
export async function seedAtlasFixtures(){
 const url=process.env.ATLAS_QA_DATABASE_URL,secret=process.env.ATLAS_QA_SESSION_SECRET;
 if(!url||!secret||new URL(url).hostname!=="127.0.0.1"||new URL(url).port!=="5445")throw Error("Use dedicated atlas QA database on 127.0.0.1:5445 only");
 const db=createDb(url,{maxConnections:1});const library=parseLibrary(JSON.parse(readFileSync(new URL("../packages/content/src/generated/library.json",import.meta.url),"utf8")));
 const profiles=[{name:"София · условный QA-профиль",paid:true,ready:true,scores:{openness:85,conscientiousness:90,extraversion:25,agreeableness:35,stability:65}},{name:"Другой владелец · QA",paid:true,ready:true,scores:{openness:20,conscientiousness:20,extraversion:80,agreeableness:80,stability:30}},{name:"Без покупки · QA",paid:false,ready:false,scores:{openness:85,conscientiousness:90,extraversion:25,agreeableness:35,stability:65}},{name:"Разбор готовится · QA",paid:true,ready:false,scores:{openness:85,conscientiousness:90,extraversion:25,agreeableness:35,stability:65}}];
 const fixtures=[];
 try{for(const p of profiles){const seen:Record<string,number>={};const answers=Object.fromEntries(SELF_ITEMS.map(item=>{const sum=10+p.scores[item.trait]/2.5,index=seen[item.trait]??0;seen[item.trait]=index+1;const value=Math.floor(sum/10)+(index<sum%10?1:0);return[item.id,(item.reversed?6-value:value) as Answer]}));const scores=scoreItems(SELF_ITEMS,answers);
 if(JSON.stringify(scores)!==JSON.stringify(p.scores))throw Error("Unexpected fixture scores");
 const owner=await upsertUserFromIdentity(db,{provider:"vk",externalId:"dev-"+p.name,displayName:p.name,gender:"female"},{version:LEGAL_VERSIONS.consent,at:new Date()});if(!owner.ok)throw Error("Owner failed");const result=await createResult(db,{userId:owner.user.id,answers,scores,typeCode:typeCodeOf(scores),stability:stabilityOf(scores)});
 if(p.paid)await db.insert(purchases).values({userId:owner.user.id,resultId:result.id,product:"full",amountKopecks:PRODUCT_PRICES.full,status:"succeeded",paidAt:new Date()});
 if(p.ready)await saveReport(db,{target:{resultId:result.id},kind:"full",sections:fallbackSections(buildPersonalInput(library,"full",result)),source:"fallback"});
 fixtures.push({resultId:result.id,token:await signSession(owner.user.id,secret),name:p.name});}
 return fixtures;}finally{await (db as unknown as {$client:{end():Promise<void>}}).$client.end();}
}
