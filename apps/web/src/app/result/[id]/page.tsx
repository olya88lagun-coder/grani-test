import { getLibrary } from "@grani/content/data";
import { formatRub, PRODUCT_PRICES, unlockedKinds } from "@grani/core";
import { getResultForOwner, listOwnedProducts } from "@grani/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RichText } from "@/components/RichText";
import { ScaleMeter } from "@/components/ScaleMeter";
import { REPORT_DISCLAIMER } from "@/lib/report-view";
import { buildResultView } from "@/lib/result-view";
import { TYPE_VISUALS } from "@/lib/type-visuals";
import { getDb } from "@/server/db";
import { requireUser } from "@/server/viewer";
import { FriendsBlock } from "./FriendsBlock";
import { NotificationsBlock } from "./NotificationsBlock";
import { PairsBlock } from "./PairsBlock";
import { ReportOffer } from "./ReportOffer";
import { ShareCard } from "./ShareCard";
import { StickyReportCta } from "./StickyReportCta";

export const metadata: Metadata = { title: "Мой результат" };

// Главные действия первого экрана ведут к разделам ниже; якоря — id их заголовков
const SECONDARY_ACTIONS = [
  { href: "#share", label: "Карточка для сторис" },
  { href: "#friends", label: "Позвать друзей" },
] as const;

// Длинные названия («Вдохновительница», «Тихая хранительница») не должны заходить на карточку шкал:
// размер заголовка зависит от самого длинного слова, переносится название только по пробелам
function nameSizeClass(name: string): string {
  const longestWord = Math.max(...name.split(/\s+/).map((word) => word.length));
  if (longestWord > 13) return "result-hero__name--l";
  if (longestWord > 10) return "result-hero__name--m";
  return "";
}

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, requireUser()]);
  const result = await getResultForOwner(getDb(), id, user.id);
  if (!result) notFound();
  const view = buildResultView(getLibrary(), result, user.gender);
  const visual = TYPE_VISUALS[view.dir];
  if (!visual) notFound();
  const reportOpen = unlockedKinds(await listOwnedProducts(getDb(), { resultId: result.id })).has("full");

  return (
    <main className="inner-page inner-page--result">
      <div className="page page--result stack">
        <section className="result-hero" aria-labelledby="result-name">
          <div className="result-hero__copy">
            <p className="eyebrow">Твой результат</p>
            <h1 id="result-name" className={`display ${nameSizeClass(view.name)}`}>
              {view.name}
            </h1>
            <p className="lead">{view.shortText}</p>
            <ul className="result-tags" aria-label="Черты типа">
              <li className="result-tags__accent">{view.stabilityTag}</li>
              {view.keywords.map((word) => (
                <li key={word}>{word}</li>
              ))}
            </ul>
            <div className="result-hero__actions">
              {reportOpen ? (
                <Link className="button" href={`/report/${result.id}`}>
                  Читать полный разбор <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <a className="button" href="#report">
                  Получить полный разбор <span aria-hidden="true">→</span>
                </a>
              )}
              {SECONDARY_ACTIONS.map((action) => (
                <a key={action.href} className="button button--ghost" href={action.href}>
                  {action.label}
                </a>
              ))}
            </div>
          </div>

          <aside className="result-card" aria-labelledby="scales">
            <div className="result-card__head">
              <img className="result-card__crystal" src="/home/hero-crystal.webp" alt="" width={908} height={1062} />
              <p className="eyebrow">Твой тип</p>
              <p className="result-card__name">{view.name}</p>
            </div>
            <h2 id="scales" className="result-card__title">
              Пять шкал личности
            </h2>
            <div className="result-card__scales">
              {view.scales.map((scale) => (
                <ScaleMeter key={scale.trait} scale={scale} />
              ))}
            </div>
          </aside>
        </section>

        <ReportOffer result={result} />

        <section className="result-scales" aria-labelledby="scale-texts">
          <p className="eyebrow">Из чего складывается тип</p>
          <h2 id="scale-texts">Что значат твои шкалы</h2>
          <p className="result-scales__intro">{view.stabilityText}</p>
          <div className="result-scales__grid">
            {view.scales.map((scale) => (
              <article key={scale.trait} className="result-scale">
                <h3>{scale.label}</h3>
                <RichText text={scale.text} />
              </article>
            ))}
          </div>
        </section>

        <ShareCard
          cardUrl={`/cards/${view.dir}${user.gender === "female" ? "?f=1" : ""}`}
          fileName={`grani-${view.dir}.png`}
          typeName={view.name}
        />

        <FriendsBlock resultId={result.id} />

        <PairsBlock userId={user.id} resultId={result.id} />

        <NotificationsBlock userId={user.id} />

        <div className="row">
          <Link className="button button--ghost" href="/test">
            Пройти заново
          </Link>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="button button--ghost">
              Выйти
            </button>
          </form>
        </div>
        <p className="muted">{REPORT_DISCLAIMER}</p>
        <p>
          <Link className="muted" href="/me/delete">
            Удалить мои данные
          </Link>
        </p>
      </div>
      {!reportOpen && <StickyReportCta label={`Полный разбор — ${formatRub(PRODUCT_PRICES.full)}`} />}
    </main>
  );
}
