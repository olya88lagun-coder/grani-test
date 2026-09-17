import { getLatestResultId } from "@grani/db";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db";
import { requireUser } from "@/server/viewer";

export default async function MePage() {
  const user = await requireUser();
  const resultId = await getLatestResultId(getDb(), user.id);
  redirect(resultId ? `/result/${resultId}` : "/test");
}
