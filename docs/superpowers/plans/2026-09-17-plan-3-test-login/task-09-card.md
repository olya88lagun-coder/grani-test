# Task 9: Карточка «мой тип» для сторис

**Files:**
- Create: `apps/web/src/lib/type-visuals.ts`, `apps/web/src/lib/card.tsx`, `apps/web/src/components/TypeGem.tsx`, `apps/web/src/app/cards/[dir]/route.tsx`, `apps/web/src/app/result/[id]/ShareCard.tsx`
- Create: `apps/web/assets/fonts/*.woff` (шесть файлов шрифтов для картинок)
- Modify: `apps/web/src/app/globals.css` (плитка знака), `apps/web/src/app/result/[id]/page.tsx` (знак типа и блок карточки)
- Test: `apps/web/src/lib/type-visuals.test.ts`, `apps/web/src/lib/card.test.tsx`

**Interfaces:**
- Consumes: `TypeCode`, `ALL_TYPE_CODES`, `typeName` (`@grani/core`); `TYPE_DIRS`, `typeCodeToDir` (`@grani/content`); раздел «Типы: семья и знак» и «Карточка» из `docs/design/visual-direction.md` (Task 1); `ResultView` (Task 8).
- Produces:
  ```ts
  // type-visuals.ts
  type TypeShape = "diamond" | "hexagon" | "triangle" | "circle" | "star" | "square" | "pentagon" | "drop";
  type TypeFamily = 1 | 2 | 3 | 4;
  type TypeVisual = { family: TypeFamily; shape: TypeShape };
  const TYPE_VISUALS: Readonly<Record<string, TypeVisual>>; // ключ — каталог типа (pppp…mmmm)
  const CARD_PALETTE: { ink: string; tints: Readonly<Record<TypeFamily, string>> }; // палитра «Оранжерея»
  function dirToTypeCode(dir: string): TypeCode | null;
  function contrastRatio(foreground: string, background: string): number;
  function gemPaths(shape: TypeShape, size: number): { outline: string; facets: string }; // SVG path в квадрате size×size
  // card.tsx
  const CARD_SIZE = { width: 1080, height: 1920 };
  type CardModel = { name: string; visual: TypeVisual };
  function cardElement(model: CardModel): ReactElement;
  function loadCardFonts(): Promise<CardFont[]>;
  // components/TypeGem.tsx
  function TypeGem(props: { shape: TypeShape; size: number }): ReactElement; // цвет — var(--accent)
  // GET /cards/<dir>[?f=1] → image/png 1080×1920
  ```

Карточка (раздел 4.5 спецификации) не содержит личных данных: только название типа, его знак и тон семьи, подпись «мой тип» и адрес сайта. Поэтому она рисуется по коду типа и открыта без входа — ссылку можно вставить в сторис или переслать. `?f=1` даёт женскую форму названия, если она есть. Неизвестный каталог → 404.

Цвет типа по стилю из Task 1 — не отдельный яркий цвет, а тон панели по семье (первые две буквы каталога) и гранёный знак: контур, внутренний контур на 45% размера и линии граней от центра к вершинам. Карточка всегда в палитре «Оранжерея» — это раздел личного результата.

- [ ] **Step 1: Шрифты для картинок**

`next/og` не читает `next/font` и woff2, поэтому для карточки нужны отдельные файлы `.woff`. Их берём из пакетов Fontsource (лицензия OFL) и кладём в репозиторий: Turbopack не умеет подключать `.woff` через `require.resolve` («Unknown module type»), а статический `new URL(..., import.meta.url)` к файлу в `apps/web/assets/fonts` работает и в dev, и в standalone-сборке — так же сделано в wishlist.
```bash
cd /c/dev/grani-test
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
mkdir -p apps/web/assets/fonts && cd apps/web/assets/fonts
npm pack @fontsource/cormorant-garamond@5.3.0 @fontsource/golos-text@5.3.0
tar -xzf fontsource-cormorant-garamond-5.3.0.tgz --strip-components=2 package/files/cormorant-garamond-cyrillic-300-normal.woff package/files/cormorant-garamond-latin-300-normal.woff
tar -xzf fontsource-golos-text-5.3.0.tgz --strip-components=2 package/files/golos-text-cyrillic-400-normal.woff package/files/golos-text-latin-400-normal.woff package/files/golos-text-cyrillic-600-normal.woff package/files/golos-text-latin-600-normal.woff
rm *.tgz && ls
```
Expected: шесть файлов `.woff`. Кириллица и латиница лежат в разных файлах; оба подключаются под одним именем шрифта, и `next/og` берёт недостающие буквы из второго файла.

