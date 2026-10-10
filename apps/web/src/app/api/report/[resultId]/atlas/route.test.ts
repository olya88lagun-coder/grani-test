import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, PUT } from "./route";
import { currentUser } from "@/server/viewer";
import { readPersonalAtlas, savePersonalAtlas, initialAtlasData } from "@/server/personality-atlas-service";
import { buildPersonalityAtlas } from "@/lib/personality-atlas";

vi.mock("@/server/viewer",()=>({currentUser:vi.fn()}));
vi.mock("@/server/db",()=>({getDb:vi.fn(()=>({}))}));
vi.mock("@/server/env",()=>({getEnv:()=>({APP_URL:"http://localhost:3000"})}));
vi.mock("@/server/personality-atlas-service",async importOriginal=>({...await importOriginal<typeof import("@/server/personality-atlas-service")>(),readPersonalAtlas:vi.fn(),savePersonalAtlas:vi.fn()}));
const context={params:Promise.resolve({resultId:"123"})};
const data=initialAtlasData(buildPersonalityAtlas({openness:85,conscientiousness:90,extraversion:25,agreeableness:35,stability:65}));
const request=(body:unknown,origin="http://localhost:3000")=>new NextRequest("http://localhost:3000/api/report/123/atlas",{method:"PUT",headers:{origin,"content-type":"application/json"},body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("PERSONALITY_ATLAS_V2","1");vi.mocked(currentUser).mockResolvedValue({id:"owner",displayName:"Имя",gender:null});});
afterEach(()=>vi.unstubAllEnvs());
describe("atlas API boundaries",()=>{
  test("disabled switch returns 404 before session or database work",async()=>{
    vi.stubEnv("PERSONALITY_ATLAS_V2","0");
    expect((await GET(new NextRequest("http://localhost:3000"),context)).status).toBe(404);
    expect((await PUT(request({}),context)).status).toBe(404);
    expect(currentUser).not.toHaveBeenCalled();expect(readPersonalAtlas).not.toHaveBeenCalled();expect(savePersonalAtlas).not.toHaveBeenCalled();
  });
  test("anonymous read and write are denied and never call storage",async()=>{
    vi.mocked(currentUser).mockResolvedValue(null);
    expect((await GET(new NextRequest("http://localhost:3000"),context)).status).toBe(401);
    expect((await PUT(request({expectedRevision:0,data}),context)).status).toBe(401);
    expect(savePersonalAtlas).not.toHaveBeenCalled();
  });
  test("foreign origin and oversized streamed body are rejected",async()=>{
    expect((await PUT(request({expectedRevision:0,data},"https://foreign.example"),context)).status).toBe(403);
    expect((await PUT(request({filler:"x".repeat(131073)}),context)).status).toBe(413);
    expect(savePersonalAtlas).not.toHaveBeenCalled();
  });
  test("invalid JSON, unknown fields and malformed notes do not write",async()=>{
    expect((await PUT(new NextRequest("http://localhost:3000",{method:"PUT",headers:{origin:"http://localhost:3000","content-type":"application/json"},body:"{"}),context)).status).toBe(400);
    expect((await PUT(request({expectedRevision:0,data,public:true}),context)).status).toBe(400);
    expect((await PUT(request({expectedRevision:0,data:{...data,notes:[]}}),context)).status).toBe(400);
    expect(savePersonalAtlas).not.toHaveBeenCalled();
  });
  test("owner id comes from the session; conflicts are private and not successful",async()=>{
    vi.mocked(savePersonalAtlas).mockResolvedValue({ok:false,error:"conflict"});
    const response=await PUT(request({expectedRevision:2,data}),context);
    expect(response.status).toBe(409);expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(savePersonalAtlas).toHaveBeenCalledWith({},expect.objectContaining({userId:"owner",resultId:"123",expectedRevision:2}));
  });
  test("a private read preserves the service's owner and paid-access result",async()=>{
    vi.mocked(readPersonalAtlas).mockResolvedValue({ok:false,error:"access_required"});
    const response=await GET(new NextRequest("http://localhost:3000"),context);
    expect(response.status).toBe(403);expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
