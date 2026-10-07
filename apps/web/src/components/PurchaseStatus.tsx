"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { PRODUCT_PRICES } from "@grani/core";
import { goalForProduct, reachGoal } from "@/lib/analytics";
import { OPERATOR } from "@/lib/legal";
import { pollDelayMs, purchaseStage, STAGE_TEXT } from "@/lib/purchase-view";
import type { PurchaseView } from "@/server/payments-service";

// Страницу ожидания можно открыть повторно — цель покупки отправляется один раз на покупку
function markPurchase(view: PurchaseView): void {
  if (view.free) return;
  const key = `grani-goal-${view.id}`;
  try {
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
  } catch {
    // без sessionStorage цель может уйти дважды — это не страшнее, чем потерять её
  }
  reachGoal(goalForProduct(view.product), { order_price: PRODUCT_PRICES[view.product] / 100, currency: "RUB" });
}

export function PurchaseStatus({ initial }: { initial: PurchaseView }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  // Счётчик перезапускает опрос и после неудачного запроса: иначе при одном сбое сети опрос остановился бы навсегда
  const [round, setRound] = useState(0);
  const elapsed = now - Date.parse(view.since);
  const stage = purchaseStage(view, elapsed);
  const finished = stage === "ready" || stage === "not_paid" || stage === "refunded";

  useEffect(() => {
    if (stage === "ready") {
      markPurchase(view);
      router.replace(view.reportUrl);
      return;
    }
    if (finished) return;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/purchases/${view.id}`, { cache: "no-store" });
        if (response.ok) setView((await response.json()) as PurchaseView);
      } catch {
        // Сеть мигнула — следующий опрос по расписанию
      }
      setNow(Date.now());
      setRound((value) => value + 1);
    }, pollDelayMs(elapsed));
    return () => clearTimeout(timer);
  }, [view, stage, finished, elapsed, round, router]);

  const text = STAGE_TEXT[stage];

  if (stage === "not_paid" || stage === "refunded" || stage === "payment_unconfirmed") {
    return (
      <WaitCard busy={stage === "payment_unconfirmed"}>
        <h1 className="display">{text.title}</h1>
        <p className="lead">{text.lead}</p>
        <div>
          <Link className="button" href={view.reportUrl}>
            Вернуться
          </Link>
        </div>
      </WaitCard>
    );
  }
  if (stage === "awaiting_payment") {
    return (
      <WaitCard busy>
        <h1 className="display">{text.title}</h1>
        <p className="lead">{text.lead}</p>
      </WaitCard>
    );
  }
  const ready = stage === "ready";
  return (
    <WaitCard busy={!ready}>
      <h1 className="display">{text.title}</h1>
      <p className="lead">{text.lead}</p>
      <ol className="wait-steps">
        <li className="wait-steps__done">Собираем ответы</li>
        <li className={ready ? "wait-steps__done" : "wait-steps__active"}>Формируем портрет</li>
        <li className={ready ? "wait-steps__done" : undefined}>Откроем страницу автоматически</li>
      </ol>
      {stage === "preparing_long" && (
        <p className="muted">
          Напишите на <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>, если разбор не появится.
        </p>
      )}
      {ready && (
        <div>
          <Link className="button" href={view.reportUrl}>
            Открыть разбор <span aria-hidden="true">→</span>
          </Link>
        </div>
      )}
    </WaitCard>
  );
}

// Центральная карточка ожидания; кристалл медленно «дышит», пока идёт работа
function WaitCard({ busy = false, children }: { busy?: boolean; children: ReactNode }) {
  return (
    <div className="wait-card stack" role="status">
      <img className={busy ? "wait-card__gem wait-card__gem--busy" : "wait-card__gem"} src="/home/hero-crystal.webp" alt="" width={908} height={1062} />
      {children}
    </div>
  );
}
