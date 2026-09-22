import { countFriendResponses, getInviteForResult, getResultForOwner, listOwnedProducts, listReports } from "@grani/db";
import { typeName, unlockedKinds } from "@grani/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ShareCard } from "@/app/result/[id]/ShareCard";
import { AutoRefresh } from "@/components/AutoRefresh";
import { BuyButton } from "@/components/BuyButton";
import { Paragraphs } from "@/components/Paragraphs";
import { buildReportPageView, REPORT_DISCLAIMER } from "@/lib/report-view";
import { getDb } from "@/server/db";
import { requireUser } from "@/server/viewer";

export const metadata: Metadata = { title: "Полный разбор" };

const REFRESH_SECONDS = 5;

function Preparing({ what }: { what: string }) {
  return <p className="muted" role="status">Готовим {what}… Страница обновится сама.</p>;
}

export default async function ReportPage({ params }: { params: Promise<{ resultId: string }> }) {
  const [{ resultId }, user] = await Promise.all([params, requireUser()]);
  const db = getDb();
  const result = await getResultForOwner(db, resultId, user.id);
  if (!result) notFound();
  const owned = await listOwnedProducts(db, { resultId });
  if (!unlockedKinds(owned).has("full")) redirect(`/result/${resultId}`);
  const invite = await getInviteForResult(db, resultId);
  const view = buildReportPageView({
    owned,
    reports: await listReports(db, { resultId }),
    friendsCount: invite ? await countFriendResponses(db, invite.id) : 0,
  });

  return (
    <main className="page">
      {view.preparing && <AutoRefresh seconds={REFRESH_SECONDS} />}
      <div className="stack">
        <section className="card card--2 stack report">
          <p className="eyebrow">Полный разбор</p>
          {view.full ? (
            <>
              <h1 className="display">Портрет</h1>
              <Paragraphs text={view.full.portrait} />
              <h2>Сильные стороны</h2>
              <ul>{view.full.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
              <h2>Слепые зоны</h2>
              <ul>
                {view.full.blind_spots.map((item) => (
                  <li key={item.text}>
                    {item.text} <span className="tip">Что с этим делать: {item.tip}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Preparing what="разбор" />
          )}
        </section>

        {view.full && (
          <section className="card card--paper stack report" aria-labelledby="manual">
            <p className="eyebrow">Инструкция по применению меня</p>
            <h2 id="manual">Как со мной</h2>
            <h3>Как со мной работать</h3>
            <ul>{view.full.manual.work.map((item) => <li key={item}>{item}</li>)}</ul>
            <h3>Как со мной ссориться</h3>
            <ul>{view.full.manual.fight.map((item) => <li key={item}>{item}</li>)}</ul>
            <h3>Что меня бесит</h3>
            <ul>{view.full.manual.annoys.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        )}

        {view.full && (
          <ShareCard
            cardUrl={`/cards/manual/${resultId}`}
            fileName="grani-manual.png"
            typeName={typeName(result.typeCode, user.gender)}
            heading="Карточка «инструкция по применению меня»"
            shareTitle="Инструкция по применению меня"
          />
        )}

        <section className="card stack report" data-palette="friends" aria-labelledby="friends-report">
          <p className="eyebrow">Как меня видят другие</p>
          <h2 id="friends-report">Взгляд друзей</h2>
          {view.friends.state === "ready" && <Paragraphs text={view.friends.text} />}
          {view.friends.state === "preparing" && <Preparing what="раздел" />}
          {view.friends.state === "waiting" && (
            <>
              <p className="lead">Раздел появится, когда ответят трое друзей. {view.friends.counter}.</p>
              <div>
                <Link className="button button--ghost" href={`/result/${resultId}`}>
                  Ссылка для друзей
                </Link>
              </div>
            </>
          )}
        </section>

        <section className="card card--paper stack report" aria-labelledby="chapters">
          <p className="eyebrow">Главы по сферам</p>
          <h2 id="chapters">Деньги, конфликты, стресс, отношения</h2>
          {view.bundle && <BuyButton product="chapters_all" targetId={resultId} label={`Все четыре главы — ${view.bundle.price}`} />}
          {view.chapters.map((chapter) => (
            <div key={chapter.kind} className="stack">
              <h3>{chapter.title}</h3>
              {chapter.state === "ready" && (
                <>
                  <Paragraphs text={chapter.sections.text} />
                  <ul>{chapter.sections.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
                </>
              )}
              {chapter.state === "preparing" && <Preparing what="главу" />}
              {chapter.state === "available" && (
                <BuyButton product={chapter.kind} targetId={resultId} label={`Глава «${chapter.title}» — ${chapter.price}`} ghost />
              )}
            </div>
          ))}
        </section>

        <p className="muted">{REPORT_DISCLAIMER}</p>
        <div className="row">
          <Link className="button button--ghost" href={`/result/${resultId}`}>
            К результату
          </Link>
        </div>
      </div>
    </main>
  );
}
