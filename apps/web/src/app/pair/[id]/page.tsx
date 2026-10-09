import { getLibrary } from "@grani/content/data";
import { getPairForMember } from "@grani/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GemPortrait } from "@/components/GemPortrait";
import { gemAssetDir } from "@/lib/gem-assets";
import { buildPairView, type PairPerson } from "@/lib/pair-view";
import { getDb } from "@/server/db";
import { requireUser } from "@/server/viewer";
import { PairReport } from "./PairReport";
import styles from "./pair-map.module.css";

export const metadata: Metadata = { title: "Карта вашей пары" };

function Person({ label, person }: { label: string; person: PairPerson }) {
  return <div className={`${styles.person} pair-person`} data-long-title={person.typeName.length > 18 || undefined}>
    <GemPortrait dir={gemAssetDir(person.dir)} size={184} priority />
    <p className={styles.personLabel}>{label}</p><h2>{person.typeName}</h2>
  </div>;
}

export default async function PairPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, requireUser()]);
  const pair = await getPairForMember(getDb(), id, user.id);
  if (!pair) notFound();
  const view = buildPairView(getLibrary(), pair, user.id);
  const viewerResultId = pair.members.find(member => member.user.id === user.id)!.result.id;
  return <main className={`inner-page inner-page--pair ${styles.page}`} data-palette="pair" data-night-entry data-band="night" data-pair-map>
    <div className={styles.wrap}>
      <Link className={styles.back} href={`/result/${viewerResultId}#pairs`}>← К моему результату</Link>
      <header className={styles.hero}>
        <img className={styles.heroBackdrop} src="/pair-map/hero-v1.webp" alt="" width={1920} height={640} fetchPriority="high" />
        <div className={styles.heroCopy}><p className={styles.kicker}>Карта вашей пары</p><h1 aria-label="Инструкция друг к другу">Инструкция<br />друг к другу</h1><p>Поймите, в чём вы похожи, где смотрите на мир по-разному и о чём стоит поговорить.</p><a className={styles.heroCta} href="#profiles">Начать с ваших профилей <span aria-hidden="true">↗</span></a></div>
        <div className={styles.duo}>
          <svg className={styles.orbit} viewBox="0 0 620 280" aria-hidden="true"><ellipse cx="310" cy="138" rx="294" ry="92" transform="rotate(-14 310 138)" /><path d="M25 186v14m-7-7h14M584 43v14m-7-7h14" /></svg>
          <Person label={`Вы · ${view.you.firstName}`} person={view.you} />
          <div className={styles.index}><p className={`${styles.score} pair-score`} aria-label={`Индекс сочетания профилей ${view.score} процентов`}>{view.score}%</p><small>Индекс сочетания профилей</small></div>
          <Person label="Партнёр" person={view.partner} />
        </div>
      </header>
      <details className={styles.heroMethod}><summary>Что означает индекс {view.score}%</summary><div className={styles.heroText}><strong>{view.phrase}</strong><p>{view.text}</p></div></details><p className={styles.methodNote}>Это не прогноз отношений: число показывает сочетание профилей, а не вероятность успеха пары.</p>
      <PairReport pairId={view.pairId} viewerResultId={viewerResultId} pairView={view} />
      <details className={styles.leave}><summary>Выйти из пары</summary><div>
        <p>Страница пары скроется у обоих, и вы больше не будете видеть результаты друг друга. Чтобы снова сравниться, понадобится новое приглашение.</p>
        <form action={`/api/pairs/${view.pairId}/leave`} method="post"><button type="submit" className="button button--ghost">Выйти из пары</button></form>
      </div></details>
    </div>
  </main>;
}
