import { NextResponse } from "next/server";
import type { PairMapFailure } from "@grani/core";
import { PAIR_MAP_HEADERS, pairMapFailure, pairMapResponse } from "./pair-map-route";
import type { PairPdfSource } from "./pair-pdf/source";

export async function respondPairPdf(deps: { load: () => Promise<PairPdfSource | PairMapFailure>; render: (source: PairPdfSource) => Promise<Buffer>; check: (source: PairPdfSource) => Promise<PairMapFailure | null> }): Promise<NextResponse> {
  try {
    const source = await deps.load();
    if ("error" in source) return pairMapResponse(source);
    const bytes = await deps.render(source);
    const stale = await deps.check(source);
    if (stale) return pairMapResponse(stale);
    return new NextResponse(new Uint8Array(bytes), { headers: { ...PAIR_MAP_HEADERS, "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="grani-pair-map.pdf"', "Content-Length": String(bytes.byteLength) } });
  } catch { console.error("Pair PDF generation failed"); return pairMapFailure("pdf_failed", 500); }
}
