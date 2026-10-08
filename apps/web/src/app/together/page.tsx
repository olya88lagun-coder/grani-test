import { isShareCode } from "@grani/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publicMetadata } from "@/lib/seo";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { firstName } from "@/server/friends-service";
import { togetherAdmission } from "@/server/together-gate";
import { pageGateDeps } from "@/server/together-gate-deps";
import { getTogetherClosedNotice, getTogetherSpaceView } from "@/server/together-service";
import { currentUser } from "@/server/viewer";
import { ClosedNotice } from "./ClosedNotice";
import { PilotClosed } from "./PilotClosed";
import styles from "./together-space.module.css";
import { TogetherLanding } from "./TogetherLanding";
import { TogetherSpace } from "./TogetherSpace";
import "./together-cards.css";

export const dynamic = "force-dynamic";

const PURCHASE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Публичное предложение индексируется только в открытом режиме; личное пространство вошедшего человека — никогда
export async function generateMetadata(): Promise<Metadata> {
  const user = await currentUser();
  if (getEnv().together.mode !== "open") return { title: "Вдвоём", robots: { index: false, follow: false } };
  return user
    ? { title: "Ваше пространство", robots: { index: false, follow: false } }
    : publicMetadata({
        title: "Вдвоём",
        description: "Общее пространство для двоих: небольшие разговоры и совместные занятия. Тест личности проходить не нужно.",
        path: "/together",
      });
}

export default async function TogetherPage({ searchParams }: { searchParams: Promise<{ purchase?: string; from?: string }> }) {
  const [{ purchase, from }, user] = await Promise.all([searchParams, currentUser()]);
  // Код пары, чья ссылка привела сюда: правильный формат уходит во вход, остальное отбрасывается
  const referral = from !== undefined && isShareCode(from) ? from : undefined;
  const enterQuery = referral ? `&from=${referral}` : "";
  const admission = await togetherAdmission(pageGateDeps(), user?.id ?? null);
  if (admission === "unavailable") notFound();
  if (admission === "needs_pass") return <PilotClosed signedIn={user !== null} enterQuery={enterQuery} />;

  if (!user) return <TogetherLanding enterQuery={enterQuery} />;

  const deps = { db: getDb(), now: () => new Date(), appUrl: getEnv().APP_URL };
  const space = await getTogetherSpaceView(deps, user.id);
  // Вошедший человек без пространства сначала видит витрину, а не форму создания; кнопка ведёт на /together/start.
  // Возврат с оплаты (purchase) и пара с пространством идут в экран пространства
  if (space === null && !(purchase && PURCHASE_ID.test(purchase))) {
    // Если пространство закрыл партнёр, человек один раз видит, что произошло
    const closed = await getTogetherClosedNotice(deps, { userId: user.id });
    return <TogetherLanding enterQuery={enterQuery} ctaHref={`/together/start${referral ? `?from=${referral}` : ""}`} notice={closed ? <ClosedNotice reason={closed.reason} /> : undefined} />;
  }
  return (
    <main className={styles.space} data-palette="pair" data-band="night" data-night-entry>
      <div className="page stack">
        <p className="eyebrow">Грани · Вдвоём</p>
        <TogetherSpace initial={space} referral={referral} firstName={firstName(user.displayName)} purchaseId={purchase && PURCHASE_ID.test(purchase) ? purchase : null} />
      </div>
    </main>
  );
}
