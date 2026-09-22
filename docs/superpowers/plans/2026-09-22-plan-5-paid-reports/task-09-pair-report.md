# Task 9: Разбор пары на странице пары, предложение личного разбора

**Files:**
- Modify: `apps/web/src/lib/pair-view.ts`, `apps/web/src/lib/pair-view.test.ts`, `apps/web/src/app/pair/[id]/page.tsx`
- Create: `apps/web/src/app/pair/[id]/PairReport.tsx`

**Interfaces:**
- Consumes: `parseSections`, `PairSections` (Task 3); `unlockedKinds`, `formatRub`, `PRODUCT_PRICES`, `Product` (`@grani/core`); `listOwnedProducts`, `getReport`, `ReportRecord`, `PairRecord` (Task 2, план 4); `BuyButton`, `AutoRefresh`, `Paragraphs`, `REPORT_DISCLAIMER` (Task 8).
- Produces:
  ```ts
  // lib/pair-view.ts
  const PAIR_SECTION_TITLES: Readonly<Record<keyof PairSections, string>>;
  type PairReportView =
    | { state: "available"; price: string }
    | { state: "preparing" }
    | { state: "ready"; sections: readonly { key: keyof PairSections; title: string; text: string }[] };
  function buildPairReportView(p: { owned: readonly Product[]; report: ReportRecord | null }): PairReportView;
  ```

Раздел 4.6, пункты 5–6 спецификации. Разбор пары за 399 ₽ оплачивает любой из двоих, и он открывается обоим: покупка и разбор привязаны к `pair_id`, а страница пары уже доступна только участникам активной пары. После выхода из пары она отдаёт 404, и разбор скрывается вместе с ней.

Каждому, у кого нет своего полного разбора, под разбором пары показывается предложение «Личный разбор — 299 ₽»: он покупается для своего результата, того, что участвует в паре.

Названия разделов: «В чём вы похожи», «Где вы разные и как это использовать», «Откуда будут конфликты и как договариваться», «Быт и деньги», «Как поддерживать друг друга».

- [ ] **Step 1: Тест модели (падает)**

В `apps/web/src/lib/pair-view.test.ts` дописать:
```ts
describe("buildPairReportView", () => {
  const SECTIONS = { similar: "п".repeat(300), differences: "р".repeat(300), conflicts: "к".repeat(300), home_money: "д".repeat(300), support: "о".repeat(300) };
  const report = { id: "rep", resultId: null, pairId: "pair-1", kind: "pair" as const, sections: SECTIONS, source: "ai" as const, createdAt: new Date() };

  test("offers the report, then prepares it, then shows five titled sections", () => {
    expect(buildPairReportView({ owned: [], report: null })).toEqual({ state: "available", price: "399 ₽" });
    expect(buildPairReportView({ owned: ["pair"], report: null })).toEqual({ state: "preparing" });

    const ready = buildPairReportView({ owned: ["pair"], report });

    expect(ready.state === "ready" && ready.sections.map((section) => section.title)).toEqual([
      "В чём вы похожи",
      "Где вы разные и как это использовать",
      "Откуда будут конфликты и как договариваться",
      "Быт и деньги",
      "Как поддерживать друг друга",
    ]);
  });
});
```
и `buildPairReportView` в импорт из `./pair-view`.

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run apps/web/src/lib/pair-view.test.ts
```
Expected: FAIL — нет `buildPairReportView`.

- [ ] **Step 2: Модель**

В `apps/web/src/lib/pair-view.ts` дописать (импорты `parseSections`, `type PairSections` из `@grani/ai`; `formatRub`, `PRODUCT_PRICES`, `unlockedKinds`, `type Product` из `@grani/core`; `type ReportRecord` из `@grani/db`):
```ts
export const PAIR_SECTION_TITLES: Readonly<Record<keyof PairSections, string>> = {
  similar: "В чём вы похожи",
  differences: "Где вы разные и как это использовать",
  conflicts: "Откуда будут конфликты и как договариваться",
  home_money: "Быт и деньги",
  support: "Как поддерживать друг друга",
};

export type PairReportView =
  | { state: "available"; price: string }
  | { state: "preparing" }
  | { state: "ready"; sections: readonly { key: keyof PairSections; title: string; text: string }[] };

