# Task 9: Карточка «мой тип» для сторис

**Files:**
- Create: `apps/web/assets/fonts/Manrope-SemiBold.ttf`, `apps/web/assets/fonts/PlayfairDisplay-SemiBoldItalic.ttf` (копии из wishlist)
- Create: `apps/web/src/lib/type-visuals.ts`, `apps/web/src/lib/card.tsx`, `apps/web/src/app/cards/[dir]/route.tsx`, `apps/web/src/app/result/[id]/ShareCard.tsx`
- Modify: `apps/web/src/app/result/[id]/page.tsx` (блок карточки)
- Test: `apps/web/src/lib/type-visuals.test.ts`, `apps/web/src/lib/card.test.tsx`

**Interfaces:**
- Consumes: `TypeCode`, `ALL_TYPE_CODES`, `typeName` (`@grani/core`); `TYPE_DIRS`, `typeCodeToDir` (`@grani/content`); таблица цветов и форм и выбранное направление из `docs/design/visual-direction.md` (Task 1); `ResultView` (Task 8).
- Produces:
  ```ts
  // type-visuals.ts
  type TypeShape = "diamond" | "hexagon" | "triangle" | "circle" | "star" | "square" | "pentagon" | "drop";
  type TypeVisual = { color: string; ink: string; shape: TypeShape };
  const TYPE_VISUALS: Readonly<Record<string, TypeVisual>>; // ключ — каталог типа (pppp…mmmm)
  function dirToTypeCode(dir: string): TypeCode | null;
  function contrastRatio(foreground: string, background: string): number;
  function shapePath(shape: TypeShape, size: number): string; // SVG path в квадрате size×size
  // card.tsx
  const CARD_SIZE = { width: 1080, height: 1920 };
  type CardModel = { name: string; visual: TypeVisual };
  function cardElement(model: CardModel): ReactElement;
  function loadCardFonts(): Promise<CardFont[]>;
  // GET /cards/<dir>[?f=1] → image/png 1080×1920
  ```

Карточка (раздел 4.5 спецификации) не содержит личных данных: только название типа, его цвет и форма, подпись «мой тип» и адрес сайта. Поэтому она рисуется по коду типа и открыта без входа — ссылку можно вставить в сторис или переслать. `?f=1` даёт женскую форму названия, если она есть. Неизвестный каталог → 404.

- [ ] **Step 1: Шрифты**

```bash
mkdir -p /c/dev/grani-test/apps/web/assets/fonts
cp /c/dev/wishlist/apps/web/assets/fonts/Manrope-SemiBold.ttf /c/dev/wishlist/apps/web/assets/fonts/PlayfairDisplay-SemiBoldItalic.ttf /c/dev/grani-test/apps/web/assets/fonts/
```

Шрифты под лицензией OFL — копирование и встраивание в картинки разрешены.

- [ ] **Step 2: Тесты (падают)**

`apps/web/src/lib/type-visuals.test.ts`:
```ts
import { ALL_TYPE_CODES } from "@grani/core";
import { TYPE_DIRS, typeCodeToDir } from "@grani/content";
import { describe, expect, test } from "vitest";
import { TYPE_VISUALS, contrastRatio, dirToTypeCode, shapePath } from "./type-visuals";

describe("TYPE_VISUALS", () => {
  test("has a visual for every type and nothing else", () => {
    expect(Object.keys(TYPE_VISUALS).sort()).toEqual([...TYPE_DIRS].sort());
  });

  test.each(Object.entries(TYPE_VISUALS))("%s keeps text readable on its color", (_dir, visual) => {
    expect(contrastRatio(visual.ink, visual.color)).toBeGreaterThanOrEqual(4.5);
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

test("every shape has a closed path", () => {
  for (const visual of Object.values(TYPE_VISUALS)) {
    expect(shapePath(visual.shape, 100)).toMatch(/^M.*Z$/);
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
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run apps/web/src/lib/type-visuals.test.ts apps/web/src/lib/card.test.tsx
```
Expected: FAIL — модулей нет.

