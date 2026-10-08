import { getLibrary } from "@grani/content/data";
import { formatRub, PRODUCT_PRICES, unlockedKinds } from "@grani/core";
import { listOwnedProducts, listReports, type ResultRecord } from "@grani/db";
import Link from "next/link";
import { BuyButton } from "@/components/BuyButton";
import { buildReportPreview } from "@/lib/report-view";
import { getDb } from "@/server/db";

const BLURRED = "Здесь продолжение раздела: конкретные наблюдения о сочетании твоих черт, примеры из работы и отношений и то, что с этим делать.";

export async function ReportOffer({ result }: { result: ResultRecord }) {
  const owned = await listOwnedProducts(getDb(), { resultId: result.id });
  if (unlockedKinds(owned).has("full")) {
    // Куплено и готово — разные состояния: оплаченный разбор может ещё готовиться
    const ready = (await listReports(getDb(), { resultId: result.id })).some((report) => report.kind === "full");
    return (
      <section data-band="night" className="card stack result-block result-block--report" aria-labelledby="report">
        <p className="eyebrow">Полный разбор</p>
        <h2 id="report">{ready ? "Разбор открыт" : "Разбор готовится"}</h2>
        {!ready && <p className="lead">Оплата получена. Обычно это занимает около минуты, страница разбора откроется, когда он будет готов.</p>}
        <div>
          <Link className="button" href={`/report/${result.id}`}>
            {ready ? "Читать разбор" : "Открыть страницу разбора"} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    );
  }
  const price = formatRub(PRODUCT_PRICES.full);
  const preview = buildReportPreview(getLibrary(), result);
  return (
    <section data-band="night" className="card stack result-block result-block--report result-block--offer result-offer" aria-labelledby="report">
      <div className="result-offer__hero">
        <p className="eyebrow">Полный разбор · <span className="result-offer__price">{price}</span></p>
        <h2 id="report">Разверни свой результат в личный портрет</h2>
        <p className="lead">
          Тип и шкалы показывают основу. Полный разбор превращает их в понятную инструкцию: сильные стороны, слепые зоны и что с ними делать, как
          с тобой работать, спорить и договариваться.
        </p>
      </div>
      <ul className="result-offer__preview" aria-label="Что внутри разбора">
        {preview.map((section) => (
          <li key={section.title} className="result-offer__item">
            <h3>{section.title}</h3>
            <p>{section.teaser}</p>
            <p className="result-offer__locked" aria-hidden="true">
              {BLURRED}
            </p>
          </li>
        ))}
      </ul>
      <div className="result-offer__buy">
        <BuyButton product="full" targetId={result.id} label={`Открыть полный разбор за ${price}`} />
        <p className="result-offer__note">Разбор появится на сайте через пару минут после оплаты.</p>
      </div>
      <p className="result-offer__legal">
        Нажимая кнопку, вы принимаете условия <Link href="/offer">оферты</Link> и подтверждаете, что вам есть 18 лет.
      </p>
    </section>
  );
}
