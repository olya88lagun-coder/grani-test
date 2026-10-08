import { expect, test } from "@playwright/test";
import { contrastRatio } from "../scripts/check-design-contrast.mjs";
import { seedResultNightFixtures, type ResultNightFixture } from "./result-night-fixtures";

test.skip(!process.env.RESULT_QA_DATABASE_URL || !process.env.RESULT_QA_SESSION_SECRET, "Local authenticated result fixtures require explicit QA database settings");
let fixtures: ResultNightFixture[];
test.beforeAll(async () => { fixtures = await seedResultNightFixtures(); });

for (const name of ["Искра", "Тихая хранительница"]) for (const paid of [false, true]) for (const width of [320,390,1024,1440]) {
  test(`result ${name}, ${paid ? "paid" : "free"}, ${width}px`, async ({page,context}, testInfo) => {
    const fixture = fixtures.find(item => item.name === name && item.paid === paid)!;
    const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
    await context.addCookies([{name:"grani_session", value:fixture.token, url:baseURL, httpOnly:true, sameSite:"Lax"}]);
    await page.setViewportSize({width,height:900});
    await page.emulateMedia({reducedMotion:"reduce"});
    const errors: string[]=[];
    page.on("pageerror", error=>errors.push(error.message));
    await page.goto(`/result/${fixture.resultId}`);
    await expect(page.getByRole("heading",{level:1,name,exact:true})).toBeVisible();
    await page.evaluate(()=>document.fonts.ready);
    await expect(page.locator('.result-hero')).toHaveAttribute('data-band','night');
    await expect(page.locator('.result-block--report')).toHaveAttribute('data-band','night');
    await expect(page.locator('.result-scales')).not.toHaveAttribute('data-band','night');
    await expect(page.locator('.result-card [data-gem-dir]')).toHaveAttribute('data-gem-dir',fixture.dir);
    await expect(page.locator('.result-card [data-gem-dir]')).toHaveAttribute('data-loaded','true');
    await expect(page.locator('.meter')).toHaveCount(5);
    const gold=await page.locator('.meter__value').first().evaluate(node=>getComputedStyle(node).color);
    await expect(page.locator('.meter__fill').first()).toHaveCSS('background-color',gold);
    if(paid) {
      await expect(page.getByRole('heading',{name:'Разбор открыт',exact:true})).toBeVisible();
      await expect(page.locator('.result-hero__actions .button').first()).toHaveAttribute('href',`/report/${fixture.resultId}`);
      await expect(page.locator('.sticky-cta')).toHaveCount(0);
    } else {
      await expect(page.locator('.result-hero__actions .button').first()).toHaveAttribute('href','#report');
      await expect(page.getByRole('button',{name:'Открыть полный разбор за 299 ₽',exact:true})).toBeVisible();
      await expect(page.locator('.result-offer__price')).toHaveCSS('color',gold);
    }
    await expect(page.locator('.share-card__preview')).toHaveAttribute('src',`/cards/${fixture.dir}?f=1`);
    await page.locator('.share-card__preview').scrollIntoViewIfNeeded();
    await expect.poll(()=>page.locator('.share-card__preview').evaluate(node=>(node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth>0)).toBe(true);
    for(const selector of ['.result-scale','.result-block','.share-card']) for(const node of await page.locator(selector).all()) await expect(node).toHaveCSS('box-shadow','none');
    const mainChrome=await page.locator('main').evaluate(node=>getComputedStyle(node).getPropertyValue('--chrome-bg').trim());
    const footerChrome=await page.locator('.footer').evaluate(node=>getComputedStyle(node).getPropertyValue('--chrome-bg').trim());
    expect(footerChrome).toBe(mainChrome);
    const samples=await page.locator('.result-hero h1, .result-hero .lead, .result-tags li, .meter__label, .meter__value, .result-block--report h2, .result-block--report h3, .result-block--report p:not([aria-hidden]), .result-offer__price, .result-scale h3, .result-scale p, .share-card__body h2, .share-card__body p').evaluateAll(nodes=>{
      const canvas=document.createElement('canvas'); canvas.width=canvas.height=1; const context=canvas.getContext('2d')!;
      const channels=(value:string)=>{context.clearRect(0,0,1,1);context.fillStyle=value;context.fillRect(0,0,1,1);return Array.from(context.getImageData(0,0,1,1).data);};
      const background=(node:Element|null):number[]=>{
        if(!node)return [255,255,255];
        const style=getComputedStyle(node),color=channels(style.backgroundColor);
        if(color[3]===0&&style.backgroundImage.includes('linear-gradient')) {
          // Conservative bound: even an underlying image is treated as white through translucent stops.
          const stops=[...style.backgroundImage.matchAll(/(?:rgba?|oklab|oklch|color)\([^)]*\)/g)].map(match=>channels(match[0]));
          if(stops.length)return [0,1,2].map(i=>Math.max(...stops.map(stop=>Math.round(stop[i]*stop[3]/255+255*(1-stop[3]/255)))));
        }
        if(color[3]===255)return color.slice(0,3);
        const parent=background(node.parentElement),alpha=color[3]/255;
        return parent.map((value,i)=>Math.round(color[i]*alpha+value*(1-alpha)));
      };
      const hex=(color:number[])=>'#'+color.slice(0,3).map(value=>value.toString(16).padStart(2,'0')).join('');
      return nodes.map(node=>({text:node.textContent,fg:hex(channels(getComputedStyle(node).color)),bg:hex(background(node))}));
    });
    for(const sample of samples)expect(contrastRatio(sample.fg,sample.bg),`${sample.text}: contrast`).toBeGreaterThanOrEqual(4.5);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const nameBounds=await page.locator('h1').evaluate(node=>{const range=document.createRange();range.selectNodeContents(node);return {text:range.getBoundingClientRect().toJSON(),parent:node.parentElement!.getBoundingClientRect().toJSON()};});
    expect(nameBounds.text.right).toBeLessThanOrEqual(nameBounds.parent.right+1);
    if(!paid && width<760) {
      await page.locator('.result-scale').nth(2).scrollIntoViewIfNeeded();
      await expect(page.locator('.sticky-cta')).toHaveAttribute('aria-hidden','false');
      for(const selector of ['.result-hero__actions','.result-offer__buy','.share-card__body .row','.result-block:has(#friends)','.result-block:has(#pairs)','.page--result > .row','.footer']) {
        await page.locator(selector).scrollIntoViewIfNeeded();
        await expect(page.locator('.sticky-cta')).toHaveAttribute('aria-hidden','true');
        await expect(page.locator('.sticky-cta')).toHaveAttribute('tabindex','-1');
      }
    }
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:testInfo.outputPath(`result-${fixture.dir}-${paid?'paid':'free'}-${width}-viewport.png`),scale:'css'});
    await page.screenshot({path:testInfo.outputPath(`result-${fixture.dir}-${paid?'paid':'free'}-${width}.png`),fullPage:true,scale:'css'});
    expect(errors).toEqual([]);
  });
}
