import { readFile } from "node:fs/promises";
import type { ReactElement } from "react";
import type { ManualCardModel } from "./manual-card";
import type { TypeFamily } from "./type-visuals";

export const CARD_SIZE = { width: 1080, height: 1920 } as const;

// gem и background — PNG камня типа и JPEG фона семьи в виде data URL, см. loadCardArt
export type CardModel = { name: string; keywords: readonly string[]; gem: string; background: string };
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

// Камень типа и фон семьи. Пути статические, как у шрифтов: иначе сборщик не положит файлы в standalone
const GEM_FILES: Record<string, URL> = {
  pppp: new URL("../../assets/card/gems/pppp.png", import.meta.url),
  pppm: new URL("../../assets/card/gems/pppm.png", import.meta.url),
  ppmp: new URL("../../assets/card/gems/ppmp.png", import.meta.url),
  ppmm: new URL("../../assets/card/gems/ppmm.png", import.meta.url),
  pmpp: new URL("../../assets/card/gems/pmpp.png", import.meta.url),
  pmpm: new URL("../../assets/card/gems/pmpm.png", import.meta.url),
  pmmp: new URL("../../assets/card/gems/pmmp.png", import.meta.url),
  pmmm: new URL("../../assets/card/gems/pmmm.png", import.meta.url),
  mppp: new URL("../../assets/card/gems/mppp.png", import.meta.url),
  mppm: new URL("../../assets/card/gems/mppm.png", import.meta.url),
  mpmp: new URL("../../assets/card/gems/mpmp.png", import.meta.url),
  mpmm: new URL("../../assets/card/gems/mpmm.png", import.meta.url),
  mmpp: new URL("../../assets/card/gems/mmpp.png", import.meta.url),
  mmpm: new URL("../../assets/card/gems/mmpm.png", import.meta.url),
  mmmp: new URL("../../assets/card/gems/mmmp.png", import.meta.url),
  mmmm: new URL("../../assets/card/gems/mmmm.png", import.meta.url),
};
const BACKGROUND_FILES: Record<TypeFamily, URL> = {
  1: new URL("../../assets/card/card-bg-family-1.jpg", import.meta.url),
  2: new URL("../../assets/card/card-bg-family-2.jpg", import.meta.url),
  3: new URL("../../assets/card/card-bg-family-3.jpg", import.meta.url),
  4: new URL("../../assets/card/card-bg-family-4.jpg", import.meta.url),
};
const artCache = new Map<string, Promise<string>>();

// satori читает PNG и JPEG, но не WebP: камни лежат PNG с прозрачностью, фоны JPEG
function imageDataUrl(file: URL): Promise<string> {
  const key = file.href;
  let cached = artCache.get(key);
  if (!cached) {
    cached = readFile(file).then((data) => `data:${file.pathname.endsWith(".png") ? "image/png" : "image/jpeg"};base64,${data.toString("base64")}`);
    artCache.set(key, cached);
  }
  return cached;
}

export async function loadCardArt(dir: string, family: TypeFamily): Promise<{ gem: string; background: string }> {
  const gemFile = GEM_FILES[dir];
  if (!gemFile) throw new Error(`No gem image for type ${dir}`);
  const [gem, background] = await Promise.all([imageDataUrl(gemFile), imageDataUrl(BACKGROUND_FILES[family])]);
  return { gem, background };
}

export function loadCardFonts(): Promise<CardFont[]> {
  fontsPromise ??= readCardFonts();
  return fontsPromise;
}

const nameSize = (name: string, sizes: readonly [number, number, number]) => (name.length > 16 ? sizes[2] : name.length > 11 ? sizes[1] : sizes[0]);

// Ночная карточка типа: цвета совпадают с ночными токенами сайта (docs/design/visual-direction.md)
export const NIGHT_CARD = { ink: "#EFE9DA", muted: "#A3B0A2", gold: "#CDB57B", base: "#0A1F17" } as const;

// Знак бренда из шапки сайта (BrandMark) одними сплошными цветами: satori не рисует градиенты внутри SVG надёжно
function NightLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <svg width={46} height={52} viewBox="0 0 100 114">
        <polygon points="50,2 98,30 98,84 50,112 2,84 2,30" fill="#E8BD3E" />
        <polygon points="50,6 94.5,32 94.5,82 50,108 5.5,82 5.5,32" fill="#0A7A48" />
        <polygon points="50,6 94.5,32 50,38 5.5,32" fill="#2EDC92" />
        <polygon points="94.5,32 94.5,82 76,70 76,44" fill="#12A566" />
        <polygon points="94.5,82 50,108 50,86 76,70" fill="#0B7C49" />
        <polygon points="50,108 5.5,82 24,70 50,86" fill="#1CC27B" />
        <polygon points="5.5,82 5.5,32 24,44 24,70" fill="#0A6A3F" />
        <polygon points="50,38 76,44 76,70 50,86 24,70 24,44" fill="#093F28" />
      </svg>
      <div style={{ display: "flex", fontFamily: "Cormorant", fontWeight: 300, fontSize: 54, color: NIGHT_CARD.ink }}>грани</div>
    </div>
  );
}

