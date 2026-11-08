import { formatRub, PRODUCT_PRICES } from "@grani/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuyButton } from "@/components/BuyButton";
import { AxisMap } from "@/components/short-tests/AxisMap";
import { quadrantLabels } from "@/components/short-tests/ShortTestResult";
import { ShortTestReport } from "@/components/short-tests/ShortTestReport";
import { getDb } from "@/server/db";
import { shortPairPage } from "@/server/short-pairs-service";
import { requireUser } from "@/server/viewer";
import styles from "@/components/short-tests/short-tests.module.css";

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
    <main className="inner-page" data-palette="pair">
      <div className={styles.savedPage}>
        <h1 className="display">Карта пары: {page.combination.name}</h1>
        <AxisMap
          xLabel={info(xKey).label}
          yLabel={info(yKey).label}
          points={[point(page.me, "Вы"), point(page.partner, page.partner.firstName)]}
          quadrantLabels={quadrantLabels(page.test, xKey, yKey)}
        />
        <ul aria-label="Типы в паре">
          <li>Вы: {page.me.typeName.toLowerCase()}</li>
          <li>
            {page.partner.firstName}: {page.partner.typeName.toLowerCase()}
          </li>
        </ul>
        <p className="lead">{page.combination.phrase}</p>
        <p>
          <Link href={`${page.test.path}/sochetaniya#${page.combination.key}`}>Все сочетания типов в паре</Link>
        </p>
        {page.report ? (
          <ShortTestReport report={page.report} />
        ) : page.canBuy ? (
          <section className={styles.offer} aria-labelledby="pair-report-offer">
            <h2 id="pair-report-offer">{offer.reportTitle}</h2>
            <ul className={styles.preview} aria-label="Что внутри разбора">
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
        <form method="post" action={`/api/short-pairs/${page.pairId}/leave`}>
          <button type="submit" className="button button--ghost">
            Выйти из пары
          </button>
        </form>
        <p className={styles.disclaimer}>{page.test.disclaimer}</p>
      </div>
    </main>
  );
}