- [ ] **Step 2: Тесты (падают)**

`apps/web/src/lib/type-visuals.test.ts`:
```ts
import { ALL_TYPE_CODES } from "@grani/core";
import { TYPE_DIRS, typeCodeToDir } from "@grani/content";
import { describe, expect, test } from "vitest";
import { CARD_PALETTE, TYPE_VISUALS, contrastRatio, dirToTypeCode, gemPaths } from "./type-visuals";

describe("TYPE_VISUALS", () => {
  test("has a visual for every type and nothing else", () => {
    expect(Object.keys(TYPE_VISUALS).sort()).toEqual([...TYPE_DIRS].sort());
  });

  test("family follows openness and conscientiousness", () => {
    expect(TYPE_VISUALS.pppm?.family).toBe(1);
    expect(TYPE_VISUALS.pmmp?.family).toBe(2);
    expect(TYPE_VISUALS.mppm?.family).toBe(3);
    expect(TYPE_VISUALS.mmmm?.family).toBe(4);
  });

  test("shapes do not repeat inside a family, so every type is recognizable", () => {
    for (const family of [1, 2, 3, 4] as const) {
      const shapes = Object.values(TYPE_VISUALS).filter((visual) => visual.family === family).map((visual) => visual.shape);
      expect(new Set(shapes).size).toBe(shapes.length);
    }
  });

  test.each(Object.entries(CARD_PALETTE.tints))("card ink is readable on family %s tint", (_family, tint) => {
    expect(contrastRatio(CARD_PALETTE.ink, tint)).toBeGreaterThanOrEqual(7);
  });
});

describe("contrastRatio", () => {
  test("matches WCAG reference values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    expect(contrastRatio("#767676", "#FFFFFF")).toBeCloseTo(4.54, 2);
  });
});

describe("dirToTypeCode", () => {
  test("is the inverse of typeCodeToDir", () => {
    for (const code of ALL_TYPE_CODES) expect(dirToTypeCode(typeCodeToDir(code))).toBe(code);
  });

  test.each(["", "ppp", "ppppp", "pxpp", "PPPP", "../x"])("rejects %j", (dir) => {
    expect(dirToTypeCode(dir)).toBeNull();
  });
});

test("every shape has a closed outline and facet lines", () => {
  for (const visual of Object.values(TYPE_VISUALS)) {
    const { outline, facets } = gemPaths(visual.shape, 100);
    expect(outline).toMatch(/^M.*Z$/);
    expect(facets).toMatch(/^M/);
  }
});
```

`apps/web/src/lib/card.test.tsx`:
```tsx
import { ImageResponse } from "next/og";
import { expect, test } from "vitest";
import { CARD_SIZE, cardElement, loadCardFonts } from "./card";
import { TYPE_VISUALS } from "./type-visuals";

test("renders a story-sized PNG", async () => {
  const visual = TYPE_VISUALS.pmpp;
  if (!visual) throw new Error("no visual for pmpp");
  const response = new ImageResponse(cardElement({ name: "Искра", visual }), { ...CARD_SIZE, fonts: await loadCardFonts() });
  const bytes = new Uint8Array(await response.arrayBuffer());
  expect([...bytes.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  // Ширина и высота PNG лежат в заголовке IHDR, байты 16–23
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  expect([view.getUint32(16), view.getUint32(20)]).toEqual([1080, 1920]);
  expect(bytes.byteLength).toBeLessThan(1_000_000);
}, 30_000);

test("fits a long gendered name", async () => {
  const visual = TYPE_VISUALS.mpmp;
  if (!visual) throw new Error("no visual for mpmp");
  const response = new ImageResponse(cardElement({ name: "Тихая хранительница", visual }), { ...CARD_SIZE, fonts: await loadCardFonts() });
  expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(1000);
}, 30_000);
```

