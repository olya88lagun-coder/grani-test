import {beforeEach,afterEach,expect,test,vi} from "vitest";
import {NextRequest} from "next/server";
import {GET} from "./route";
import {currentUser} from "@/server/viewer";
import {loadAtlasMemoPdfSource} from "@/server/personality-atlas-pdf/source";
import {renderAtlasMemoPdf} from "@/server/personality-atlas-pdf/document";
vi.mock("@/server/viewer",()=>({currentUser:vi.fn()}));
vi.mock("@/server/db",()=>({getDb:()=>({})}));
vi.mock("@/server/personality-atlas-pdf/source",()=>({loadAtlasMemoPdfSource:vi.fn(),sameAtlasMemoPdfSnapshot:()=>true}));
vi.mock("@/server/personality-atlas-pdf/document",()=>({renderAtlasMemoPdf:vi.fn(async()=>Buffer.from("%PDF-MEMO"))}));
const context={params:Promise.resolve({resultId:"123"})};
const request=(revision="0")=>new NextRequest("http://localhost:3000/api/report/123/atlas/pdf?revision="+revision);
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("PERSONALITY_ATLAS_V2","1");vi.mocked(currentUser).mockResolvedValue({id:crypto.randomUUID(),displayName:"Владелец",gender:null});});
afterEach(()=>vi.unstubAllEnvs());
test("feature off and anonymous requests never load private data",async()=>{
 vi.stubEnv("PERSONALITY_ATLAS_V2","0");expect((await GET(request(),context)).status).toBe(404);expect(currentUser).not.toHaveBeenCalled();
 vi.stubEnv("PERSONALITY_ATLAS_V2","1");vi.mocked(currentUser).mockResolvedValue(null);expect((await GET(request(),context)).status).toBe(401);expect(loadAtlasMemoPdfSource).not.toHaveBeenCalled();
});
test("missing, malformed and excessive revision are rejected before source access",async()=>{
 for(const value of ["", "-1", "1.5", "9007199254740991", "word"]){expect((await GET(request(value),context)).status).toBe(400);}
 expect(loadAtlasMemoPdfSource).not.toHaveBeenCalled();
});
test("owner and purchase failures remain private and never render",async()=>{
 vi.mocked(loadAtlasMemoPdfSource).mockResolvedValue({ok:false,error:"not_found"});expect((await GET(request(),context)).status).toBe(404);
 vi.mocked(loadAtlasMemoPdfSource).mockResolvedValue({ok:false,error:"access_required"});const response=await GET(request(),context);expect(response.status).toBe(403);expect(response.headers.get("cache-control")).toContain("no-store");expect(renderAtlasMemoPdf).not.toHaveBeenCalled();
});
test("successful export rechecks access and revision after render; quota is per owner",async()=>{
 vi.mocked(loadAtlasMemoPdfSource).mockResolvedValue({revision:0} as never);
 expect((await GET(request(),context)).status).toBe(200);expect(loadAtlasMemoPdfSource).toHaveBeenCalledTimes(2);
 expect((await GET(request(),context)).status).toBe(200);expect((await GET(request(),context)).status).toBe(200);
 expect((await GET(request(),context)).status).toBe(429);expect(renderAtlasMemoPdf).toHaveBeenCalledTimes(3);
});
test("data withdrawn during generation returns access error rather than PDF",async()=>{
 vi.mocked(loadAtlasMemoPdfSource).mockResolvedValueOnce({revision:0} as never).mockResolvedValueOnce({ok:false,error:"not_found"});
 const response=await GET(request(),context);expect(response.status).toBe(404);expect(await response.text()).not.toContain("%PDF");
});
