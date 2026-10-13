import { beforeEach, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { parseChapterCards } from "@grani/ai";
import { sampleOverview, sampleSituation } from "@grani/ai/testing";
import { chapterSeeds, lifeSeeds } from "@grani/content";
import { initialAtlasData } from "@/server/personality-atlas-service";
import { buildPersonalityAtlas } from "@/lib/personality-atlas";
const mocks=vi.hoisted(()=>({result:vi.fn(),products:vi.fn(),load:vi.fn(),user:vi.fn(),view:vi.fn(),enqueue:vi.fn(),notFound:vi.fn(()=>{throw Error("404")}),redirect:vi.fn(()=>{throw Error("redirect")})}));
vi.mock("@grani/db",()=>({getResultForOwner:mocks.result,listOwnedProducts:mocks.products,loadAtlasDraft:mocks.load,getInviteForResult:vi.fn(async()=>null),listReports:vi.fn(async()=>[]),countFriendResponses:vi.fn()}));
vi.mock("@/server/db",()=>({getDb:()=>({})}));
vi.mock("@/server/viewer",()=>({requireUser:mocks.user}));
vi.mock("@/server/queue",()=>({enqueueGenerate:mocks.enqueue}));
vi.mock("@/lib/report-view",()=>({buildReportPageView:mocks.view,REPORT_DISCLAIMER:"Disclaimer"}));
vi.mock("next/navigation",()=>({notFound:mocks.notFound,redirect:mocks.redirect}));
vi.mock("@/components/GemPortrait",()=>({GemPortrait:()=>null}));
vi.mock("@/components/BuyButton",()=>({BuyButton:()=>null}));
vi.mock("@/app/result/[id]/ShareCard",()=>({ShareCard:()=>null}));
vi.mock("@/components/AutoRefresh",()=>({AutoRefresh:()=>null}));
import ReportPage from "./page";
const full={portrait:"Existing portrait",strengths:["Existing strength"],blind_spots:[],manual:{work:[],fight:[],annoys:[]}};
beforeEach(()=>{vi.clearAllMocks();delete process.env.PERSONALITY_ATLAS_V2;delete process.env.LIFE_CARDS_V1;mocks.user.mockResolvedValue({id:"owner",displayName:"Анна",gender:"female"});mocks.result.mockResolvedValue({id:"r",typeCode:"++--",scores:{openness:85,conscientiousness:90,extraversion:25,agreeableness:35,stability:65}});mocks.products.mockResolvedValue(["full"]);mocks.load.mockResolvedValue(null);mocks.view.mockReturnValue({full,life:null,preparing:false,friends:{state:"waiting",counter:"0 из 3"},chapters:[],bundle:null});});
const render=async()=>renderToStaticMarkup(await ReportPage({params:Promise.resolve({resultId:"r"})}));
test("flag off preserves original report without reading the draft table",async()=>{const html=await render();expect(html).toContain("Existing portrait");expect(html).not.toContain("Мои грани");expect(mocks.load).not.toHaveBeenCalled();});
test("flag on mounts personal edition with real scores and preserves original report",async()=>{process.env.PERSONALITY_ATLAS_V2="1";const html=await render();expect(html).toContain("data-personal-edition");expect(html).toContain("Анна");expect(html).toContain("Existing portrait");expect(html).toContain("85</strong>");expect(html.match(/<h1/g)).toHaveLength(1);expect(mocks.load).toHaveBeenCalledWith({},"r");});
test("pending report still uses original preparing state",async()=>{process.env.PERSONALITY_ATLAS_V2="1";mocks.view.mockReturnValue({full:null,preparing:true,friends:{state:"waiting",counter:"0 из 3"},chapters:[],bundle:null});expect(await render()).toContain("Готовим");expect(mocks.load).not.toHaveBeenCalled();});
test("foreign result and unpaid result cannot load private drafts",async()=>{process.env.PERSONALITY_ATLAS_V2="1";mocks.result.mockResolvedValueOnce(null);await expect(render()).rejects.toThrow("404");mocks.products.mockResolvedValueOnce([]);await expect(render()).rejects.toThrow("redirect");expect(mocks.load).not.toHaveBeenCalled();});
const moneyView=(sections:unknown)=>({full,preparing:false,friends:{state:"waiting",counter:"0 из 3"},bundle:null,chapters:[{kind:"chapter_money",title:"Деньги",state:"ready",sections}]});
test("flag off: an old text chapter is shown as before",async()=>{mocks.view.mockReturnValue(moneyView({text:"Старый абзац главы про деньги, который уже оплатили.",tips:["Старый совет номер один","Старый совет номер два","Старый совет номер три"]}));const html=await render();expect(html).toContain("Старый абзац главы про деньги");expect(html).toContain("Старый совет номер два");});
test("flag off: a cards chapter is shown as cards",async()=>{const cards=parseChapterCards({version:2,...sampleOverview(),situations:chapterSeeds("chapter_money").map(sampleSituation)});mocks.view.mockReturnValue(moneyView(cards));const html=await render();expect(html).toContain("Ты щедрее к людям, чем к себе");expect(html.match(/Узнаёшь себя\?/g)).toHaveLength(6);});

test("an existing buyer without cards gets the job queued once when the flag is on",async()=>{process.env.PERSONALITY_ATLAS_V2="1";process.env.LIFE_CARDS_V1="1";await render();expect(mocks.enqueue).toHaveBeenCalledTimes(1);expect(mocks.enqueue).toHaveBeenCalledWith({kind:"life",resultId:"r"});});
test("nothing is queued with the flag off, with ready cards, on the old page or for an unpaid result",async()=>{
  process.env.PERSONALITY_ATLAS_V2="1";await render();
  process.env.LIFE_CARDS_V1="1";const cards={version:1,situations:lifeSeeds().map(sampleSituation)};
  mocks.view.mockReturnValue({full,preparing:false,friends:{state:"waiting",counter:"0 из 3"},chapters:[],bundle:null,life:cards});await render();
  delete process.env.PERSONALITY_ATLAS_V2;mocks.view.mockReturnValue({full,preparing:false,friends:{state:"waiting",counter:"0 из 3"},chapters:[],bundle:null,life:null});await render();
  process.env.PERSONALITY_ATLAS_V2="1";mocks.products.mockResolvedValueOnce([]);await expect(render()).rejects.toThrow("redirect");
  expect(mocks.enqueue).not.toHaveBeenCalled();
});

test("the epigraph comes from the first life card, and a saved memo keeps its own text",async()=>{
  process.env.PERSONALITY_ATLAS_V2="1";
  const cards={version:1,situations:lifeSeeds().map(sampleSituation)};
  mocks.view.mockReturnValue({full,preparing:false,friends:{state:"waiting",counter:"0 из 3"},chapters:[],bundle:null,life:cards});
  expect(await render()).toMatch(/<span>Личный ориентир<\/span><p>Мне нужно время подумать, отвечу завтра\./);

  const saved=initialAtlasData(buildPersonalityAtlas({openness:85,conscientiousness:90,extraversion:25,agreeableness:35,stability:65}));saved.memo.quote="Моя сохранённая фраза";
  mocks.load.mockResolvedValue({revision:4,data:saved,updatedAt:new Date()});
  const html=await render();
  expect(html).toMatch(/<span>Личный ориентир<\/span><p>Моя сохранённая фраза/);
  expect(html).not.toMatch(/<span>Личный ориентир<\/span><p>Мне нужно время/);
});
