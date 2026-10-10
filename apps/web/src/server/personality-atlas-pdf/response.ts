import {NextResponse} from "next/server";
import type {AtlasMemoPdfSource,AtlasPdfFailure} from "./source";
export const ATLAS_PDF_HEADERS={"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow","X-Content-Type-Options":"nosniff"};
export const atlasPdfFailure=(error:string,status:number)=>NextResponse.json({ok:false,error},{status,headers:ATLAS_PDF_HEADERS});
const fail=(result:AtlasPdfFailure)=>atlasPdfFailure(result.error,({not_found:404,access_required:403,not_ready:409,stale_version:409,invalid:400})[result.error]);
export async function respondAtlasMemoPdf(deps:{load:()=>Promise<AtlasMemoPdfSource|AtlasPdfFailure>;render:(source:AtlasMemoPdfSource)=>Promise<Buffer>;check:(source:AtlasMemoPdfSource)=>Promise<AtlasPdfFailure|null>}):Promise<NextResponse>{
 try{
  const source=await deps.load();if("error" in source)return fail(source);
  const bytes=await deps.render(source);
  const stale=await deps.check(source);if(stale)return fail(stale);
  return new NextResponse(new Uint8Array(bytes),{headers:{...ATLAS_PDF_HEADERS,"Content-Type":"application/pdf","Content-Disposition":'attachment; filename="grani-personal-memo.pdf"',"Content-Length":String(bytes.byteLength)}});
 }catch{console.error("Atlas memo PDF generation failed");return atlasPdfFailure("pdf_failed",500);}
}
