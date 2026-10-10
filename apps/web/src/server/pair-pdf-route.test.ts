import { expect, test, vi } from "vitest";
test("rechecks withdrawn data after rendering and never returns a stale PDF",async()=>{
  const m=await import("./pair-pdf-response").catch(()=>null);expect(m,"Protected PDF response must exist").not.toBeNull();if(!m)return;
  const render=vi.fn(async()=>Buffer.from("%PDF-PRIVATE")),check=vi.fn(async()=>({ok:false as const,error:"stale_version" as const}));
  const result=await m.respondPairPdf({load:async()=>({view:{},sharedRevisionToken:"old"} as never),render,check});
  expect(render).toHaveBeenCalledOnce();expect(check).toHaveBeenCalledOnce();expect(result.status).toBe(409);expect(await result.text()).not.toContain("PRIVATE");expect(result.headers.get("cache-control")).toContain("no-store");
});
test("access errors skip rendering, PDF headers are private, generation errors are generic",async()=>{
  const m=await import("./pair-pdf-response").catch(()=>null);expect(m).not.toBeNull();if(!m)return;
  const render=vi.fn(async()=>Buffer.from("%PDF-TEST"));
  expect((await m.respondPairPdf({load:async()=>({ok:false,error:"access_required"}),render,check:async()=>null})).status).toBe(403);expect(render).not.toHaveBeenCalled();
  const source={} as never;
  const result=await m.respondPairPdf({load:async()=>source,render,check:async()=>null});expect(result.headers.get("content-type")).toBe("application/pdf");expect(result.headers.get("content-disposition")).toContain("grani-pair-map.pdf");expect(result.headers.get("x-robots-tag")).toContain("noindex");
  const failure=await m.respondPairPdf({load:async()=>source,render:async()=>{throw Error("PRIVATE-ANSWER")},check:async()=>null});expect(failure.status).toBe(500);expect(await failure.text()).not.toContain("PRIVATE-ANSWER");
});