// Стеклянная «пилюля» черты на тёмном фоне
function NightPill({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "flex",
        padding: "16px 38px",
        borderRadius: 999,
        background: "rgba(7, 20, 14, 0.62)",
        border: "1.5px solid rgba(205, 181, 123, 0.42)",
        fontSize: 32,
        color: NIGHT_CARD.ink,
      }}
    >
      {text}
    </div>
  );
}

// Сторис: тёмный фон семьи, камень типа, под ним тип и черты по две в ряд, внизу адрес сайта
// satori требует явный display: flex у каждого контейнера с несколькими детьми
export function cardElement({ name, keywords, gem, background }: CardModel): ReactElement {
  const rows = [keywords.slice(0, 2), keywords.slice(2, 4)].filter((row) => row.length > 0);
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "92px 80px 96px",
        background: NIGHT_CARD.base,
        color: NIGHT_CARD.ink,
        fontFamily: "Golos",
      }}
    >
      <img src={background} width={CARD_SIZE.width} height={CARD_SIZE.height} alt="" style={{ position: "absolute", left: 0, top: 0 }} />
      <NightLogo />
      <div style={{ display: "flex", height: 170 }} />
      <img src={gem} width={680} height={680} alt="" />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26, marginTop: 8 }}>
        <div style={{ display: "flex", fontSize: 26, fontWeight: 600, letterSpacing: 10, textTransform: "uppercase", color: NIGHT_CARD.gold }}>мой тип</div>
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
                <NightPill key={word} text={word} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flex: 1 }} />
      <div style={{ display: "flex", width: 72, height: 2, marginBottom: 34, background: "rgba(205, 181, 123, 0.55)" }} />
      <div style={{ display: "flex", justifyContent: "center", fontSize: 30, letterSpacing: 1, color: NIGHT_CARD.muted }}>узнай свой тип · grani-test.ru</div>
    </div>
  );
}

export const MANUAL_CARD_PANEL = "#10291F";

// Ночная инструкция: фон семьи, камень типа и непрозрачные панели под текст.
export function manualCardElement({ typeName, lists, gem, background }: ManualCardModel & Pick<CardModel, "gem" | "background">): ReactElement {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "80px 72px 76px",
        background: NIGHT_CARD.base,
        color: NIGHT_CARD.ink,
        fontFamily: "Golos",
      }}
    >
      <img src={background} width={CARD_SIZE.width} height={CARD_SIZE.height} alt="" style={{ position: "absolute", left: 0, top: 0 }} />
      <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: "100%", height: "100%", background: "rgba(7,20,14,.86)" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 28, marginBottom: 28 }}>
        <NightLogo />
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 16 }}>
            <div style={{ display: "flex", fontFamily: "Cormorant", fontWeight: 300, fontSize: 52, lineHeight: 1.05, color: NIGHT_CARD.ink }}>
              Инструкция по применению меня
            </div>
            <div style={{ display: "flex", fontFamily: "Cormorant", fontWeight: 300, fontSize: nameSize(typeName, [104, 90, 80]), lineHeight: 1.05, letterSpacing: -2 }}>
              {typeName}
            </div>
          </div>
          <img src={gem} width={200} height={200} alt="" />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {lists.map((list, index) => (
          <div
            key={list.title}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              padding: "28px 40px",
              borderRadius: 24,
              background: MANUAL_CARD_PANEL,
              border: "1px solid rgba(205,181,123,.42)",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
              <div style={{ display: "flex", fontSize: 26, fontWeight: 600, letterSpacing: 2, color: NIGHT_CARD.gold }}>{`0${index + 1}`}</div>
              <div style={{ display: "flex", fontFamily: "Cormorant", fontWeight: 300, fontSize: 60, color: NIGHT_CARD.ink }}>{list.title}</div>
            </div>
            {list.items.map((item) => (
              <div key={item} style={{ display: "flex", gap: 16, fontSize: 36, lineHeight: 1.4, color: NIGHT_CARD.ink }}>
                <div style={{ display: "flex", color: NIGHT_CARD.gold }}>—</div>
                <div style={{ display: "flex", flex: 1 }}>{item}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 28, fontSize: 30, letterSpacing: 1, color: NIGHT_CARD.muted }}>узнай свой тип · grani-test.ru</div>
    </div>
  );
}