```bash
pnpm vitest run apps/web/src/lib/type-visuals.test.ts apps/web/src/lib/card.test.tsx
```
Expected: FAIL — модулей нет.

- [ ] **Step 3: Семьи и знаки типов**

`apps/web/src/lib/type-visuals.ts`:
```ts
import { ALL_TYPE_CODES, type TypeCode } from "@grani/core";
import { typeCodeToDir } from "@grani/content";

export type TypeShape = "diamond" | "hexagon" | "triangle" | "circle" | "star" | "square" | "pentagon" | "drop";
export type TypeFamily = 1 | 2 | 3 | 4;
export type TypeVisual = { family: TypeFamily; shape: TypeShape };

// docs/design/visual-direction.md, «Типы: семья и знак»
const SHAPES: Readonly<Record<string, TypeShape>> = {
  pppp: "star", pppm: "triangle", ppmp: "hexagon", ppmm: "square",
  pmpp: "star", pmpm: "triangle", pmmp: "drop", pmmm: "diamond",
  mppp: "hexagon", mppm: "pentagon", mpmp: "circle", mpmm: "square",
  mmpp: "circle", mmpm: "diamond", mmmp: "drop", mmmm: "pentagon",
};

const FAMILIES: Readonly<Record<string, TypeFamily>> = { pp: 1, pm: 2, mp: 3, mm: 4 };

export const TYPE_VISUALS: Readonly<Record<string, TypeVisual>> = Object.fromEntries(
  Object.entries(SHAPES).map(([dir, shape]) => [dir, { family: FAMILIES[dir.slice(0, 2)] as TypeFamily, shape }]),
);

// Палитра «Оранжерея»: чернила и тоны панелей --surface … --surface-4
export const CARD_PALETTE = {
  ink: "#0F3E17",
  tints: { 1: "#E1F4DF", 2: "#CFE7D3", 3: "#B1DBB8", 4: "#B6CED5" },
} as const satisfies { ink: string; tints: Readonly<Record<TypeFamily, string>> };

const CODE_BY_DIR: ReadonlyMap<string, TypeCode> = new Map(ALL_TYPE_CODES.map((code) => [typeCodeToDir(code), code]));

export function dirToTypeCode(dir: string): TypeCode | null {
  return CODE_BY_DIR.get(dir) ?? null;
}

function channel(hex: string, offset: number): number {
  const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

// Формула контраста WCAG 2.x; цвета — в виде #RRGGBB
export function contrastRatio(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

type Point = readonly [number, number];

const toPath = (points: readonly Point[]) => `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")} Z`;

function regular(sides: number, size: number, rotation: number, innerRatio?: number): Point[] {
  const center = size / 2;
  const count = innerRatio === undefined ? sides : sides * 2;
  return Array.from({ length: count }, (_, i) => {
    const radius = innerRatio !== undefined && i % 2 === 1 ? center * innerRatio : center;
    const angle = rotation + (i * 2 * Math.PI) / count;
    return [center + radius * Math.cos(angle), center + radius * Math.sin(angle)] as const;
  });
}

const UP = -Math.PI / 2;
const INNER_SCALE = 0.45;

