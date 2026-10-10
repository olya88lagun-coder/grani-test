import {expect,test,vi} from "vitest";
import {respondAtlasMemoPdf} from "./response";

test("access and revision failures skip rendering; late changes never return old private bytes",async()=>{
 const render=vi.fn(async()=>Buffer.from("%PDF-PRIVATE-MEMO"));
 const denied=await respondAtlasMemoPdf({load:async()=>({ok:false,error:"access_required"}),render,check:async()=>null});
 expect(denied.status).toBe(403);expect(render).not.toHaveBeenCalled();
 const stale=await respondAtlasMemoPdf({load:async()=>({} as never),render,check:async()=>({ok:false,error:"stale_version"})});
 expect(stale.status).toBe(409);expect(await stale.text()).not.toContain("PRIVATE-MEMO");
});
test("PDF attachment and every error are private; generation failures do not leak text",async()=>{
 const response=await respondAtlasMemoPdf({load:async()=>({} as never),render:async()=>Buffer.from("%PDF-MEMO"),check:async()=>null});
 expect(response.headers.get("content-type")).toBe("application/pdf");expect(response.headers.get("content-disposition")).toContain("grani-personal-memo.pdf");
 expect(response.headers.get("cache-control")).toBe("private, no-store");expect(response.headers.get("x-robots-tag")).toContain("noindex");expect(response.headers.get("x-content-type-options")).toBe("nosniff");
 const fail=await respondAtlasMemoPdf({load:async()=>({} as never),render:async()=>{throw Error("SECRET-MEMO")},check:async()=>null});
 expect(fail.status).toBe(500);expect(await fail.text()).not.toContain("SECRET-MEMO");expect(fail.headers.get("cache-control")).toContain("no-store");
});
