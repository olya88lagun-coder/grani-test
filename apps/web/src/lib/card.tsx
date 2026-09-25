import { readFile } from "node:fs/promises";
import type { ReactElement } from "react";
import type { ManualCardModel } from "./manual-card";
import { gemPaths } from "./type-visuals";

export const CARD_SIZE = { width: 1080, height: 1920 } as const;

// crystal — PNG кристалла главной в виде data URL, см. loadCardCrystal
export type CardModel = { name: string; keywords: readonly string[]; crystal: string };
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

// Объёмный кристалл главной, заранее уменьшенный до ширины карточки: satori берёт картинки как data URL
const CRYSTAL = new URL("../../assets/card/crystal.png", import.meta.url);
let crystalPromise: Promise<string> | undefined;

export function loadCardCrystal(): Promise<string> {
  crystalPromise ??= readFile(CRYSTAL).then((data) => `data:image/png;base64,${data.toString("base64")}`);
  return crystalPromise;
}

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
// Диагональные лучи света поверх фона — как солнце через окно атриума на главной
const CARD_RAYS = [
  "linear-gradient(118deg, rgba(255, 255, 255, 0) 24%, rgba(255, 251, 232, 0.6) 34%, rgba(255, 255, 255, 0) 44%)",
  "linear-gradient(118deg, rgba(255, 255, 255, 0) 50%, rgba(255, 251, 232, 0.4) 57%, rgba(255, 255, 255, 0) 64%)",
].join(", ");

function CardLogo() {
  const { outline, facets } = gemPaths("hexagon", 44);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg width={44} height={44} viewBox="-3 -3 50 50">
        <path d={outline} fill="none" stroke={CARD_GREEN} strokeWidth={2.2} strokeLinejoin="round" />
        <path d={facets} fill="none" stroke={CARD_GREEN} strokeWidth={2.2} strokeLinejoin="round" opacity={0.45} />
      </svg>
      <div style={{ display: "flex", fontFamily: "Cormorant", fontWeight: 300, fontSize: 50, color: CARD_INK }}>грани</div>
    </div>
  );
}

function CardFooter({ text }: { text: string }) {
  return <div style={{ display: "flex", justifyContent: "center", fontSize: 30, letterSpacing: 1, color: CARD_MUTED }}>{text}</div>;
}

const nameSize = (name: string, sizes: readonly [number, number, number]) => (name.length > 16 ? sizes[2] : name.length > 11 ? sizes[1] : sizes[0]);

const CRYSTAL_SIZE = { width: 600, height: 702 } as const;

// Мягкая светлая «пилюля» черты — как теги на странице результата
function TraitPill({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "flex",
        padding: "16px 38px",
        borderRadius: 999,
        background: "rgba(255, 255, 255, 0.72)",
        border: "1.5px solid rgba(15, 62, 23, 0.12)",
        boxShadow: "0 10px 26px rgba(20, 47, 23, 0.07)",
        fontSize: 32,
        color: CARD_INK,
      }}
    >
      {text}
    </div>
  );
}

// Постер: кристалл со светом и тенью, под ним тип и черты по две в ряд, внизу адрес сайта
// satori требует явный display: flex у каждого контейнера с несколькими детьми
export function cardElement({ name, keywords, crystal }: CardModel): ReactElement {
  const rows = [keywords.slice(0, 2), keywords.slice(2, 4)].filter((row) => row.length > 0);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "92px 80px 96px",
        backgroundImage: `${CARD_RAYS}, ${CARD_BACKGROUND}`,
        color: CARD_INK,
        fontFamily: "Golos",
      }}
    >
      <CardLogo />
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 1000,
          height: 900,
          marginTop: 12,
          backgroundImage: "radial-gradient(circle at 50% 46%, rgba(255, 253, 236, 1) 0%, rgba(255, 253, 236, 0.7) 28%, rgba(255, 253, 236, 0) 56%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 250,
            bottom: 40,
            width: 500,
            height: 90,
            backgroundImage: "radial-gradient(ellipse at 50% 50%, rgba(30, 64, 32, 0.28) 0%, rgba(30, 64, 32, 0.1) 40%, rgba(30, 64, 32, 0) 70%)",
          }}
        />
        <img src={crystal} width={CRYSTAL_SIZE.width} height={CRYSTAL_SIZE.height} alt="" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26, marginTop: 8 }}>
        <div style={{ display: "flex", fontSize: 26, fontWeight: 600, letterSpacing: 10, textTransform: "uppercase", color: CARD_MUTED }}>мой тип</div>
        <div
          style={{
            display: "flex",
            fontFamily: "Cormorant",
            fontWeight: 300,
            fontSize: nameSize(name, [168, 132, 108]),
            lineHeight: 0.95,
            letterSpacing: -3,
            textAlign: "center",
          }}
        >
          {name}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, marginTop: 18 }}>
          {rows.map((row) => (
            <div key={row.join()} style={{ display: "flex", gap: 18 }}>
              {row.map((word) => (
                <TraitPill key={word} text={word} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flex: 1 }} />
      <div style={{ display: "flex", width: 72, height: 2, marginBottom: 34, background: "rgba(15, 62, 23, 0.25)" }} />
      <CardFooter text="узнай свой тип · grani-test.ru" />
    </div>
  );
}

// Разделы инструкции — почти белые панели с номером: крупный тёмный текст без лишних деталей
export function manualCardElement({ typeName, lists }: ManualCardModel): ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "88px 72px 80px",
        backgroundImage: `${CARD_RAYS}, ${CARD_BACKGROUND}`,
        color: CARD_INK,
        fontFamily: "Golos",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        <CardLogo />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", fontFamily: "Cormorant", fontWeight: 300, fontSize: 52, lineHeight: 1.05, color: CARD_GREEN }}>
            Инструкция по применению меня
          </div>
          <div style={{ display: "flex", fontFamily: "Cormorant", fontWeight: 300, fontSize: nameSize(typeName, [120, 100, 86]), lineHeight: 1, letterSpacing: -2 }}>
            {typeName}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {lists.map((list, index) => (
          <div
            key={list.title}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              padding: "32px 40px",
              borderRadius: 32,
              background: "rgba(255, 255, 255, 0.92)",
              boxShadow: "0 16px 40px rgba(20, 47, 23, 0.08)",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
              <div style={{ display: "flex", fontSize: 26, fontWeight: 600, letterSpacing: 2, color: "#7a9a70" }}>{`0${index + 1}`}</div>
              <div style={{ display: "flex", fontFamily: "Cormorant", fontWeight: 300, fontSize: 60, color: CARD_GREEN }}>{list.title}</div>
            </div>
            {list.items.map((item) => (
              <div key={item} style={{ display: "flex", gap: 16, fontSize: 39, lineHeight: 1.32, color: CARD_INK }}>
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