function vertices(shape: TypeShape, size: number): Point[] | null {
  const half = size / 2;
  switch (shape) {
    case "square":
      return [[size * 0.08, size * 0.08], [size * 0.92, size * 0.08], [size * 0.92, size * 0.92], [size * 0.08, size * 0.92]];
    case "diamond":
      return [[half, 0], [size, half], [half, size], [0, half]];
    case "triangle":
      return regular(3, size, UP);
    case "pentagon":
      return regular(5, size, UP);
    case "hexagon":
      return regular(6, size, 0);
    case "star":
      return regular(5, size, UP, 0.42);
    default:
      return null;
  }
}

// Гранёный знак: внешний контур плюс «грани» — внутренний контур и линии от центра к вершинам
export function gemPaths(shape: TypeShape, size: number): { outline: string; facets: string } {
  const half = size / 2;
  const points = vertices(shape, size);
  if (points) {
    const inner = points.map(([x, y]) => [half + (x - half) * INNER_SCALE, half + (y - half) * INNER_SCALE] as const);
    const spokes = (shape === "star" ? points.filter((_, i) => i % 2 === 0) : points)
      .map(([x, y]) => `M${half} ${half} L${x.toFixed(1)} ${y.toFixed(1)}`)
      .join(" ");
    return { outline: toPath(points), facets: `${toPath(inner)} ${spokes}` };
  }
  if (shape === "circle") {
    return {
      outline: `M${half} 0 A${half} ${half} 0 1 1 ${half} ${size} A${half} ${half} 0 1 1 ${half} 0 Z`,
      facets: `M${half} ${size * 0.28} A${half * 0.72} ${half * 0.44} 0 1 1 ${half} ${size * 0.72} A${half * 0.72} ${half * 0.44} 0 1 1 ${half} ${size * 0.28} Z M0 ${half} L${size} ${half}`,
    };
  }
  return {
    outline: `M${half} 0 C${size * 0.85} ${size * 0.4} ${size} ${size * 0.6} ${size} ${size * 0.68} A${half} ${half * 0.64} 0 0 1 0 ${size * 0.68} C0 ${size * 0.6} ${size * 0.15} ${size * 0.4} ${half} 0 Z`,
    facets: `M${half} ${size * 0.3} C${size * 0.7} ${size * 0.5} ${size * 0.76} ${size * 0.62} ${size * 0.76} ${size * 0.7} A${half * 0.52} ${half * 0.36} 0 0 1 ${size * 0.24} ${size * 0.7} C${size * 0.24} ${size * 0.62} ${size * 0.3} ${size * 0.5} ${half} ${size * 0.3} Z M${half} 0 L${half} ${size}`,
  };
}
```

`apps/web/src/components/TypeGem.tsx`:
```tsx
import { gemPaths, type TypeShape } from "@/lib/type-visuals";

export function TypeGem({ shape, size }: { shape: TypeShape; size: number }) {
  const { outline, facets } = gemPaths(shape, size);
  const pad = 2;
  return (
    <svg width={size} height={size} viewBox={`${-pad} ${-pad} ${size + pad * 2} ${size + pad * 2}`} aria-hidden="true">
      <g fill="none" stroke="var(--accent)" strokeWidth={1.4} strokeLinejoin="round">
        <path d={outline} />
        <path d={facets} opacity={0.45} />
      </g>
    </svg>
  );
}
```

- [ ] **Step 4: Карточка**

`apps/web/src/lib/card.tsx`:
```tsx
import { readFile } from "node:fs/promises";
import type { ReactElement } from "react";
import { CARD_PALETTE, gemPaths, type TypeVisual } from "./type-visuals";

export const CARD_SIZE = { width: 1080, height: 1920 } as const;

export type CardModel = { name: string; visual: TypeVisual };
export type CardFont = { name: string; data: Buffer; weight: 300 | 400 | 600; style: "normal" };

