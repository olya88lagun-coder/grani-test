# Task 10: Карточка «инструкция по применению меня», оферта, ссылки

**Files:**
- Create: `apps/web/src/lib/manual-card.ts`, `manual-card.test.ts`, `apps/web/src/app/cards/manual/[resultId]/route.tsx`, `apps/web/src/app/offer/page.tsx`
- Modify: `apps/web/src/lib/card.tsx`, `apps/web/src/app/result/[id]/ShareCard.tsx`, `apps/web/src/app/report/[resultId]/page.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/lib/legal.ts`

**Interfaces:**
- Consumes: `FullSections`, `parseSections` (Task 3); `getReport`, `getResultForOwner` (Task 2); `TYPE_VISUALS`, `typeCodeToDir`, `CARD_SIZE`, `loadCardFonts`, `CARD_PALETTE`, `gemPaths` (план 3); `PRODUCT_PRICES`, `formatRub`, `typeName` (`@grani/core`); `PRODUCT_DESCRIPTIONS` (Task 5); `OPERATOR` (план 3); `REPORT_DISCLAIMER` (Task 8).
- Produces:
  ```ts
  // lib/manual-card.ts
  type ManualCardModel = { typeName: string; visual: TypeVisual; lists: readonly { title: string; items: readonly string[] }[] };
  const MANUAL_ITEM_LENGTH = 80;
  function shortenItem(text: string, max?: number): string;
  function buildManualCardModel(full: FullSections, typeName: string, visual: TypeVisual): ManualCardModel;

  // lib/card.tsx
  function manualCardElement(model: ManualCardModel): ReactElement;

  // lib/legal.ts
  const OFFER_VERSION = "2026-09-v1";

  // ShareCard.tsx — новые необязательные props
  { heading?: string; eyebrow?: string; shareTitle?: string }
  ```

Раздел 4.5 спецификации: вторая карточка 1080×1920 «инструкция по применению меня» открывается после оплаты. На ней название типа, знак типа, три коротких списка из раздела «Инструкция» полного разбора (по три пункта, каждый до 80 знаков, обрезка по слову с «…»), адрес grani-test.ru и призыв «узнай свой тип». Карточка личная: маршрут отдаёт её только владельцу результата с оплаченным и готовым полным разбором и запрещает кэширование (`private, no-store`).

Оферта (раздел 6 спецификации) — рабочая редакция, закрытая от индексации, как и весь сайт до плана 6. В ней: исполнитель, услуги и цены (из `PRODUCT_PRICES`), порядок оказания, возраст 18+, оплата через ЮKassa и чек «Мой налог», возвраты, данные для генерации, дисклеймер. Финальную редакцию вместе с политикой конфиденциальности готовит план 6. Там же нужно учесть, что баллы без имени уходят сервису ИИ, а оплата — через ЮKassa: текущий текст согласия говорит, что третьим лицам данные не передаются.

- [ ] **Step 1: Тест модели карточки (падает)**

`apps/web/src/lib/manual-card.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { buildManualCardModel, MANUAL_ITEM_LENGTH, shortenItem } from "./manual-card";
import { TYPE_VISUALS } from "./type-visuals";

describe("shortenItem", () => {
  test("keeps short items and cuts long ones at a word with an ellipsis", () => {
    expect(shortenItem("Давай мне время подумать.")).toBe("Давай мне время подумать.");
    const long = "Давай мне время подумать перед важным решением и не торопи, даже если кажется, что ответ очевиден";
    const cut = shortenItem(long);
    expect(cut.length).toBeLessThanOrEqual(MANUAL_ITEM_LENGTH);
    expect(cut.endsWith("…")).toBe(true);
    expect(long.startsWith(cut.slice(0, -1))).toBe(true);
    expect(cut.slice(0, -1).endsWith(" ")).toBe(false);
  });
});

test("takes three items of each manual list", () => {
  const full = {
    portrait: "п",
    strengths: [],
    blind_spots: [],
    manual: { work: ["р1", "р2", "р3", "р4"], fight: ["с1", "с2", "с3"], annoys: ["б1", "б2", "б3"] },
  };

  const model = buildManualCardModel(full, "Искра", TYPE_VISUALS["pmpp"]!);

  expect(model.lists).toEqual([
    { title: "Как со мной работать", items: ["р1", "р2", "р3"] },
    { title: "Как со мной ссориться", items: ["с1", "с2", "с3"] },
    { title: "Что меня бесит", items: ["б1", "б2", "б3"] },
  ]);
});
```

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run apps/web/src/lib/manual-card.test.ts
```
Expected: FAIL — модуля нет.

- [ ] **Step 2: Модель и отрисовка карточки**

`apps/web/src/lib/manual-card.ts`:
```ts
import type { FullSections } from "@grani/ai";
import type { TypeVisual } from "./type-visuals";

