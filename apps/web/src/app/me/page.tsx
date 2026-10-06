import { getLatestResultId } from "@grani/db";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db";
import { requireUser } from "@/server/viewer";

// Куда на странице результата вести: ?to=pairs — сразу к приглашению партнёра (якорь в ссылке теряется на редиректе)
const SECTIONS: Record<string, string> = { pairs: "#pairs" };

export default async function MePage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const user = await requireUser();
  const resultId = await getLatestResultId(getDb(), user.id);
  const { to } = await searchParams;
  redirect(resultId ? `/result/${resultId}${SECTIONS[to ?? ""] ?? ""}` : "/test");
}
