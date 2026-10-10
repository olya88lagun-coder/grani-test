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
