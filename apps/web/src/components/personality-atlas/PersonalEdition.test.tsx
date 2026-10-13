import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CHAPTER_KINDS, formatRub, PRODUCT_PRICES, typeCodeOf, typeName } from "@grani/core";
import type { ReportPageView } from "@/lib/report-view";
import { buildPersonalityAtlas } from "@/lib/personality-atlas";
import { initialAtlasData } from "@/server/personality-atlas-service";
import { editionViewForHash, PersonalEdition } from "./PersonalEdition";

const model=buildPersonalityAtlas({openness:78,conscientiousness:48,extraversion:50,agreeableness:78,stability:88});
const full={portrait:"Настоящий сохранённый портрет владельца отчёта.",strengths:["Первая личная опора","Вторая личная опора"],blind_spots:[{text:"Наблюдение из оплаченного отчёта",tip:"Совет из сохранённого отчёта"}],manual:{work:["Моя работа"],fight:["Мой разговор"],annoys:["Мои предпочтения"]}};
const baseView:ReportPageView={full,life:null,friends:{state:"waiting",counter:"0 из 3"},chapters:CHAPTER_KINDS.map(kind=>({kind,title:kind,state:"available",price:formatRub(PRODUCT_PRICES[kind])})),bundle:{price:formatRub(PRODUCT_PRICES.chapters_all)},preparing:false};
const props={resultId:"owned-result",displayName:"Реальный владелец",typeName:"Искра",model,initialDraft:{revision:0,updatedAt:null,data:initialAtlasData(model)},view:baseView,moneyPracticeAvailable:false};

describe("personal edition contracts",()=>{
  test("shows stored paid content and all real scores without publishing the demo persona",()=>{
    const html=renderToStaticMarkup(<PersonalEdition {...props}/>);
    expect(html).toContain(full.portrait);expect(html).toContain(full.manual.work[0]);expect(html).toContain(full.blind_spots[0]!.tip);
    expect(html).toContain("Реальный владелец");expect(html).not.toContain("Анна");expect(html).not.toContain("Демо");
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html.match(/id="atlas-section-[1-9]"/g)).toHaveLength(9);
    for(const value of [78,48,50,88])expect(html).toContain(`>${value}</strong>`);
    expect(html).toContain("Пять граней");expect(html).toContain("4 сферы");expect(html).toContain("Взгляд друзей");
  });
  test("uses existing chapter keys and exact prices",()=>{
    const html=renderToStaticMarkup(<PersonalEdition {...props}/>);
    expect(html).toContain("249");expect(html).toContain("99");
    for(const kind of CHAPTER_KINDS)expect(html).toContain(`edition-chapter-${kind.replace("chapter_","")}`);
    expect(html).toContain("Открыть комплект за");
  });
  test("already owned chapters are not offered for purchase; preparing stays visible",()=>{
    const view:ReportPageView={...baseView,bundle:null,chapters:CHAPTER_KINDS.map(kind=>({kind,title:kind,state:"preparing"})),preparing:true};
    const html=renderToStaticMarkup(<PersonalEdition {...props} view={view} moneyPracticeAvailable/>);
    expect(html).not.toContain("Открыть комплект за");expect(html).not.toContain("Открыть за 99");
    expect(html).toContain("Глава готовится");expect(html.match(/Открыть главу/g)).toHaveLength(4);
  });
  test("private saved text remains escaped and draft practices remain present",()=>{
    const data=initialAtlasData(model);data.memo.quote="<script>private quote</script>";data.interaction[0]="<img src=x onerror=alert(1)>";data.done[0]=true;data.notes[0]="Сохранённая заметка";
    const html=renderToStaticMarkup(<PersonalEdition {...props} initialDraft={{revision:7,updatedAt:null,data}}/>);
    expect(html).toContain("&lt;script&gt;private quote&lt;/script&gt;");expect(html).not.toContain("<script>private quote</script>");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");expect(html).toContain("Сохранённая заметка");expect(html).toContain("14%");
  });
  test("all 16 profiles and three stability bands use their own scores",()=>{
    for(let bits=0;bits<16;bits++)for(const stability of [25,50,85]){
      const values=[0,1,2,3].map(i=>bits&(1<<i)?85:25);
      const scores={openness:values[0]!,conscientiousness:values[1]!,extraversion:values[2]!,agreeableness:values[3]!,stability};const ownModel=buildPersonalityAtlas(scores);const code=typeCodeOf(scores);
      const html=renderToStaticMarkup(<PersonalEdition {...props} model={ownModel} typeName={typeName(code,null)} initialDraft={{revision:0,updatedAt:null,data:initialAtlasData(ownModel)}}/>);
      expect(html).toContain(`>${stability}</strong>`);expect(html).toContain("Пять граней");expect(html).not.toContain("Анна");
    }
  });
});

test("old report bookmarks and new chapter navigation retain a valid reading view",()=>{
  expect(editionViewForHash("#atlas-section-8")).toBe("life");expect(editionViewForHash("#atlas-section-6")).toBe("memo");
  expect(editionViewForHash("#edition-chapter-money")).toBe("spheres");expect(editionViewForHash("#edition-facets")).toBe("facets");
  expect(editionViewForHash("#manual")).toBe("memo");expect(editionViewForHash("#strengths")).toBe("portrait");
  expect(editionViewForHash("#unexpected")).toBe("portrait");
});