// Пути статические: так сборщик Next кладёт шрифты рядом с кодом и они попадают в standalone-сборку.
// Кириллица и латиница у Fontsource в разных файлах — подключаем оба под одним именем.
const FONT_FILES = [
  { name: "Cormorant", weight: 300, url: new URL("../../assets/fonts/cormorant-garamond-cyrillic-300-normal.woff", import.meta.url) },
  { name: "Cormorant", weight: 300, url: new URL("../../assets/fonts/cormorant-garamond-latin-300-normal.woff", import.meta.url) },
  { name: "Golos", weight: 400, url: new URL("../../assets/fonts/golos-text-cyrillic-400-normal.woff", import.meta.url) },
  { name: "Golos", weight: 400, url: new URL("../../assets/fonts/golos-text-latin-400-normal.woff", import.meta.url) },
  { name: "Golos", weight: 600, url: new URL("../../assets/fonts/golos-text-cyrillic-600-normal.woff", import.meta.url) },
  { name: "Golos", weight: 600, url: new URL("../../assets/fonts/golos-text-latin-600-normal.woff", import.meta.url) },
] as const;

let fontsPromise: Promise<CardFont[]> | undefined;

export function loadCardFonts(): Promise<CardFont[]> {
  fontsPromise ??= Promise.all(
    FONT_FILES.map(async ({ name, weight, url }) => ({ name, weight, style: "normal" as const, data: await readFile(url) })),
  );
  return fontsPromise;
}

const GEM_SIZE = 520;

// satori требует явный display: flex у каждого контейнера с несколькими детьми
export function cardElement({ name, visual }: CardModel): ReactElement {
  const { ink, tints } = CARD_PALETTE;
  const { outline, facets } = gemPaths(visual.shape, GEM_SIZE);
  const nameSize = name.length > 14 ? 100 : 132;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "150px 90px 130px",
        background: tints[visual.family],
        color: ink,
        fontFamily: "Golos",
      }}
    >
      <div style={{ display: "flex", fontSize: 34, fontWeight: 600, letterSpacing: 3, textTransform: "uppercase" }}>мой тип</div>
      <svg width={GEM_SIZE} height={GEM_SIZE} viewBox={`-4 -4 ${GEM_SIZE + 8} ${GEM_SIZE + 8}`}>
        <path d={outline} fill="none" stroke={ink} strokeWidth={5} strokeLinejoin="round" />
        <path d={facets} fill="none" stroke={ink} strokeWidth={5} strokeLinejoin="round" opacity={0.45} />
      </svg>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 44 }}>
        <div
          style={{ display: "flex", fontFamily: "Cormorant", fontWeight: 300, fontSize: nameSize, lineHeight: 1.05, letterSpacing: -2, textAlign: "center" }}
        >
          {name}
        </div>
        <div style={{ display: "flex", fontSize: 38 }}>а какой у тебя? · grani-test.ru</div>
      </div>
    </div>
  );
}
```

```bash
pnpm vitest run apps/web/src/lib/type-visuals.test.ts apps/web/src/lib/card.test.tsx
```
Expected: PASS. Внешний вид карточки проверяется в Step 7.

Проверка сборки с карточкой — Task 10, Step 4.

- [ ] **Step 5: Маршрут карточки**

`apps/web/src/app/cards/[dir]/route.tsx`:
```tsx
import { typeName } from "@grani/core";
import { ImageResponse } from "next/og";
import { type NextRequest, NextResponse } from "next/server";
import { CARD_SIZE, cardElement, loadCardFonts } from "@/lib/card";
import { TYPE_VISUALS, dirToTypeCode } from "@/lib/type-visuals";

// Картинка зависит только от типа и формы названия — её можно долго кэшировать
const CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";

export async function GET(request: NextRequest, { params }: { params: Promise<{ dir: string }> }) {
  const { dir } = await params;
  const code = dirToTypeCode(dir);
  const visual = TYPE_VISUALS[dir];
  if (!code || !visual) return new NextResponse(null, { status: 404 });
  const feminine = request.nextUrl.searchParams.get("f") === "1";
  const name = typeName(code, feminine ? "female" : null);
  const image = new ImageResponse(cardElement({ name, visual }), { ...CARD_SIZE, fonts: await loadCardFonts() });
  image.headers.set("cache-control", CACHE_CONTROL);
  image.headers.set("content-disposition", `inline; filename="grani-${dir}.png"`);
  return image;
}
```

- [ ] **Step 6: Блок «поделиться» на странице результата**

`apps/web/src/app/result/[id]/ShareCard.tsx`:
```tsx
"use client";

