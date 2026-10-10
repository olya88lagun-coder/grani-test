import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { currentUser } from "@/server/viewer";
import { isSameOrigin } from "@/server/http";
import { personalityAtlasEnabled } from "@/server/personality-atlas-feature";
import { atlasDataSchema, MAX_ATLAS_EXPECTED_REVISION, readPersonalAtlas, savePersonalAtlas, type AtlasResponse } from "@/server/personality-atlas-service";

const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
const status=(outcome:AtlasResponse)=>outcome.ok?200:({not_found:404,access_required:403,invalid:400,conflict:409}[outcome.error]);
const payloadSchema=z.strictObject({expectedRevision:z.number().int().nonnegative().max(MAX_ATLAS_EXPECTED_REVISION),data:atlasDataSchema});
const MAX_BODY_BYTES=128*1024;
type Context={params:Promise<{resultId:string}>};

export async function GET(_request:NextRequest,{params}:Context){
  if(!personalityAtlasEnabled())return reply({ok:false,error:"not_found"},404);
  const user=await currentUser();if(!user)return reply({ok:false,error:"unauthorized"},401);
  const {resultId}=await params;const outcome=await readPersonalAtlas(getDb(),{userId:user.id,resultId});
  return reply(outcome,status(outcome));
}
export async function PUT(request:NextRequest,{params}:Context){
  if(!personalityAtlasEnabled())return reply({ok:false,error:"not_found"},404);
  if(!isSameOrigin(request,getEnv().APP_URL))return reply({ok:false,error:"bad_origin"},403);
  const user=await currentUser();if(!user)return reply({ok:false,error:"unauthorized"},401);
  if(!request.headers.get("content-type")?.startsWith("application/json"))return reply({ok:false,error:"invalid"},400);
  const reader=request.body?.getReader();if(!reader)return reply({ok:false,error:"invalid"},400);
  let body="",bytes=0;const decoder=new TextDecoder();
  try{
    while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX_BODY_BYTES){await reader.cancel();return reply({ok:false,error:"too_large"},413);}body+=decoder.decode(value,{stream:true});}
    body+=decoder.decode();
  }catch{return reply({ok:false,error:"invalid"},400);}
  let value:unknown;try{value=JSON.parse(body);}catch{return reply({ok:false,error:"invalid"},400);}
  const parsed=payloadSchema.safeParse(value);if(!parsed.success)return reply({ok:false,error:"invalid"},400);
  const {resultId}=await params;const outcome=await savePersonalAtlas(getDb(),{userId:user.id,resultId,...parsed.data});
  return reply(outcome,status(outcome));
}
