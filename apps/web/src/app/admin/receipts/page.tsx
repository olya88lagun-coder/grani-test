import { formatRub } from "@grani/core";
import { listReceiptsToSend, markReceiptSent } from "@grani/db";
import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { getDb } from "@/server/db";
import { requireOwner } from "@/server/owner";
import { PRODUCT_DESCRIPTIONS } from "@/server/payments-service";
import { OwnerDeviceMark } from "./OwnerDeviceMark";

export const metadata: Metadata = { title: "Чеки к отправке", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const PAID_AT = new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Moscow" });

async function receiptSent(formData: FormData) {
  "use server";
  await requireOwner();
  const id = formData.get("id");
  if (typeof id === "string") await markReceiptSent(getDb(), id, new Date());
  revalidatePath("/admin/receipts");
}

export default async function ReceiptsPage() {
  await requireOwner();
  const receipts = await listReceiptsToSend(getDb());

  return (
    <main className="inner-page">
      <article className="page stack receipts-page">
        <header className="stack">
          <h1 className="display">Чеки к отправке</h1>
          <p className="lead">
            Оплаченные покупки без отправленного чека. Название услуги и сумма — как для чека в «Мой налог». После отправки нажми «Чек отправлен»:
            покупка уйдёт из списка, а почта покупателя сотрётся.
          </p>
          <OwnerDeviceMark />
        </header>
        {receipts.length === 0 ? (
          <p className="muted">Все чеки отправлены.</p>
        ) : (
          <ul className="receipts">
            {receipts.map((receipt) => (
              <li key={receipt.id} className="card stack receipt">
                <p className="receipt__service">{PRODUCT_DESCRIPTIONS[receipt.product]}</p>
                <p className="receipt__amount">{formatRub(receipt.amountKopecks)}</p>
                <dl className="receipt__details">
                  <dt>Почта</dt>
                  <dd>{receipt.email ?? "не указана — покупка до появления поля"}</dd>
                  <dt>Оплачено</dt>
                  <dd>{receipt.paidAt ? PAID_AT.format(receipt.paidAt) : "—"}</dd>
                  <dt>Платёж ЮKassa</dt>
                  <dd>{receipt.paymentId ?? "—"}</dd>
                </dl>
                <form action={receiptSent}>
                  <input type="hidden" name="id" value={receipt.id} />
                  <button type="submit" className="button button--ghost">
                    Чек отправлен
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </article>
    </main>
  );
}
