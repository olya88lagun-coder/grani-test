import { formatRub, PRODUCT_PRICES, unlockedKinds } from "@grani/core";
import { getReport, listOwnedProducts } from "@grani/db";
import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { BuyButton } from "@/components/BuyButton";
import { Paragraphs } from "@/components/Paragraphs";
import { buildPairReportView, PAIR_SECTION_TITLES } from "@/lib/pair-view";
import { REPORT_DISCLAIMER } from "@/lib/report-view";
import { getDb } from "@/server/db";

const REFRESH_SECONDS = 5;

export async function PairReport({ pairId, viewerResultId }: { pairId: string; viewerResultId: string }) {
  const db = getDb();
  const [owned, report, ownProducts] = await Promise.all([
    listOwnedProducts(db, { pairId }),
    getReport(db, { pairId }, "pair"),
    listOwnedProducts(db, { resultId: viewerResultId }),
  ]);
  const view = buildPairReportView({ owned, report });
  const offerPersonal = !unlockedKinds(ownProducts).has("full");

  return (
    <>
      <section className={view.state === "available" ? "card stack report pair-offer" : "card stack report"} aria-labelledby="pair-report">
        {view.state === "available" ? (
          <>
            <p className="eyebrow">Разбор пары · {view.price}</p>
            <h2 id="pair-report">Разговор, к которому у вас уже есть карта</h2>
            <p className="lead">
              Пять разделов помогут увидеть, где вам легко и где вы по-разному смотрите на быт, деньги и споры. Одна оплата открывает разбор обоим.
            </p>
            <ol className="pair-offer__sections" aria-label="Что внутри разбора пары">
              {Object.values(PAIR_SECTION_TITLES).map((title) => (
                <li key={title}>{title}</li>
              ))}
            </ol>
            <div className="pair-offer__buy">
              <BuyButton product="pair" targetId={pairId} label={`Открыть разбор пары за ${view.price}`} />
              <p className="result-offer__note">Откроется обоим участникам пары. Платит один.</p>
            </div>
            <p className="result-offer__legal">
              Нажимая кнопку, вы принимаете условия <Link href="/offer">оферты</Link> и подтверждаете, что вам есть 18 лет. Если кто-то из вас выйдет из пары, разбор скроется у обоих, деньги не возвращаются.
            </p>
          </>
        ) : (
          <>
            <p className="eyebrow">Разбор пары</p>
            <h2 id="pair-report">Как вам быть вместе</h2>
          </>
        )}
        {view.state === "preparing" && (
          <>
            <AutoRefresh seconds={REFRESH_SECONDS} />
            <p className="muted" role="status">Готовим разбор пары… Страница обновится сама.</p>
          </>
        )}
        {view.state === "ready" && (
          <>
            {view.sections.map((section) => (
              <div key={section.key} className="stack">
                <h3>{section.title}</h3>
                <Paragraphs text={section.text} />
              </div>
            ))}
            <p className="muted">{REPORT_DISCLAIMER}</p>
          </>
        )}
      </section>

      {offerPersonal && (
        <section className="card card--paper stack" aria-labelledby="personal-offer">
          <p className="eyebrow">Для себя</p>
          <h2 id="personal-offer">Личный разбор</h2>
          <p className="lead">Портрет, сильные стороны, слепые зоны и «инструкция по применению меня» — по твоему результату.</p>
          <BuyButton product="full" targetId={viewerResultId} label={`Личный разбор — ${formatRub(PRODUCT_PRICES.full)}`} ghost />
        </section>
      )}
    </>
  );
}
