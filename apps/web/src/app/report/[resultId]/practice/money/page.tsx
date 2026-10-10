import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getResultForOwner, listReports, listOwnedProducts } from "@grani/db";
import { canBuy, formatRub, PRODUCT_PRICES } from "@grani/core";
import { MoneyPractice } from "@/components/practice/MoneyPractice";
import { BuyButton } from "@/components/BuyButton";
import { Paragraphs } from "@/components/Paragraphs";
import { parseSections } from "@grani/ai";
import { getDb } from "@/server/db";
import { requireUser } from "@/server/viewer";
import { moneyPracticeEnabled, readPractice } from "@/server/practice-service";

export const metadata: Metadata = { title: "Мой финансовый компас", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function MoneyPage({ params }: { params: Promise<{ resultId: string }> }) {
  if (!moneyPracticeEnabled()) notFound();
  const [{ resultId }, user] = await Promise.all([params, requireUser()]);
  const db = getDb(), result = await getResultForOwner(db, resultId, user.id);
  if (!result) notFound();
  const outcome = await readPractice(db, { userId: user.id, resultId, key: "money" });
  if (!outcome.ok) {
    if (outcome.error === "not_found") notFound();
    const owned = await listOwnedProducts(db, {resultId});
    return <main className="inner-page" data-band="night"><div className="page stack"><h1>Мой финансовый компас</h1>{outcome.error === "access_required" ? <><p>Практикум включён в главу «Деньги». Ранее оплаченная глава или комплект открывают его автоматически.</p>{canBuy("chapter_money", owned) ? <><BuyButton product="chapter_money" targetId={resultId} label={`Глава «Деньги» — ${formatRub(PRODUCT_PRICES.chapter_money)}`} />{canBuy("chapters_all", owned) && <BuyButton product="chapters_all" targetId={resultId} label={`Все четыре главы — ${formatRub(PRODUCT_PRICES.chapters_all)}`} ghost />}</> : canBuy("full", owned) ? <><p>Сначала открой полный разбор личности. После него доступны дополнительные главы.</p><BuyButton product="full" targetId={resultId} label={`Полный разбор — ${formatRub(PRODUCT_PRICES.full)}`} /></> : null}</> : <p role="alert">Сохранённая версия практикума сейчас недоступна. Твои данные сохранены. Попробуй вернуться позже.</p>}<Link href={`/result/${resultId}`}>К моему результату</Link></div></main>;
  }
  const previousReports = await listReports(db, { resultId });
  const legacy = previousReports.find(r => r.kind === "chapter_money");
  const sections = legacy ? parseSections("chapter_money", legacy.sections) : null;
  return <main data-band="night" data-night-entry>
    <MoneyPractice key={resultId} resultId={resultId} displayName={user.displayName} scores={result.scores} initialDraft={outcome.draft} />
    {sections && <div className="page" style={{ paddingBlock: "0 48px" }}><details className="card stack"><summary>Текст ранее созданной главы «Деньги»</summary><Paragraphs text={sections.text} /><ul>{sections.tips.map(tip => <li key={tip}>{tip}</li>)}</ul></details></div>}
  </main>;
}
