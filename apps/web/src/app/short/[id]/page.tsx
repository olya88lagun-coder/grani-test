import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BuyButton } from "@/components/BuyButton";
import { ShortTestReport } from "@/components/short-tests/ShortTestReport";
import { ShortTestSavedResult } from "@/components/short-tests/ShortTestSavedResult";
import { formatRub, PRODUCT_PRICES } from "@grani/core";
import { listActiveShortPairs } from "@grani/db";
import { ShortPairInvite } from "@/components/short-tests/ShortPairInvite";
import { getDb } from "@/server/db";
import { firstName } from "@/server/friends-service";
import { shortResultPage } from "@/server/short-results-service";
import { requireUser } from "@/server/viewer";
import styles from "@/components/short-tests/short-tests.module.css";

export const metadata: Metadata = { title: "Ваш результат", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Сохранённый результат короткого теста — только владельцу: чужой id даёт 404
export default async function ShortResultPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, requireUser()]);
  const page = await shortResultPage({ db: getDb() }, { id, userId: user.id });
  if (!page) notFound();
  const pairs = page.test.pairOffer ? await listActiveShortPairs(getDb(), { userId: user.id, testSlug: page.test.slug }) : [];
  const preview = page.test.reportOffer?.preview ?? [];
  return (
    <main className="inner-page" data-palette="pair">
      <div className={styles.savedPage}>
        <h1 className="display">Ваш результат: {page.test.h1.toLowerCase()}</h1>
        <ShortTestSavedResult slug={page.test.slug} axes={page.score.axes} typeKey={page.score.typeKey} mixedAxes={page.score.mixedAxes} />
        {page.test.pairOffer && (
          <ShortPairInvite
            shortResultId={page.resultId}
            title={page.test.pairOffer.title}
            lead={page.test.pairOffer.lead}
            pairs={pairs.map((pair) => ({ id: pair.id, partnerFirstName: firstName(pair.partner.displayName) }))}
          />
        )}
        {page.report ? (
          <ShortTestReport report={page.report} />
        ) : page.canBuy && page.product ? (
          <section className={styles.offer} aria-labelledby="report-offer">
            <h2 id="report-offer">{page.test.reportOffer?.title}</h2>
            <ul className={styles.preview} aria-label="Что внутри разбора">
              {preview.map((heading) => (
                <li key={heading}>{heading}</li>
              ))}
            </ul>
            <BuyButton product={page.product} targetId={page.resultId} label={`Открыть за ${formatRub(PRODUCT_PRICES[page.product])}`} />
          </section>
        ) : null}
      </div>
    </main>
  );
}
