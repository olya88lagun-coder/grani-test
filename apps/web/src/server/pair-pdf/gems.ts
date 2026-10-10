import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gemAssetDir, type GemAssetDir } from "@/lib/gem-assets";

// Literal URLs are necessary: Turbopack incorrectly folds a dynamic URL template to its first asset.
const files: Record<GemAssetDir, URL> = {
  pppp:new URL("../../../assets/pdf/gems/pppp.png",import.meta.url),
  pppm:new URL("../../../assets/pdf/gems/pppm.png",import.meta.url),
  ppmp:new URL("../../../assets/pdf/gems/ppmp.png",import.meta.url),
  ppmm:new URL("../../../assets/pdf/gems/ppmm.png",import.meta.url),
  pmpp:new URL("../../../assets/pdf/gems/pmpp.png",import.meta.url),
  pmpm:new URL("../../../assets/pdf/gems/pmpm.png",import.meta.url),
  pmmp:new URL("../../../assets/pdf/gems/pmmp.png",import.meta.url),
  pmmm:new URL("../../../assets/pdf/gems/pmmm.png",import.meta.url),
  mppp:new URL("../../../assets/pdf/gems/mppp.png",import.meta.url),
  mppm:new URL("../../../assets/pdf/gems/mppm.png",import.meta.url),
  mpmp:new URL("../../../assets/pdf/gems/mpmp.png",import.meta.url),
  mpmm:new URL("../../../assets/pdf/gems/mpmm.png",import.meta.url),
  mmpp:new URL("../../../assets/pdf/gems/mmpp.png",import.meta.url),
  mmpm:new URL("../../../assets/pdf/gems/mmpm.png",import.meta.url),
  mmmp:new URL("../../../assets/pdf/gems/mmmp.png",import.meta.url),
  mmmm:new URL("../../../assets/pdf/gems/mmmm.png",import.meta.url),
};
export const pairPdfGem = (dir:string):Buffer => readFileSync(fileURLToPath(files[gemAssetDir(dir)].toString()));