export type ManualCardModel = { typeName: string; visual: TypeVisual; lists: readonly { title: string; items: readonly string[] }[] };

export const MANUAL_ITEM_LENGTH = 80;
const ITEMS_PER_LIST = 3;

export function shortenItem(text: string, max = MANUAL_ITEM_LENGTH): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:—-]+$/, "")}…`;
}

export function buildManualCardModel(full: FullSections, typeName: string, visual: TypeVisual): ManualCardModel {
  const list = (title: string, items: readonly string[]) => ({ title, items: items.slice(0, ITEMS_PER_LIST).map((item) => shortenItem(item)) });
  return {
    typeName,
    visual,
    lists: [
      list("Как со мной работать", full.manual.work),
      list("Как со мной ссориться", full.manual.fight),
      list("Что меня бесит", full.manual.annoys),
    ],
  };
}
```

В `apps/web/src/lib/card.tsx` дописать (импорт `type ManualCardModel` из `./manual-card`):
```tsx
const MANUAL_GEM_SIZE = 200;

export function manualCardElement({ typeName, visual, lists }: ManualCardModel): ReactElement {
  const { ink, tints } = CARD_PALETTE;
  const { outline, facets } = gemPaths(visual.shape, MANUAL_GEM_SIZE);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "120px 90px 110px",
        background: tints[visual.family],
        color: ink,
        fontFamily: "Golos",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
        <svg width={MANUAL_GEM_SIZE} height={MANUAL_GEM_SIZE} viewBox={`-4 -4 ${MANUAL_GEM_SIZE + 8} ${MANUAL_GEM_SIZE + 8}`}>
          <path d={outline} fill="none" stroke={ink} strokeWidth={4} strokeLinejoin="round" />
          <path d={facets} fill="none" stroke={ink} strokeWidth={4} strokeLinejoin="round" opacity={0.45} />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 600, letterSpacing: 3, textTransform: "uppercase" }}>инструкция по применению меня</div>
          <div style={{ display: "flex", fontFamily: "Cormorant", fontWeight: 300, fontSize: 96, lineHeight: 1.05, letterSpacing: -2 }}>{typeName}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 56 }}>
        {lists.map((list) => (
          <div key={list.title} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", fontFamily: "Cormorant", fontWeight: 300, fontSize: 64 }}>{list.title}</div>
            {list.items.map((item) => (
              <div key={item} style={{ display: "flex", fontSize: 34, lineHeight: 1.35 }}>
                — {item}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", fontSize: 36 }}>узнай свой тип · grani-test.ru</div>
    </div>
  );
}
```

```bash
pnpm vitest run apps/web/src/lib/manual-card.test.ts
```
Expected: PASS.

- [ ] **Step 3: Маршрут карточки и кнопка на странице разбора**

`apps/web/src/app/cards/manual/[resultId]/route.tsx`:
```tsx
import { parseSections } from "@grani/ai";
import { typeCodeToDir } from "@grani/content";
import { typeName } from "@grani/core";
import { getReport, getResultForOwner } from "@grani/db";
import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { CARD_SIZE, loadCardFonts, manualCardElement } from "@/lib/card";
import { buildManualCardModel } from "@/lib/manual-card";
import { TYPE_VISUALS } from "@/lib/type-visuals";
import { getDb } from "@/server/db";
import { currentUser } from "@/server/viewer";

// Карточка строится из оплаченного разбора: только владельцу и без кэша —
// иначе на общем устройстве её увидел бы следующий, кто войдёт в том же браузере
const CACHE_CONTROL = "private, no-store";

export async function GET(_request: Request, { params }: { params: Promise<{ resultId: string }> }) {
  const [{ resultId }, user] = await Promise.all([params, currentUser()]);
  if (!user) return new NextResponse(null, { status: 401 });
  const db = getDb();
  const result = await getResultForOwner(db, resultId, user.id);
  const report = result ? await getReport(db, { resultId }, "full") : null;
  const full = report ? parseSections("full", report.sections) : null;
  const visual = result ? TYPE_VISUALS[typeCodeToDir(result.typeCode)] : undefined;
  if (!result || !full || !visual) return new NextResponse(null, { status: 404 });

  const model = buildManualCardModel(full, typeName(result.typeCode, user.gender), visual);
  const image = new ImageResponse(manualCardElement(model), { ...CARD_SIZE, fonts: await loadCardFonts() });
  image.headers.set("cache-control", CACHE_CONTROL);
  image.headers.set("content-disposition", `inline; filename="grani-manual.png"`);
  return image;
}
```

В `apps/web/src/app/result/[id]/ShareCard.tsx` добавить необязательные props `eyebrow = "Для сторис"`, `heading = "Карточка «мой тип»"`, `shareTitle = \`Мой тип — ${typeName}\``, подставить их вместо текстов в разметке и в `navigator.share`. Вызов на странице результата не меняется.

