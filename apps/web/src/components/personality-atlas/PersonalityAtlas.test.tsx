import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { buildPersonalityAtlas } from "@/lib/personality-atlas";
import { initialAtlasData } from "@/server/personality-atlas-service";
import { PersonalityAtlas } from "./PersonalityAtlas";

const model=buildPersonalityAtlas({openness:85,conscientiousness:90,extraversion:25,agreeableness:35,stability:65});
const props={resultId:"result",displayName:"София",typeName:"Архитектор",typeCode:"++--",gemDir:"ppmm" as const,model,initialDraft:{revision:0,updatedAt:null,data:initialAtlasData(model)}};
describe("atlas SSR",()=>{
  test("nine real HTML sections and actual scores exist before hydration",()=>{
    const html=renderToStaticMarkup(<PersonalityAtlas {...props}/>);
    expect(html.match(/id="atlas-section-[1-9]"/g)).toHaveLength(9);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain("София");expect(html).toContain("Самостоятельное погружение");expect(html).toContain("Ясные критерии");
    expect(html).toContain("Редактировать");expect(html).not.toContain("Демо Софии");
  });
  test("saved private text is escaped, while completed practices restore",()=>{
    const data=initialAtlasData(model);data.done[0]=true;data.interaction[0]="<script>private</script>";
    const html=renderToStaticMarkup(<PersonalityAtlas {...props} initialDraft={{revision:3,updatedAt:"2026-10-10T10:00:00Z",data}}/>);
    expect(html).toContain("&lt;script&gt;private&lt;/script&gt;");expect(html).not.toContain("<script>private</script>");expect(html).toContain("14%");
  });
});

test("all 16 types across three stability bands render nine semantic sections",async()=>{
 const {typeCodeOf,typeName}=await import("@grani/core");const {typeCodeToDir}=await import("@grani/content");const {gemAssetDir}=await import("@/lib/gem-assets");
 for(let bits=0;bits<16;bits++)for(const stability of [25,50,85]){
  const values=[0,1,2,3].map(i=>(bits&(1<<i))?85:25);const input={openness:values[0]!,conscientiousness:values[1]!,extraversion:values[2]!,agreeableness:values[3]!,stability};const profile=buildPersonalityAtlas(input),typeCode=typeCodeOf(input);
  const html=renderToStaticMarkup(<PersonalityAtlas resultId={"qa-"+bits+"-"+stability} displayName="Условный профиль" typeCode={typeCode} typeName={typeName(typeCode,null)} gemDir={gemAssetDir(typeCodeToDir(typeCode))} model={profile} initialDraft={{revision:0,updatedAt:null,data:initialAtlasData(profile)}}/>);
  expect(html.match(/id="atlas-section-[1-9]"/g)).toHaveLength(9);expect(html.match(/<h1\b/g)).toHaveLength(1);expect(html).not.toMatch(/undefined|NaN/);expect(html).toContain("предложенный черновик");expect(html).toContain("Скачать памятку в PDF");
 }
});
