import { Font, renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { fileURLToPath } from "node:url";
import type { ReactElement } from "react";

// Pass strings to Node's URL conversion: webpack can supply a different URL class.
const regular = fileURLToPath(new URL("../../../assets/pdf/GolosText-400.ttf", import.meta.url).toString());
const semibold = fileURLToPath(new URL("../../../assets/pdf/GolosText-600.ttf", import.meta.url).toString());
const title = fileURLToPath(new URL("../../../assets/pdf/CormorantGaramond-Light.ttf", import.meta.url).toString());

Font.register({ family: "PairGolos", fonts: [{ src: regular, fontWeight: 400 }, { src: semibold, fontWeight: 600 }] });
Font.register({ family: "PairCormorant", src: title });
// Break long user-written tokens safely rather than silently clipping their text.
Font.registerHyphenationCallback(word => Array.from(word));

export async function renderPairPdf(document: ReactElement<DocumentProps>): Promise<Buffer> {
  return renderToBuffer(document);
}
