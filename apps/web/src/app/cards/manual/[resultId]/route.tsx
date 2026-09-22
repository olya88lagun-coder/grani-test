import { parseSections } from "@grani/ai";
import { typeCodeToDir } from "@grani/content";
import { typeName } from "@grani/core";
import { getReport, getResultForOwner } from "@grani/db";
import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { CARD_SIZE, loadCardFonts, manualCardElement } from "@/lib/card";
import { buildManualCardModel } from "@/lib/manual-card";
import { TYPE_VISUALS } from "@/lib/type-visuals";
import { getDb } from "@/server/db";
import { currentUser } from "@/server/viewer";

// Карточка строится из оплаченного разбора: только владельцу и без кэша —
// иначе на общем устройстве её увидел бы следующий, кто войдёт в том же браузере
const CACHE_CONTROL = "private, no-store";

export async function GET(_request: Request, { params }: { params: Promise<{ resultId: string }> }) {
  const [{ resultId }, user] = await Promise.all([params, currentUser()]);
  if (!user) return new NextResponse(null, { status: 401 });
  const db = getDb();
  const result = await getResultForOwner(db, resultId, user.id);
  const report = result ? await getReport(db, { resultId }, "full") : null;
  const full = report ? parseSections("full", report.sections) : null;
  const visual = result ? TYPE_VISUALS[typeCodeToDir(result.typeCode)] : undefined;
  if (!result || !full || !visual) return new NextResponse(null, { status: 404 });

  const model = buildManualCardModel(full, typeName(result.typeCode, user.gender), visual);
  const image = new ImageResponse(manualCardElement(model), { ...CARD_SIZE, fonts: await loadCardFonts() });
  image.headers.set("cache-control", CACHE_CONTROL);
  image.headers.set("content-disposition", `inline; filename="grani-manual.png"`);
  return image;
}
