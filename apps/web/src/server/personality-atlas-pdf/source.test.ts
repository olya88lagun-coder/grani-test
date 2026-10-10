import {beforeEach,expect,test,vi} from "vitest";
import {getResultForOwner,listOwnedProducts,listReports,loadAtlasDraft} from "@grani/db";
import {buildReportPageView} from "@/lib/report-view";
import {buildPersonalityAtlas} from "@/lib/personality-atlas";
import {initialAtlasData} from "@/server/personality-atlas-service";
import {loadAtlasMemoPdfSource,sameAtlasMemoPdfSnapshot} from "./source";
vi.mock("@grani/db",()=>({getResultForOwner:vi.fn(),listOwnedProducts:vi.fn(),listReports:vi.fn(),loadAtlasDraft:vi.fn()}));
vi.mock("@/lib/report-view",()=>({buildReportPageView:vi.fn()}));
const scores={openness:85,conscientiousness:90,extraversion:25,agreeableness:35,stability:65};
const actor={user:{id:"owner",displayName:"София",gender:"female" as const},resultId:"result",expectedRevision:0,generatedAt:"2026-10-10T12:00:00Z"};
beforeEach(()=>{vi.clearAllMocks();vi.mocked(getResultForOwner).mockResolvedValue({scores,typeCode:"++--"} as never);vi.mocked(listOwnedProducts).mockResolvedValue(["full"]);vi.mocked(listReports).mockResolvedValue([]);vi.mocked(buildReportPageView).mockReturnValue({full:{}} as never);vi.mocked(loadAtlasDraft).mockResolvedValue(null);});
test("owner, purchase and report readiness are checked before drafts",async()=>{
 vi.mocked(getResultForOwner).mockResolvedValue(null);expect(await loadAtlasMemoPdfSource({} as never,actor)).toEqual({ok:false,error:"not_found"});
 vi.mocked(getResultForOwner).mockResolvedValue({scores,typeCode:"++--"} as never);vi.mocked(listOwnedProducts).mockResolvedValue([]);expect(await loadAtlasMemoPdfSource({} as never,actor)).toEqual({ok:false,error:"access_required"});
 vi.mocked(listOwnedProducts).mockResolvedValue(["full"]);vi.mocked(buildReportPageView).mockReturnValue({full:null} as never);expect(await loadAtlasMemoPdfSource({} as never,actor)).toEqual({ok:false,error:"not_ready"});expect(loadAtlasDraft).not.toHaveBeenCalled();
});
test("real profile and saved memo are exported; private notes are excluded",async()=>{
 const data=initialAtlasData(buildPersonalityAtlas(scores));data.memo.quote="Моя сохранённая фраза";data.notes[0]="SECRET-NOTE";
 vi.mocked(loadAtlasDraft).mockResolvedValue({revision:3,data,updatedAt:new Date()});
 expect(await loadAtlasMemoPdfSource({} as never,actor)).toEqual({ok:false,error:"stale_version"});
 const source=await loadAtlasMemoPdfSource({} as never,{...actor,expectedRevision:3});expect(source).toMatchObject({displayName:"София",revision:3,memo:{quote:"Моя сохранённая фраза"}});expect(JSON.stringify(source)).not.toContain("SECRET-NOTE");
 if("error" in source)throw Error("Expected PDF source");expect(source.model.traits.map(t=>t.value)).toEqual([85,90,25,35,65]);expect(sameAtlasMemoPdfSnapshot(source,{...source,generatedAt:"later"})).toBe(true);expect(sameAtlasMemoPdfSnapshot(source,{...source,memo:{...source.memo,quote:"Different"}})).toBe(false);
});
