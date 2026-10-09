import { isShareCode } from "@grani/db";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { firstName } from "@/server/friends-service";
import { togetherAdmission } from "@/server/together-gate";
import { pageGateDeps } from "@/server/together-gate-deps";
import { getTogetherClosedNotice, getTogetherSpaceView } from "@/server/together-service";
import { currentUser } from "@/server/viewer";
import { ClosedNotice } from "../ClosedNotice";
import { PilotClosed } from "../PilotClosed";
import { TogetherSpace } from "../TogetherSpace";
import "../together-cards.css";
import flowStyles from "../together-flow.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Создать пространство", robots: { index: false, follow: false } };

// Создание пространства: согласие и кнопка. Сюда ведёт кнопка витрины; человек с готовым пространством идёт на /together
export default async function TogetherStartPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const [{ from }, user] = await Promise.all([searchParams, currentUser()]);
  const referral = from !== undefined && isShareCode(from) ? from : undefined;
  const enterQuery = referral ? `&from=${referral}` : "";
  const admission = await togetherAdmission(pageGateDeps(), user?.id ?? null);
  if (admission === "unavailable") notFound();
  if (admission === "needs_pass") return <PilotClosed signedIn={user !== null} enterQuery={enterQuery} />;
  if (!user) redirect(`/api/together/enter?next=space${enterQuery}`);

  const deps = { db: getDb(), now: () => new Date(), appUrl: getEnv().APP_URL };
  const space = await getTogetherSpaceView(deps, user.id);
  if (space !== null) redirect("/together");
  const closed = await getTogetherClosedNotice(deps, { userId: user.id });
  return (
    <main className={flowStyles.flow} data-palette="pair" data-band="night" data-night-entry>
      <div className="page stack">
        <p className="eyebrow">Грани · Вдвоём</p>
        {closed && <ClosedNotice reason={closed.reason} />}
        <TogetherSpace initial={null} referral={referral} firstName={firstName(user.displayName)} purchaseId={null} />
      </div>
    </main>
  );
}