export function buildPairReportView(p: { owned: readonly Product[]; report: ReportRecord | null }): PairReportView {
  const sections = p.report ? parseSections("pair", p.report.sections) : null;
  if (sections) {
    const keys = Object.keys(PAIR_SECTION_TITLES) as (keyof PairSections)[];
    return { state: "ready", sections: keys.map((key) => ({ key, title: PAIR_SECTION_TITLES[key], text: sections[key] })) };
  }
  if (unlockedKinds(p.owned).has("pair")) return { state: "preparing" };
  return { state: "available", price: formatRub(PRODUCT_PRICES.pair) };
}
```

```bash
pnpm vitest run apps/web/src/lib/pair-view.test.ts
```
Expected: PASS.

- [ ] **Step 3: Блок на странице пары**

`apps/web/src/app/pair/[id]/PairReport.tsx`:
```tsx
import { formatRub, PRODUCT_PRICES, unlockedKinds } from "@grani/core";
import { getReport, listOwnedProducts } from "@grani/db";
import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { BuyButton } from "@/components/BuyButton";
import { Paragraphs } from "@/components/Paragraphs";
import { buildPairReportView } from "@/lib/pair-view";
import { REPORT_DISCLAIMER } from "@/lib/report-view";
import { getDb } from "@/server/db";

const REFRESH_SECONDS = 5;

export async function PairReport({ pairId, viewerResultId }: { pairId: string; viewerResultId: string }) {
  const db = getDb();
  const [owned, report, ownProducts] = await Promise.all([
    listOwnedProducts(db, { pairId }),
    getReport(db, { pairId }, "pair"),
    listOwnedProducts(db, { resultId: viewerResultId }),
  ]);
  const view = buildPairReportView({ owned, report });
  const offerPersonal = !unlockedKinds(ownProducts).has("full");

  return (
    <>
      <section className="card stack report" aria-labelledby="pair-report">
        <p className="eyebrow">Разбор пары</p>
        <h2 id="pair-report">Как вам быть вместе</h2>
        {view.state === "available" && (
          <>
            <p className="lead">Пять разделов: где вы похожи, где разные, откуда будут конфликты, быт и деньги, как поддерживать друг друга. Одна оплата открывает разбор обоим.</p>
            <BuyButton product="pair" targetId={pairId} label={`Открыть разбор пары за ${view.price}`} />
            <p className="muted">
              Нажимая кнопку, вы принимаете условия <Link href="/offer">оферты</Link> и подтверждаете, что вам есть 18 лет. Если кто-то из вас выйдет из пары, разбор скроется у обоих, деньги не возвращаются.
            </p>
          </>
        )}
        {view.state === "preparing" && (
          <>
            <AutoRefresh seconds={REFRESH_SECONDS} />
            <p className="muted" role="status">Готовим разбор пары… Страница обновится сама.</p>
          </>
        )}
        {view.state === "ready" && (
          <>
            {view.sections.map((section) => (
              <div key={section.key} className="stack">
                <h3>{section.title}</h3>
                <Paragraphs text={section.text} />
              </div>
            ))}
            <p className="muted">{REPORT_DISCLAIMER}</p>
          </>
        )}
      </section>

      {offerPersonal && (
        <section className="card card--paper stack" aria-labelledby="personal-offer">
          <p className="eyebrow">Для себя</p>
          <h2 id="personal-offer">Личный разбор</h2>
          <p className="lead">Портрет, сильные стороны, слепые зоны и «инструкция по применению меня» — по твоему результату.</p>
          <BuyButton product="full" targetId={viewerResultId} label={`Личный разбор — ${formatRub(PRODUCT_PRICES.full)}`} ghost />
        </section>
      )}
    </>
  );
}
```

В `apps/web/src/app/pair/[id]/page.tsx` между секцией шкал и `<details>` выхода из пары вставить
```tsx
      <PairReport pairId={view.pairId} viewerResultId={pair.members.find((member) => member.user.id === user.id)!.result.id} />
```
и импорт `import { PairReport } from "./PairReport";`. Карточка разбора пары — в палитре страницы («Глина»), отдельный `data-palette` не нужен.

- [ ] **Step 4: Проверка в браузере**

С тремя процессами и поддельной оплатой:
1. Создать пару по сценарию плана 4 (Аня зовёт, Борис проходит тест и соглашается).
2. У Бориса на странице пары — «Открыть разбор пары за 399 ₽» и «Личный разбор — 299 ₽» → оплатить разбор пары → `/purchases/<id>` → переход на `/pair/<id>`: пять разделов, дисклеймер.
3. У Ани на странице пары — тот же разбор, кнопки покупки пары нет. В логе воркера — `dry run notification` «Готово: разбор вашей пары» дважды.
4. Аня выходит из пары → у обоих страница пары 404, разбора не видно.
5. 375px без горизонтальной прокрутки.

- [ ] **Step 5: Тесты и коммит**

```bash
pnpm test && pnpm typecheck
git add apps/web/src/lib/pair-view.ts apps/web/src/lib/pair-view.test.ts apps/web/src/app/pair
git commit -m "feat(web): pair report for both members, personal report offer on the pair page"
```
