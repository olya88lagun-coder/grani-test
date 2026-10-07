import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isShareCode } from "@grani/db";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { togetherAdmission } from "@/server/together-gate";
import { pageGateDeps } from "@/server/together-gate-deps";
import { getTogetherSpaceView } from "@/server/together-service";
import { currentUser } from "@/server/viewer";
import { PilotClosed } from "../PilotClosed";
import { TogetherLanding } from "../TogetherLanding";
import "../together-cards.css";

export const dynamic = "force-dynamic";

// Витрина доступна всем всегда, в том числе паре с готовым пространством: ссылку можно показать друзьям.
// Для поиска главная витрина — /together, поэтому дубль не индексируется
export const metadata: Metadata = { title: "Вдвоём", robots: { index: false, follow: false } };

export default async function TogetherAboutPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const [{ from }, user] = await Promise.all([searchParams, currentUser()]);
  const referral = from !== undefined && isShareCode(from) ? from : undefined;
  const enterQuery = referral ? `&from=${referral}` : "";
  const admission = await togetherAdmission(pageGateDeps(), user?.id ?? null);
  if (admission === "unavailable") notFound();
  if (admission === "needs_pass") return <PilotClosed signedIn={user !== null} enterQuery={enterQuery} />;
  if (!user) return <TogetherLanding enterQuery={enterQuery} />;

  const space = await getTogetherSpaceView({ db: getDb(), now: () => new Date(), appUrl: getEnv().APP_URL }, user.id);
  if (space !== null) return <TogetherLanding enterQuery={enterQuery} member />;
  return <TogetherLanding enterQuery={enterQuery} ctaHref={`/together/start${referral ? `?from=${referral}` : ""}`} />;
}
