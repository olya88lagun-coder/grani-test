import { expect, test, vi } from "vitest";
import { emptySurveyAnswers } from "@grani/core";
async function subject(){const m=await import("./pair-map-client").catch(()=>null);expect(m,"Safe shared client must exist").not.toBeNull();return m!;}
const snapshot={consentRequired:true,survey:{mine:{draft:emptySurveyAnswers(),revision:0,published:null},partner:{submitted:false,published:null}},agreements:[0,1,2].map(slot=>({slot,draft:{text:"",revision:0},proposal:null}))};
test("accepts only a valid snapshot, maps conflicts without replacing local input",async()=>{
  const m=await subject();const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({ok:true,snapshot}),{headers:{"content-type":"application/json"}}));
  expect(await m.requestPairMap("pair",undefined,fetcher)).toEqual({ok:true,snapshot});
  fetcher.mockResolvedValue(new Response('{"ok":true,"snapshot":{}}',{headers:{"content-type":"application/json"}}));
  expect(await m.requestPairMap("pair",undefined,fetcher)).toEqual({ok:false,error:"unavailable"});
  fetcher.mockResolvedValue(new Response('{"ok":false,"error":"stale_version"}',{status:409,headers:{"content-type":"application/json"}}));
  expect(await m.requestPairMap("pair",undefined,fetcher)).toEqual({ok:false,error:"stale_version"});
});
test("network/HTML failures are safe and authentication failures close shared content",async()=>{
  const m=await subject();const fetcher=vi.fn().mockRejectedValue(new Error("network"));
  expect(await m.requestPairMap("pair",undefined,fetcher)).toEqual({ok:false,error:"unavailable"});
  fetcher.mockResolvedValue(new Response("<html>private error</html>",{status:503}));
  expect(await m.requestPairMap("pair",undefined,fetcher)).toEqual({ok:false,error:"unavailable"});
  fetcher.mockResolvedValue(new Response('{"ok":false,"error":"unauthorized"}',{status:401,headers:{"content-type":"application/json"}}));
  expect(await m.requestPairMap("pair",undefined,fetcher)).toEqual({ok:false,error:"unauthorized"});
});