- [ ] **Step 3: Цвета и формы типов**

`apps/web/src/lib/type-visuals.ts` — значения `color`, `ink`, `shape` взять из таблицы в `docs/design/visual-direction.md` (итог Task 1); ниже — исходная таблица Task 1:
```ts
import { ALL_TYPE_CODES, type TypeCode } from "@grani/core";
import { typeCodeToDir } from "@grani/content";

export type TypeShape = "diamond" | "hexagon" | "triangle" | "circle" | "star" | "square" | "pentagon" | "drop";
export type TypeVisual = { color: string; ink: string; shape: TypeShape };

export const TYPE_VISUALS: Readonly<Record<string, TypeVisual>> = {
  pppp: { color: "#F59E0B", ink: "#1F1D1A", shape: "star" },
  pppm: { color: "#DC2626", ink: "#FFFFFF", shape: "triangle" },
  ppmp: { color: "#15803D", ink: "#FFFFFF", shape: "hexagon" },
  ppmm: { color: "#1D4ED8", ink: "#FFFFFF", shape: "square" },
  pmpp: { color: "#F97316", ink: "#1F1D1A", shape: "star" },
  pmpm: { color: "#BE185D", ink: "#FFFFFF", shape: "triangle" },
  pmmp: { color: "#7C3AED", ink: "#FFFFFF", shape: "drop" },
  pmmm: { color: "#0E7490", ink: "#FFFFFF", shape: "diamond" },
  mppp: { color: "#65A30D", ink: "#1F1D1A", shape: "hexagon" },
  mppm: { color: "#B91C1C", ink: "#FFFFFF", shape: "pentagon" },
  mpmp: { color: "#0F766E", ink: "#FFFFFF", shape: "circle" },
  mpmm: { color: "#475569", ink: "#FFFFFF", shape: "square" },
  mmpp: { color: "#EC4899", ink: "#1F1D1A", shape: "circle" },
  mmpm: { color: "#C2410C", ink: "#FFFFFF", shape: "diamond" },
  mmmp: { color: "#0EA5E9", ink: "#1F1D1A", shape: "drop" },
  mmmm: { color: "#6B7280", ink: "#FFFFFF", shape: "pentagon" },
};

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

function polygon(points: readonly (readonly [number, number])[]): string {
  return `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")} Z`;
}

function regular(sides: number, size: number, rotation: number, innerRatio?: number): string {
  const center = size / 2;
  const count = innerRatio === undefined ? sides : sides * 2;
  const points = Array.from({ length: count }, (_, i) => {
    const radius = innerRatio !== undefined && i % 2 === 1 ? center * innerRatio : center;
    const angle = rotation + (i * 2 * Math.PI) / count;
    return [center + radius * Math.cos(angle), center + radius * Math.sin(angle)] as const;
  });
  return polygon(points);
}

const UP = -Math.PI / 2;

export function shapePath(shape: TypeShape, size: number): string {
  const half = size / 2;
  switch (shape) {
    case "square":
      return polygon([[0, 0], [size, 0], [size, size], [0, size]]);
    case "diamond":
      return polygon([[half, 0], [size, half], [half, size], [0, half]]);
    case "triangle":
      return regular(3, size, UP);
    case "pentagon":
      return regular(5, size, UP);
    case "hexagon":
      return regular(6, size, 0);
    case "star":
      return regular(5, size, UP, 0.45);
    case "circle":
      return `M${half} 0 A${half} ${half} 0 1 1 ${half} ${size} A${half} ${half} 0 1 1 ${half} 0 Z`;
    case "drop":
      return `M${half} 0 C${size * 0.85} ${size * 0.4} ${size} ${size * 0.6} ${size} ${size * 0.68} A${half} ${half * 0.64} 0 0 1 0 ${size * 0.68} C0 ${size * 0.6} ${size * 0.15} ${size * 0.4} ${half} 0 Z`;
  }
}
```

- [ ] **Step 4: Карточка**

`apps/web/src/lib/card.tsx`:
```tsx
import { readFile } from "node:fs/promises";
import type { ReactElement } from "react";
import { shapePath, type TypeVisual } from "./type-visuals";

