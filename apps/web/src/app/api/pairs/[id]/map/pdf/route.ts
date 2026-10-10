import { NextResponse, type NextRequest } from "next/server";
import { authorizePairMap } from "@/server/pair-map-route";
import { respondPairPdf } from "@/server/pair-pdf-response";
import { assertPairPdfSnapshotCurrent, loadPairPdfSource } from "@/server/pair-pdf/source";
import { buildPairPdfDocument } from "@/server/pair-pdf/document";
import { renderPairPdf } from "@/server/pair-pdf/render";
import { pairPdfLimiter } from "@/server/rate-limit";

export const runtime = "nodejs";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await authorizePairMap(request, { mutating: false, limiter: pairPdfLimiter });
  if (context instanceof NextResponse) return context;
  const actor = { pairId: (await params).id, userId: context.user.id, now: context.now() };
  return respondPairPdf({ load: () => loadPairPdfSource(context.db, { ...actor, includeAnswers: request.nextUrl.searchParams.get("includeAnswers") === "1" }),
    render: source => renderPairPdf(buildPairPdfDocument(source)),
    check: source => assertPairPdfSnapshotCurrent(context.db, { ...actor, now: context.now() }, source) });
}
