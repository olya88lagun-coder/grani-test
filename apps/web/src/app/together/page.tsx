import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publicMetadata } from "@/lib/seo";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { firstName } from "@/server/friends-service";
import { togetherAdmission } from "@/server/together-gate";
import { pageGateDeps } from "@/server/together-gate-deps";
import { getTogetherSpaceView } from "@/server/together-service";
import { currentUser } from "@/server/viewer";
import { PilotClosed } from "./PilotClosed";
import { SeasonRoadmap } from "./SeasonRoadmap";
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

export default async function TogetherPage({ searchParams }: { searchParams: Promise<{ purchase?: string }> }) {
  const [{ purchase }, user] = await Promise.all([searchParams, currentUser()]);
  const admission = await togetherAdmission(pageGateDeps(), user?.id ?? null);
  if (admission === "unavailable") notFound();
  if (admission === "needs_pass") return <PilotClosed signedIn={user !== null} />;

  if (!user) {
    return (
      <main className="page stack" data-palette="pair">
        <p className="eyebrow">Грани · Вдвоём</p>
        <h1 className="display">Начнём с вас двоих</h1>
        <p className="lead">Небольшие разговоры и совместные занятия на каждый день. Без обязательного личностного теста.</p>
        <section className="card stack">
          <h2 className="display">Два аккаунта. Одна история.</h2>
          <ul className="stack">
            <li>Каждый входит в свой аккаунт.</li>
            <li>Один приглашает, второй отправляет запрос, и первый подтверждает имя.</li>
            <li>Оплата предлагается только после того, как вы оба в пространстве.</li>
          </ul>
          <a className="button button--block" href="/api/together/enter?next=space">
            Создать пространство для двоих
          </a>
          <p className="muted">Вход только через VK ID. Платёж не списывается автоматически.</p>
        </section>
        <section className="card stack">
          <h2 className="display">Маршрут на полгода</h2>
          <p className="lead">Каждый месяц у пары своя тема, свои вопросы и четыре свидания. Месяцы открываются по очереди: каждый следующий, когда у вас накопилось 30 дней оплаченного доступа.</p>
          <SeasonRoadmap />
        </section>
      </main>
    );
  }

  const space = await getTogetherSpaceView({ db: getDb(), now: () => new Date(), appUrl: getEnv().APP_URL }, user.id);
  return (
    <main className="page stack" data-palette="pair">
      <p className="eyebrow">Грани · Вдвоём</p>
      <TogetherSpace initial={space} firstName={firstName(user.displayName)} purchaseId={purchase && PURCHASE_ID.test(purchase) ? purchase : null} />
    </main>
  );
}
