import { NextResponse, type NextRequest } from "next/server";
import { authorizeTogether } from "@/server/together-route";
import { getTogetherSpaceView } from "@/server/together-service";

export async function GET(request: NextRequest) {
  const context = await authorizeTogether(request, { mutating: false });
  if (context instanceof NextResponse) return context;
  const space = await getTogetherSpaceView(context.deps, context.user.id);
  return NextResponse.json({ ok: true, space }, { headers: { "cache-control": "no-store" } });
}
