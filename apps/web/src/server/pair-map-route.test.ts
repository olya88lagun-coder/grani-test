import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";
import { createRateLimiter } from "./rate-limit";

const currentUser=vi.fn();
vi.mock("./login-service",()=>({getCurrentUser:(...args:unknown[])=>currentUser(...args)}));
vi.mock("./deps",()=>({loginDeps:()=>({db:{},env:{APP_URL:"http://localhost:3000"},now:()=>new Date("2026-10-09T12:00:00Z")})}));
const request=(method="POST",origin="http://localhost:3000",body?:string)=>new NextRequest("http://localhost:3000/api/pairs/x/map",{method,headers:{origin,cookie:"grani_session=test","x-forwarded-for":"127.0.0.1"},body});
async function subject(){const m=await import("./pair-map-route").catch(()=>null);expect(m,"A protected map route must exist").not.toBeNull();return m!;}
beforeEach(()=>currentUser.mockReset());
test("rejects foreign origins before accessing a session and returns private errors",async()=>{
  const m=await subject();
  const result=await m.authorizePairMap(request("POST","https://evil.example"),{mutating:true});
  expect(result).toBeInstanceOf(Response);expect((result as Response).status).toBe(403);
  expect(currentUser).not.toHaveBeenCalled();
  expect((result as Response).headers.get("cache-control")).toContain("no-store");
});
test("requires a session, passes the actual session token and enforces a rate limit",async()=>{
  const m=await subject(); currentUser.mockResolvedValue(null);
  expect((await m.authorizePairMap(request(),{mutating:true}) as Response).status).toBe(401);
  currentUser.mockResolvedValue({id:"actual-user"});
  const limiter=createRateLimiter({limit:1,windowMs:60000});
  expect(await m.authorizePairMap(request(),{mutating:true,limiter})).toMatchObject({user:{id:"actual-user"}});
  expect(currentUser).toHaveBeenLastCalledWith(expect.anything(),"test");
  expect((await m.authorizePairMap(request(),{mutating:true,limiter}) as Response).status).toBe(429);
});
test("bounds an unannounced request stream and rejects malformed JSON",async()=>{
  const m=await subject();
  const oversized=request("POST","http://localhost:3000",JSON.stringify({text:"x".repeat(65536)}));
  const result=await m.readPairMapBody(oversized);
  expect(result).toBeInstanceOf(Response);expect((result as Response).status).toBe(413);
  expect(await m.readPairMapBody(request("POST","http://localhost:3000","{"))).toBeInstanceOf(Response);
  expect(await m.readPairMapBody(request("POST","http://localhost:3000",'{"kind":"consent"}'))).toEqual({kind:"consent"});
});
