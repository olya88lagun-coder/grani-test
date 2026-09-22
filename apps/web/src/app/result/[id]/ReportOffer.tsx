import { getLibrary } from "@grani/content/data";
import { formatRub, PRODUCT_PRICES, unlockedKinds } from "@grani/core";
import { listOwnedProducts, type ResultRecord } from "@grani/db";
import Link from "next/link";
import { BuyButton } from "@/components/BuyButton";
import { buildReportPreview } from "@/lib/report-view";
import { getDb } from "@/server/db";

const BLURRED = "Здесь продолжение раздела: конкретные наблюдения о сочетании твоих черт, примеры из работы и отношений и то, что с этим делать.";

export async function ReportOffer({ result }: { result: ResultRecord }) {
  const owned = await listOwnedProducts(getDb(), { resultId: result.id });
  if (unlockedKinds(owned).has("full")) {
    return (
      <section className="card card--3 stack" aria-labelledby="report">
        <p className="eyebrow">Полный разбор</p>
        <h2 id="report">Разбор открыт</h2>
        <div>
          <Link className="button" href={`/report/${result.id}`}>
            Читать разбор <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    );
  }
  const preview = buildReportPreview(getLibrary(), result);
  return (
    <section className="card card--3 stack" aria-labelledby="report">
      <p className="eyebrow">Полный разбор</p>
      <h2 id="report">Что откроется в полном разборе</h2>
      {preview.map((section) => (
        <div key={section.title} className="preview">
          <h3>{section.title}</h3>
          <p>{section.teaser}</p>
          <p className="preview__blur" aria-hidden="true">{BLURRED}</p>
        </div>
      ))}
      <BuyButton product="full" targetId={result.id} label={`Открыть за ${formatRub(PRODUCT_PRICES.full)}`} />
      <p className="muted">
        Нажимая кнопку, вы принимаете условия <Link href="/offer">оферты</Link> и подтверждаете, что вам есть 18 лет.
      </p>
    </section>
  );
}
