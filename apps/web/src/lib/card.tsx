import { readFile } from "node:fs/promises";
import type { ReactElement } from "react";
import { CARD_PALETTE, gemPaths, type TypeVisual } from "./type-visuals";

export const CARD_SIZE = { width: 1080, height: 1920 } as const;

export type CardModel = { name: string; visual: TypeVisual };
export type CardFont = { name: string; data: Buffer; weight: 300 | 400 | 600; style: "normal" };

// Пути статические и читаются напрямую: так сборщик Next видит каждый файл и кладёт в standalone-сборку только их.
// Кириллица и латиница у Fontsource в разных файлах — подключаем оба под одним именем.
const CORMORANT_CYRILLIC = new URL("../../assets/fonts/cormorant-garamond-cyrillic-300-normal.woff", import.meta.url);
const CORMORANT_LATIN = new URL("../../assets/fonts/cormorant-garamond-latin-300-normal.woff", import.meta.url);
const GOLOS_CYRILLIC_400 = new URL("../../assets/fonts/golos-text-cyrillic-400-normal.woff", import.meta.url);
const GOLOS_LATIN_400 = new URL("../../assets/fonts/golos-text-latin-400-normal.woff", import.meta.url);
const GOLOS_CYRILLIC_600 = new URL("../../assets/fonts/golos-text-cyrillic-600-normal.woff", import.meta.url);
const GOLOS_LATIN_600 = new URL("../../assets/fonts/golos-text-latin-600-normal.woff", import.meta.url);

async function readCardFonts(): Promise<CardFont[]> {
  const [cormorantCyrillic, cormorantLatin, golosCyrillic400, golosLatin400, golosCyrillic600, golosLatin600] = await Promise.all([
    readFile(CORMORANT_CYRILLIC),
    readFile(CORMORANT_LATIN),
    readFile(GOLOS_CYRILLIC_400),
    readFile(GOLOS_LATIN_400),
    readFile(GOLOS_CYRILLIC_600),
    readFile(GOLOS_LATIN_600),
  ]);
  return [
    { name: "Cormorant", weight: 300, style: "normal", data: cormorantCyrillic },
    { name: "Cormorant", weight: 300, style: "normal", data: cormorantLatin },
    { name: "Golos", weight: 400, style: "normal", data: golosCyrillic400 },
    { name: "Golos", weight: 400, style: "normal", data: golosLatin400 },
    { name: "Golos", weight: 600, style: "normal", data: golosCyrillic600 },
    { name: "Golos", weight: 600, style: "normal", data: golosLatin600 },
  ];
}

let fontsPromise: Promise<CardFont[]> | undefined;

export function loadCardFonts(): Promise<CardFont[]> {
  fontsPromise ??= readCardFonts();
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
