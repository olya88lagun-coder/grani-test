import {type NextRequest} from "next/server";
import {getDb} from "@/server/db";
import {currentUser} from "@/server/viewer";
import {createRateLimiter} from "@/server/rate-limit";
import {personalityAtlasEnabled} from "@/server/personality-atlas-feature";
import {MAX_ATLAS_EXPECTED_REVISION} from "@/lib/personality-atlas-draft";
import {loadAtlasMemoPdfSource,sameAtlasMemoPdfSnapshot} from "@/server/personality-atlas-pdf/source";
import {renderAtlasMemoPdf} from "@/server/personality-atlas-pdf/document";
import {atlasPdfFailure,respondAtlasMemoPdf} from "@/server/personality-atlas-pdf/response";
export const runtime="nodejs";
const limiter=createRateLimiter({limit:3,windowMs:60_000});
export async function GET(request:NextRequest,{params}:{params:Promise<{resultId:string}>}){
 if(!personalityAtlasEnabled())return atlasPdfFailure("not_found",404);
 try{
  const user=await currentUser();if(!user)return atlasPdfFailure("unauthorized",401);
  const value=request.nextUrl.searchParams.get("revision");
  if(value===null||!/^\d{1,10}$/.test(value)||Number(value)>MAX_ATLAS_EXPECTED_REVISION)return atlasPdfFailure("invalid",400);
  if(!limiter.allow(user.id))return atlasPdfFailure("rate_limited",429);
  const {resultId}=await params,db=getDb(),expectedRevision=Number(value),generatedAt=new Date().toISOString();
  return respondAtlasMemoPdf({load:()=>loadAtlasMemoPdfSource(db,{user,resultId,expectedRevision,generatedAt}),
   render:renderAtlasMemoPdf,
   check:async source=>{
    const viewer=await currentUser();if(!viewer||viewer.id!==user.id)return {ok:false,error:"not_found"};
    const latest=await loadAtlasMemoPdfSource(db,{user:viewer,resultId,expectedRevision,generatedAt});
    if("error" in latest)return latest;
    return sameAtlasMemoPdfSnapshot(source,latest)?null:{ok:false,error:"stale_version"};
   }});
 }catch{return atlasPdfFailure("unavailable",503);}
}
