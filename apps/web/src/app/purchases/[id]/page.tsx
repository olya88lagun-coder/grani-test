import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PurchaseStatus } from "@/components/PurchaseStatus";
import { paymentsDeps } from "@/server/payments-deps";
import { getPurchaseView } from "@/server/payments-service";
import { requireUser } from "@/server/viewer";

export const metadata: Metadata = { title: "Оплата" };

export default async function PurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, requireUser()]);
  const deps = paymentsDeps();
  const view = deps ? await getPurchaseView(deps, { purchaseId: id, userId: user.id }) : null;
  if (!view) notFound();
  return (
    <main className="inner-page inner-page--wait">
      <div className="page page--wait">
        <PurchaseStatus initial={view} />
      </div>
    </main>
  );
}
