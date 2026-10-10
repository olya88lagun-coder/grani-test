import { Font, renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { fileURLToPath } from "node:url";
import type { ReactElement } from "react";

// Pass strings to Node's URL conversion: webpack can supply a different URL class.
const regular = fileURLToPath(new URL("../../../assets/pdf/GolosText-400.ttf", import.meta.url).toString());
const semibold = fileURLToPath(new URL("../../../assets/pdf/GolosText-600.ttf", import.meta.url).toString());
const title = fileURLToPath(new URL("../../../assets/pdf/CormorantGaramond-Light.ttf", import.meta.url).toString());
const emoji = fileURLToPath(new URL("../../../assets/pdf/NotoEmoji-400.ttf", import.meta.url).toString());

async function registerFreshFonts() {
  // Loaded fontkit glyphs are mutable: reusing them corrupts subsequent ToUnicode maps.
  Font.clear();
  Font.register({ family: "Helvetica", fonts: [{ src: "Helvetica", fontWeight: 400 }, { src: "Helvetica-Bold", fontWeight: 700 }] });
  Font.register({ family: "PairGolos", fonts: [{ src: regular, fontWeight: 400 }, { src: semibold, fontWeight: 600 }] });
  Font.register({ family: "PairCormorant", src: title });
  Font.register({ family: "PairEmoji", src: emoji });
  // textkit always appends Helvetica as its final fallback; clear() removes its eager data.
  await Promise.all([400,700].map(fontWeight => Font.load({fontFamily:"Helvetica",fontWeight})));
  Font.registerHyphenationCallback(word => {
    const points = Array.from(word);
    return points.length > 22 ? Array.from({ length: Math.ceil(points.length / 12) }, (_, i) => points.slice(i * 12, i * 12 + 12).join("")) : [word];
  });
}
let pending: Promise<void> = Promise.resolve();

export async function renderPairPdf(document: ReactElement<DocumentProps>): Promise<Buffer> {
  // Serialize this process's exports because the renderer owns one global Font store.
  const result = pending.then(async () => { await registerFreshFonts(); return renderToBuffer(document); });
  pending = result.then(() => undefined, () => undefined);
  return result;
}
