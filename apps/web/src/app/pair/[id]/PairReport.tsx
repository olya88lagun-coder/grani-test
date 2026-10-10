import { formatRub, PRODUCT_PRICES, unlockedKinds } from "@grani/core";
import { getReport, listOwnedProducts } from "@grani/db";
import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { BuyButton } from "@/components/BuyButton";
import { Paragraphs } from "@/components/Paragraphs";
import { buildPairReportView, type PairView } from "@/lib/pair-view";
import { PAIR_GUIDE_CONTENTS } from "@/lib/pair-guide";
import { getDb } from "@/server/db";
import { getPairMap } from "@/server/pair-map-service";
import { PairGuide } from "./PairGuide";
import { PairProfiles } from "./PairProfiles";
import styles from "./pair-map.module.css";

export async function PairReport({ pairId, viewerId, viewerResultId, pairView }: { pairId: string; viewerId: string; viewerResultId: string; pairView: PairView }) {
  const db = getDb();
  const [owned, report, ownProducts] = await Promise.all([
    listOwnedProducts(db, { pairId }), getReport(db, { pairId }, "pair"), listOwnedProducts(db, { resultId: viewerResultId }),
  ]);
  const view = buildPairReportView({ owned, report });
  const offerPersonal = !unlockedKinds(ownProducts).has("full");
  const shared = view.state === "available" ? null : await getPairMap({ db, now: () => new Date() }, { pairId, userId: viewerId });
  return <>
    {view.state === "available" ? <>
      <PairProfiles view={pairView} />
      <section className={styles.offer} aria-labelledby="pair-report">
        <p className={styles.kicker}>Разбор пары · {view.price}</p><h2 id="pair-report">Разговор, к которому у вас уже есть карта</h2>
        <p>Интерактивная инструкция по двум профилям: от различий в повседневных ситуациях до первых договорённостей. Одна оплата открывает разбор обоим.</p>
        <ul className={styles.offerList}>{PAIR_GUIDE_CONTENTS.filter(item => item.id !== "profiles").map(item => <li key={item.id}>{item.title}</li>)}</ul>
        <BuyButton product="pair" targetId={pairId} label={`Открыть разбор пары за ${view.price}`} />
        <p className={styles.note}>Разовая покупка без подписки. Откроется обоим участникам пары. Платит один. Персональный PDF доступен сразу; ответы раскрываются после публикации обоими, договорённости подтверждаются по одной версии.</p>
        <p className={styles.note}>Нажимая кнопку, вы принимаете условия <Link href="/offer">оферты</Link> и подтверждаете, что вам есть 18 лет. Если кто-то из вас выйдет из пары, разбор скроется у обоих; условия возврата — в оферте.</p>
      </section>
    </> : <PairGuide view={pairView} sharedSnapshot={shared?.ok ? shared.snapshot : null} storageKey={`grani-pair-drafts-v1:${pairId}:${viewerResultId}`}>
      <section className={styles.section} aria-labelledby="pair-report">
        <p className={styles.kicker}>Дополнительные главы</p><h2>Ещё о вашем сочетании</h2>
        <details className={styles.extras}><summary id="pair-report">Подробный текстовый разбор</summary><div className={styles.extrasBody}>
          {view.state === "preparing" ? <><AutoRefresh seconds={5} /><p role="status">Готовим дополнительный текстовый разбор. Интерактивная карта уже доступна; страница обновится сама.</p></> : view.sections.map(section => <article key={section.key}><h3>{section.title}</h3><Paragraphs text={section.text} /></article>)}
        </div></details>
      </section>
    </PairGuide>}
    {offerPersonal && <section className={styles.offer} aria-labelledby="personal-offer"><p className={styles.kicker}>Для себя</p><h2 id="personal-offer">Личный разбор</h2><p>Портрет, сильные стороны, слепые зоны и «инструкция по применению меня» — по твоему результату.</p><BuyButton product="full" targetId={viewerResultId} label={`Личный разбор — ${formatRub(PRODUCT_PRICES.full)}`} ghost /></section>}
  </>;
}
