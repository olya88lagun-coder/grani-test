import { NextResponse, type NextRequest } from "next/server";
import { authorizePairMap, pairMapResponse, readPairMapBody } from "@/server/pair-map-route";
import { changePairMap, getPairMap } from "@/server/pair-map-service";
import { pairMapLimiter } from "@/server/rate-limit";

export const runtime = "nodejs";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await authorizePairMap(request, { mutating: false, limiter: pairMapLimiter });
  if (context instanceof NextResponse) return context;
  return pairMapResponse(await getPairMap(context, { pairId: (await params).id, userId: context.user.id }));
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await authorizePairMap(request, { mutating: true, limiter: pairMapLimiter });
  if (context instanceof NextResponse) return context;
  const command = await readPairMapBody(request);
  if (command instanceof NextResponse) return command;
  return pairMapResponse(await changePairMap(context, { pairId: (await params).id, userId: context.user.id, command }));
}
