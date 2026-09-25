import { typeName } from "@grani/core";
import { ImageResponse } from "next/og";
import { type NextRequest, NextResponse } from "next/server";
import { CARD_SIZE, cardElement, loadCardFonts } from "@/lib/card";
import { typeKeywords } from "@/lib/result-view";
import { TYPE_VISUALS, dirToTypeCode } from "@/lib/type-visuals";

// Картинка зависит только от типа и формы названия — её можно долго кэшировать
const CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";

export async function GET(request: NextRequest, { params }: { params: Promise<{ dir: string }> }) {
  const { dir } = await params;
  const code = dirToTypeCode(dir);
  const visual = TYPE_VISUALS[dir];
  if (!code || !visual) return new NextResponse(null, { status: 404 });
  const feminine = request.nextUrl.searchParams.get("f") === "1";
  const name = typeName(code, feminine ? "female" : null);
  const image = new ImageResponse(cardElement({ name, visual, keywords: typeKeywords(code) }), { ...CARD_SIZE, fonts: await loadCardFonts() });
  image.headers.set("cache-control", CACHE_CONTROL);
  image.headers.set("content-disposition", `inline; filename="grani-${dir}.png"`);
  return image;
}