export const CARD_SIZE = { width: 1080, height: 1920 } as const;

export type CardModel = { name: string; visual: TypeVisual };
export type CardFont = { name: string; data: Buffer; weight: 600; style: "normal" | "italic" };

// Пути статические: так сборщик Next кладёт шрифты рядом с кодом и они попадают в standalone-сборку
const PLAYFAIR_URL = new URL("../../assets/fonts/PlayfairDisplay-SemiBoldItalic.ttf", import.meta.url);
const MANROPE_URL = new URL("../../assets/fonts/Manrope-SemiBold.ttf", import.meta.url);

// Шрифт названия — --font-display выбранного направления (Task 1): "Playfair" для «Бумаги», "Manrope" для остальных
const DISPLAY_FONT = "Manrope";

export async function loadCardFonts(): Promise<CardFont[]> {
  const [playfair, manrope] = await Promise.all([readFile(PLAYFAIR_URL), readFile(MANROPE_URL)]);
  return [
    { name: "Playfair", data: playfair, weight: 600, style: "italic" },
    { name: "Manrope", data: manrope, weight: 600, style: "normal" },
  ];
}

const SHAPE_SIZE = 560;

// satori требует явный display: flex у каждого контейнера с несколькими детьми
export function cardElement({ name, visual }: CardModel): ReactElement {
  const nameSize = name.length > 14 ? 104 : 136;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "160px 96px 140px",
        background: visual.color,
        color: visual.ink,
        fontFamily: "Manrope",
      }}
    >
      <div style={{ display: "flex", fontSize: 48, letterSpacing: 6, textTransform: "uppercase", opacity: 0.85 }}>
        мой тип
      </div>
      <svg width={SHAPE_SIZE} height={SHAPE_SIZE} viewBox={`0 0 ${SHAPE_SIZE} ${SHAPE_SIZE}`}>
        <path d={shapePath(visual.shape, SHAPE_SIZE)} fill={visual.ink} fillOpacity={0.9} />
      </svg>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 48 }}>
        <div style={{ display: "flex", fontFamily: DISPLAY_FONT, fontSize: nameSize, lineHeight: 1.05, textAlign: "center" }}>
          {name}
        </div>
        <div style={{ display: "flex", fontSize: 44, opacity: 0.85 }}>а какой у тебя? grani-test.ru</div>
      </div>
    </div>
  );
}
```

```bash
pnpm vitest run apps/web/src/lib/type-visuals.test.ts apps/web/src/lib/card.test.tsx
```
Expected: PASS. Внешний вид карточки проверяется в Step 7.

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
    <section className="card stack" aria-labelledby="share">
      <h2 id="share">Карточка для сторис</h2>
      <img src={cardUrl} alt={`Карточка типа «${typeName}»`} width={270} height={480} style={{ borderRadius: "var(--radius)" }} />
      <button type="button" className="button" onClick={share}>
        Поделиться
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

- [ ] **Step 7: Проверка в браузере**

С запущенными `pnpm dev:db` и `pnpm dev:web`:
1. Открыть `/cards/pmpp`, `/cards/mpmp?f=1`, `/cards/pppp` — картинки 1080×1920, название не обрезано, форма по центру, текст читается. Сделать скриншот двух карточек и показать пользователю.
2. `/cards/xxxx` → 404.
3. На странице результата блок карточки виден; «Поделиться» на десктопе скачивает `grani-<каталог>.png`.

- [ ] **Step 8: Тесты и коммит**

```bash
pnpm test && pnpm typecheck
git add apps/web/assets apps/web/src/lib/type-visuals.ts apps/web/src/lib/type-visuals.test.ts apps/web/src/lib/card.tsx apps/web/src/lib/card.test.tsx apps/web/src/app/cards apps/web/src/app/result
git commit -m "feat(web): story card for the type with colors and shapes, share or download from the result page"
```
