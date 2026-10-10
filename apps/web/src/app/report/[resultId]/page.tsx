import { countFriendResponses, getInviteForResult, getResultForOwner, listOwnedProducts, listReports, loadAtlasDraft } from "@grani/db";
import { typeName, unlockedKinds } from "@grani/core";
import { typeCodeToDir } from "@grani/content";
import { Fragment, type ReactNode } from "react";
import { PersonalityAtlas } from "@/components/personality-atlas/PersonalityAtlas";
import { buildPersonalityAtlas } from "@/lib/personality-atlas";
import { initialAtlasData } from "@/server/personality-atlas-service";
import { personalityAtlasEnabled } from "@/server/personality-atlas-feature";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ShareCard } from "@/app/result/[id]/ShareCard";
import { AutoRefresh } from "@/components/AutoRefresh";
import { BuyButton } from "@/components/BuyButton";
import { Paragraphs } from "@/components/Paragraphs";
import { GemPortrait } from "@/components/GemPortrait";
import { gemAssetDir } from "@/lib/gem-assets";
import { buildReportPageView, REPORT_DISCLAIMER } from "@/lib/report-view";
import { getDb } from "@/server/db";
import { requireUser } from "@/server/viewer";
import styles from "@/components/paid-report.module.css";

export const metadata: Metadata = { title: "Полный разбор" };

const REFRESH_SECONDS = 5;

function LegacyDisclosure({children}:{children:ReactNode}) {return <details className="card"><summary>Текст готового разбора</summary><div className="stack">{children}</div></details>;}

function Preparing({ what }: { what: string }) {
  return (
    <p className="report-preparing muted" role="status">
      Готовим {what}… Страница обновится сама.
    </p>
  );
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
  const name = typeName(result.typeCode, user.gender);
  const model = personalityAtlasEnabled() && view.full ? buildPersonalityAtlas(result.scores) : null;
  const stored = model ? await loadAtlasDraft(db, resultId) : null;
  const FullContent = model ? LegacyDisclosure : Fragment;

  return (
    <main className={`inner-page inner-page--report ${styles.page}`} data-night-entry data-band="night">
      {view.preparing && <AutoRefresh seconds={REFRESH_SECONDS} />}
      {model && <PersonalityAtlas key={resultId} resultId={resultId} displayName={user.displayName} typeName={name} typeCode={result.typeCode} gemDir={gemAssetDir(typeCodeToDir(result.typeCode))} model={model} initialDraft={{revision:stored?.revision ?? 0, data:stored?.data ?? initialAtlasData(model), updatedAt:stored?.updatedAt?.toISOString() ?? null}} />}
      <div className="page page--report stack">
        {!model && <header className="report-hero">
          <div className="report-hero__copy">
            <p className="eyebrow">Твой полный разбор</p>
            <h1 className="display">{name}</h1>
            <p className="lead">Портрет, сильные стороны, слепые зоны и инструкция по применению — по твоим ответам.</p>
          </div>
          <div className="report-hero__gem"><GemPortrait dir={gemAssetDir(typeCodeToDir(result.typeCode))} size={340} priority /></div>
        </header>}

        {view.full ? (
          <FullContent>
            <section className="report-portrait" aria-labelledby="portrait">
              <div className="report-portrait__head">
                <p className="report-section__number">01</p>
                <h2 id="portrait">Портрет</h2>
              </div>
              <div className="report-portrait__text">
                <Paragraphs text={view.full.portrait} />
              </div>
            </section>

            <div className="report-duo">
              <section className="report-section" aria-labelledby="strengths">
                <p className="report-section__number">02</p>
                <h2 id="strengths">Сильные стороны</h2>
                <ul className="report-list">
                  {view.full.strengths.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
              <section className="report-section" aria-labelledby="blind-spots">
                <p className="report-section__number">03</p>
                <h2 id="blind-spots">Слепые зоны</h2>
                <ul className="report-list">
                  {view.full.blind_spots.map((item) => (
                    <li key={item.text}>
                      {item.text} <span className="tip">Что с этим делать: {item.tip}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <section className="report-manual" aria-labelledby="manual">
              <p className="eyebrow">Инструкция по применению меня</p>
              <h2 id="manual">Как со мной</h2>
              <div className="report-manual__grid">
                <div className="report-manual__column">
                  <h3>Как со мной работать</h3>
                  <ul>{view.full.manual.work.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <div className="report-manual__column">
                  <h3>Как со мной спорить</h3>
                  <ul>{view.full.manual.fight.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <div className="report-manual__column">
                  <h3>Что меня бесит</h3>
                  <ul>{view.full.manual.annoys.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              </div>
            </section>

            <ShareCard
              cardUrl={`/cards/manual/${resultId}`}
              fileName="grani-manual.png"
              typeName={name}
              heading="Карточка «инструкция по применению меня»"
              shareTitle="Инструкция по применению меня"
            />
          </FullContent>
        ) : (
          <section className="report-section">
            <Preparing what="разбор" />
          </section>
        )}

        <section className="card stack report-card" aria-labelledby="friends-report">
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

        <section className="report-chapters" aria-labelledby="chapters">
          <div className="report-chapters__intro">
            <p className="eyebrow">Главы по сферам</p>
            <h2 id="chapters">Разные грани твоей жизни</h2>
            <p>Деньги, конфликты, стресс и отношения — как твой тип проявляется в каждой сфере.</p>
            {view.bundle && <BuyButton product="chapters_all" targetId={resultId} label={`Все четыре главы — ${view.bundle.price}`} />}
          </div>
          <div className="report-chapters__grid">
            {view.chapters.map((chapter) => (
              <article key={chapter.kind} className={`card stack report-chapter report-chapter--${chapter.state}`}>
                <h3>{chapter.title}</h3>
                {chapter.state === "ready" && (
                  <>
                    <Paragraphs text={chapter.sections.text} />
                    <ul className="report-list">{chapter.sections.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
                  </>
                )}
                {chapter.state === "preparing" && <Preparing what="главу" />}
                {chapter.state === "available" && (
                  <BuyButton product={chapter.kind} targetId={resultId} label={`Глава «${chapter.title}» — ${chapter.price}`} ghost />
                )}
              </article>
            ))}
          </div>
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
