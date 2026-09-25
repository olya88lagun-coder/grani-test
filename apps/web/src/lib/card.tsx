import { readFile } from "node:fs/promises";
import type { ReactElement } from "react";
import type { ManualCardModel } from "./manual-card";
import { gemPaths, type TypeVisual } from "./type-visuals";

export const CARD_SIZE = { width: 1080, height: 1920 } as const;

export type CardModel = { name: string; visual: TypeVisual; keywords: readonly string[] };
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

// Палитра главной: молочный свет сверху, шалфей снизу, глубокий хвойный — текст и грани
const CARD_INK = "#0a130b";
const CARD_GREEN = "#0f3e17";
const CARD_MUTED = "#5d685c";
// Самый светлый и самый тёмный тон фона — для проверки контраста текста
export const CARD_COLORS = { ink: CARD_INK, green: CARD_GREEN, muted: CARD_MUTED, backgroundTop: "#f8f4e7", backgroundBottom: "#e1eada" } as const;
const CARD_BACKGROUND = [
  "radial-gradient(circle at 84% 10%, rgba(255, 244, 212, 0.95) 0%, rgba(255, 244, 212, 0) 42%)",
  "radial-gradient(circle at 8% 62%, rgba(214, 226, 199, 0.75) 0%, rgba(214, 226, 199, 0) 46%)",
  "linear-gradient(180deg, #f8f4e7 0%, #f0f3e6 52%, #e1eada 100%)",
].join(", ");
const PANEL = { background: "rgba(255, 253, 244, 0.82)", border: "2px solid rgba(15, 62, 23, 0.1)", borderRadius: 36 } as const;

// Грань типа с заливкой: светлая вершина, шалфей, глубокий зелёный внизу
function FilledGem({ visual, size }: { visual: TypeVisual; size: number }) {
  const { outline, facets } = gemPaths(visual.shape, size);
  const id = `gem-${visual.shape}`;
  return (
    <svg width={size} height={size} viewBox={`-6 -6 ${size + 12} ${size + 12}`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbf8e9" />
          <stop offset="0.4" stopColor="#bcd4aa" />
          <stop offset="0.78" stopColor="#4b7a50" />
          <stop offset="1" stopColor="#123f1d" />
        </linearGradient>
      </defs>
      <path d={outline} fill={`url(#${id})`} stroke={CARD_GREEN} strokeWidth={size / 90} strokeLinejoin="round" />
      <path d={facets} fill="none" stroke="#fffdf4" strokeWidth={size / 110} strokeLinejoin="round" opacity={0.7} />
    </svg>
  );
}

function CardLogo() {
  const { outline, facets } = gemPaths("hexagon", 52);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <svg width={52} height={52} viewBox="-3 -3 58 58">
        <path d={outline} fill="none" stroke={CARD_GREEN} strokeWidth={2.5} strokeLinejoin="round" />
        <path d={facets} fill="none" stroke={CARD_GREEN} strokeWidth={2.5} strokeLinejoin="round" opacity={0.45} />
      </svg>
      <div style={{ display: "flex", fontFamily: "Cormorant", fontWeight: 300, fontSize: 60, color: CARD_INK }}>грани</div>
    </div>
  );
}

function CardFooter({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: 34, borderTop: "2px solid rgba(15, 62, 23, 0.14)", fontSize: 34, color: CARD_GREEN }}>
      {text}
    </div>
  );
}

const nameSize = (name: string, sizes: readonly [number, number, number]) => (name.length > 16 ? sizes[2] : name.length > 11 ? sizes[1] : sizes[0]);

const GEM_SIZE = 580;

// satori требует явный display: flex у каждого контейнера с несколькими детьми
export function cardElement({ name, visual, keywords }: CardModel): ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "100px 90px 96px",
        backgroundImage: CARD_BACKGROUND,
        color: CARD_INK,
        fontFamily: "Golos",
      }}
    >
      <CardLogo />
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 800,
            height: 740,
            backgroundImage: "radial-gradient(circle at 50% 50%, rgba(255, 253, 236, 0.95) 0%, rgba(255, 253, 236, 0) 62%)",
          }}
        >
          <FilledGem visual={visual} size={GEM_SIZE} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 600, letterSpacing: 7, textTransform: "uppercase", color: CARD_MUTED }}>мой тип</div>
        <div
          style={{
            display: "flex",
            fontFamily: "Cormorant",
            fontWeight: 300,
            fontSize: nameSize(name, [150, 118, 98]),
            lineHeight: 1,
            letterSpacing: -2,
            textAlign: "center",
          }}
        >
          {name}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 18, maxWidth: 860, marginTop: 14 }}>
          {keywords.map((word) => (
            <div key={word} style={{ display: "flex", padding: "16px 30px", fontSize: 34, color: CARD_GREEN, ...PANEL, borderRadius: 999 }}>
              {word}
            </div>
          ))}
        </div>
      </div>
      <CardFooter text="узнай свой тип · grani-test.ru" />
    </div>
  );
}

// Значки разделов инструкции: лист — работа, реплика — спор, молния — раздражение
const MANUAL_ICONS: readonly string[] = [
  "M5 19C5 10 10 5 19 5c0 9-5 14-14 14Zm0 0 8-8",
  "M4 5h16v11H10l-6 4V5Z",
  "M13 3 5 14h6l-1 7 8-11h-6l1-7Z",
];

function ManualIcon({ path }: { path: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 76, height: 76, borderRadius: 999, background: "#e3ebd9" }}>
      <svg width={40} height={40} viewBox="0 0 24 24">
        <path d={path} fill="none" stroke={CARD_GREEN} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function manualCardElement({ typeName, visual, lists }: ManualCardModel): ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "96px 84px 92px",
        backgroundImage: CARD_BACKGROUND,
        color: CARD_INK,
        fontFamily: "Golos",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
          <CardLogo />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", fontFamily: "Cormorant", fontWeight: 300, fontSize: 54, lineHeight: 1.05, color: CARD_GREEN }}>
              Инструкция по применению меня
            </div>
            <div style={{ display: "flex", fontFamily: "Cormorant", fontWeight: 300, fontSize: nameSize(typeName, [124, 104, 88]), lineHeight: 1, letterSpacing: -2 }}>
              {typeName}
            </div>
          </div>
        </div>
        <FilledGem visual={visual} size={170} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        {lists.map((list, index) => (
          <div key={list.title} style={{ display: "flex", flexDirection: "column", gap: 16, padding: "34px 40px", ...PANEL }}>
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <ManualIcon path={MANUAL_ICONS[index] ?? MANUAL_ICONS[0]!} />
              <div style={{ display: "flex", fontFamily: "Cormorant", fontWeight: 300, fontSize: 58, color: CARD_INK }}>{list.title}</div>
            </div>
            {list.items.map((item) => (
              <div key={item} style={{ display: "flex", gap: 16, fontSize: 36, lineHeight: 1.36 }}>
                <div style={{ display: "flex", color: CARD_GREEN }}>—</div>
                <div style={{ display: "flex", flex: 1 }}>{item}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <CardFooter text="узнай свой тип · grani-test.ru" />
    </div>
  );
}