В `apps/web/src/app/report/[resultId]/page.tsx` после секции инструкции (внутри `{view.full && …}` — отдельным элементом после неё) добавить
```tsx
        {view.full && (
          <ShareCard
            cardUrl={`/cards/manual/${resultId}`}
            fileName="grani-manual.png"
            typeName={typeName(result.typeCode, user.gender)}
            heading="Карточка «инструкция по применению меня»"
            shareTitle="Инструкция по применению меня"
          />
        )}
```
с импортами `ShareCard` из `@/app/result/[id]/ShareCard` и `typeName` из `@grani/core`.

- [ ] **Step 4: Оферта и ссылки**

В `apps/web/src/lib/legal.ts` дописать:
```ts
export const OFFER_VERSION = "2026-09-v1";
```

`apps/web/src/app/offer/page.tsx`:
```tsx
import { formatRub, PRODUCT_PRICES, type Product } from "@grani/core";
import type { Metadata } from "next";
import { OFFER_VERSION, OPERATOR } from "@/lib/legal";
import { REPORT_DISCLAIMER } from "@/lib/report-view";
import { PRODUCT_DESCRIPTIONS } from "@/server/payments-service";

export const metadata: Metadata = { title: "Публичная оферта" };

const PRODUCTS = Object.keys(PRODUCT_PRICES) as Product[];

export default function OfferPage() {
  return (
    <main className="page">
      <article className="stack">
        <h1 className="display">Публичная оферта</h1>
        <p className="muted">Редакция {OFFER_VERSION}</p>
        <h2>Исполнитель</h2>
        <p>
          {OPERATOR.name}, плательщик налога на профессиональный доход (самозанятая). Почта для вопросов и возвратов:{" "}
          <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>.
        </p>
        <h2>Услуги и цены</h2>
        <p>Исполнитель предоставляет доступ к текстовым материалам для самопознания на сайте grani-test.ru, составленным по результату теста.</p>
        <ul>
          {PRODUCTS.map((product) => (
            <li key={product}>
              {PRODUCT_DESCRIPTIONS[product]} — {formatRub(PRODUCT_PRICES[product])}
            </li>
          ))}
        </ul>
        <p>Главы по сферам доступны после покупки полного разбора. Разбор пары открывается обоим участникам пары, оплачивает любой из них.</p>
        <h2>Порядок оказания</h2>
        <p>
          После подтверждения оплаты материал готовится автоматически, обычно около минуты, и становится доступен на сайте после входа через Telegram или VK ID.
          Раздел «Как меня видят другие» появляется, когда на вопросы о покупателе ответят не меньше трёх друзей. Услуга считается оказанной, когда материал
          открыт на сайте.
        </p>
        <h2>Возраст</h2>
        <p>Платные услуги предназначены для лиц старше 18 лет. Оплачивая услугу, покупатель подтверждает, что ему есть 18 лет.</p>
        <h2>Оплата и чек</h2>
        <p>Оплата принимается через сервис ЮKassa. Чек формируется в приложении «Мой налог» и отправляется покупателю средствами ЮKassa.</p>
        <h2>Возвраты</h2>
        <p>
          Если оплаченный материал не удалось выдать, исполнитель возвращает деньги полностью — напишите на {OPERATOR.email}. Если участник пары выходит из
          неё, страница пары и разбор пары скрываются у обоих, деньги за разбор пары не возвращаются.
        </p>
        <h2>Данные для подготовки материалов</h2>
        <p>Для подготовки текста используются только баллы теста и уровни черт — без имени и других данных, по которым можно узнать покупателя.</p>
        <p className="muted">{REPORT_DISCLAIMER}</p>
      </article>
    </main>
  );
}
```

В подвале `apps/web/src/app/page.tsx` добавить `<Link href="/offer">Оферта</Link>` перед ссылкой «Мой результат».

- [ ] **Step 5: Проверка в браузере**

1. После оплаты полного разбора (Task 8) на странице разбора — карточка «инструкция по применению меня»: картинка 270×480 с тремя списками, «Поделиться» скачивает `grani-manual.png`.
2. Открыть `/cards/manual/<resultId>` в окне без входа → 401; чужой результат → 404.
3. `/offer` — все семь услуг с ценами, возвраты, 18+, дисклеймер; ссылка «Оферта» в подвале главной.
4. 375px без горизонтальной прокрутки.

- [ ] **Step 6: Тесты и коммит**

```bash
pnpm test && pnpm typecheck && pnpm --filter @grani/web build
git add apps/web
git commit -m "feat(web): manual card after purchase, working offer page, offer link"
```
Expected: сборка без предупреждений (шрифты карточки — те же статические `new URL(...)`, что в плане 3).
