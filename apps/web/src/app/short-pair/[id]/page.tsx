import { formatRub, PRODUCT_PRICES } from "@grani/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuyButton } from "@/components/BuyButton";
import { AxisMap } from "@/components/short-tests/AxisMap";
import { quadrantLabels } from "@/lib/short-test-result";
import { ShortTestReport } from "@/components/short-tests/ShortTestReport";
import { getDb } from "@/server/db";
import { shortPairPage } from "@/server/short-pairs-service";
import { requireUser } from "@/server/viewer";
import styles from "@/components/short-tests/short-tests.module.css";
import pairStyles from "@/components/short-tests/attachment-pair.module.css";

export const metadata: Metadata = { title: "Карта пары", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Общая карта пары — только участникам активной пары; после выхода любого из двоих — 404. Вёрстка — за Codex
export default async function ShortPairPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, requireUser()]);
  const page = await shortPairPage(getDb(), { pairId: id, userId: user.id });
  if (!page) notFound();
  const offer = page.test.pairOffer!;
  // Ось X — вторая ось теста, ось Y — первая, как на личной карте: у привязанности это избегание и тревожность
  const [yKey, xKey] = page.test.scoring.axes as [string, string];
  const info = (key: string) => page.test.axes.find((axis) => axis.key === key)!;
  const point = (member: typeof page.me, label: string) => ({ x: member.score.axes[xKey] ?? 0, y: member.score.axes[yKey] ?? 0, label });
  const price = formatRub(PRODUCT_PRICES[page.product]);
  return (
    <main className={pairStyles.page} data-palette="pair" data-night-entry>
      <header className={pairStyles.mapCover} data-band="night">
        <div className={`${pairStyles.wrap} ${pairStyles.mapLayout}`}>
          <div className={`${pairStyles.coverCopy} ${pairStyles.mapTitle}`}>
            <h1 className="display">Карта пары: {page.combination.name}</h1>
          </div>
          <AxisMap
            xLabel={info(xKey).label}
            yLabel={info(yKey).label}
            points={[point(page.me, "Вы"), point(page.partner, page.partner.firstName)]}
            quadrantLabels={quadrantLabels(page.test, xKey, yKey)}
            texture="/attachment/pair-map.webp"
          />
          <div className={`${pairStyles.coverCopy} ${pairStyles.mapCaption}`}>
            <p className="lead">{page.combination.phrase}</p>
            <ul className={pairStyles.memberTypes} role="list" aria-label="Типы в паре">
              <li><strong>Вы:</strong> {page.me.typeName.toLowerCase()}</li>
              <li><strong>{page.partner.firstName}:</strong> {page.partner.typeName.toLowerCase()}</li>
            </ul>
            <Link href={`${page.test.path}/sochetaniya#${page.combination.key}`}>Все сочетания типов в паре</Link>
          </div>
        </div>
      </header>
      <div className={pairStyles.flow}>
        {page.report ? (
          <div className={pairStyles.reportPanel}><ShortTestReport report={page.report} /></div>
        ) : page.canBuy ? (
          <section className={pairStyles.purchasePanel} aria-labelledby="pair-report-offer">
            <h2 id="pair-report-offer">{offer.reportTitle}</h2>
            <ul className={pairStyles.purchasePreview} role="list" aria-label="Что внутри разбора">
              {offer.preview.map((heading) => (
                <li key={heading}>{heading}</li>
              ))}
            </ul>
            <BuyButton
              product={page.product}
              targetId={page.pairId}
              label={page.product === "attachment_pair_discount" ? `Открыть обоим за ${price} — скидка за личный разбор` : `Открыть обоим за ${price}`}
            />
          </section>
        ) : null}
        <form className={pairStyles.leave} method="post" action={`/api/short-pairs/${page.pairId}/leave`}>
          <button type="submit" className="button button--ghost">
            Выйти из пары
          </button>
        </form>
        <p className={styles.disclaimer}>{page.test.disclaimer}</p>
      </div>
    </main>
  );
}