import { useState } from "react";

export function ShareCard({ cardUrl, fileName, typeName }: { cardUrl: string; fileName: string; typeName: string }) {
  const [status, setStatus] = useState<string | null>(null);

  // Сторис принимают файл, а не ссылку: сначала пробуем поделиться картинкой, иначе — скачиваем её
  async function share() {
    setStatus(null);
    try {
      const blob = await (await fetch(cardUrl)).blob();
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Мой тип — ${typeName}` });
        return;
      }
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(link.href);
      setStatus("Картинка скачана — добавьте её в сторис.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("Не получилось подготовить картинку. Попробуйте ещё раз.");
    }
  }

  return (
    <section className="card card--paper stack" aria-labelledby="share">
      <p className="eyebrow">Для сторис</p>
      <h2 id="share">Карточка «мой тип»</h2>
      <img src={cardUrl} alt={`Карточка типа «${typeName}»`} width={270} height={480} style={{ borderRadius: "var(--radius)" }} />
      <button type="button" className="button" onClick={share}>
        Поделиться <span aria-hidden="true">→</span>
      </button>
      {status && (
        <p className="muted" role="status">
          {status}
        </p>
      )}
    </section>
  );
}
```

В `apps/web/src/app/result/[id]/page.tsx` заменить комментарий `{/* Карточка для сторис — Task 9 */}` на:
```tsx
        <ShareCard
          cardUrl={`/cards/${view.dir}${user.gender === "female" ? "?f=1" : ""}`}
          fileName={`grani-${view.dir}.png`}
          typeName={view.name}
        />
```
и добавить `import { ShareCard } from "./ShareCard";`.

Там же заменить комментарий `{/* Знак типа — Task 9 */}` на
```tsx
            <span className="type-gem" data-family={visual.family}>
              <TypeGem shape={visual.shape} size={60} />
            </span>
```
после `const view = buildResultView(...)` добавить
```tsx
  const visual = TYPE_VISUALS[view.dir];
  if (!visual) notFound();
```
и импорты `import { TypeGem } from "@/components/TypeGem";`, `import { TYPE_VISUALS } from "@/lib/type-visuals";`.

В `apps/web/src/app/globals.css` добавить плитку знака — тон по семье типа (светлее панели `card--2`, на которой стоит, остаётся фон страницы):
```css
.type-gem { display: grid; place-items: center; flex: none; width: 96px; height: 96px; border-radius: var(--radius); background: var(--bg); }
.type-gem[data-family="3"] { background: var(--surface-3); }
.type-gem[data-family="4"] { background: var(--surface-4); }
```

- [ ] **Step 7: Проверка в браузере**

С запущенными `pnpm dev:db` и `pnpm dev:web`:
1. Открыть `/cards/pmpp`, `/cards/mpmp?f=1`, `/cards/mmmm` — картинки 1080×1920, фон разного тона по семье, знак по центру, название антиквой не обрезано, в подписи видны и кириллица, и `grani-test.ru` (без квадратиков вместо букв). Сделать скриншоты карточек и показать пользователю.
2. `/cards/xxxx` → 404.
3. На странице результата блок карточки виден; «Поделиться» на десктопе скачивает `grani-<каталог>.png`.

- [ ] **Step 8: Тесты и коммит**

```bash
pnpm test && pnpm typecheck
git add apps/web/assets apps/web/src/lib/type-visuals.ts apps/web/src/lib/type-visuals.test.ts apps/web/src/lib/card.tsx apps/web/src/lib/card.test.tsx apps/web/src/components/TypeGem.tsx apps/web/src/app/globals.css apps/web/src/app/cards apps/web/src/app/result
git commit -m "feat(web): story card with type family tint and faceted sign, share or download from the result page"
```
