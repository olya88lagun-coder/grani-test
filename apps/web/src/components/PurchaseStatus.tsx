"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { PurchaseView } from "@/server/payments-service";

const POLL_MS = 3000;

export function PurchaseStatus({ initial }: { initial: PurchaseView }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const finished = view.ready || view.status === "canceled" || view.status === "refunded";

  useEffect(() => {
    if (view.ready) {
      router.replace(view.reportUrl);
      return;
    }
    if (finished) return;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/purchases/${view.id}`, { cache: "no-store" });
        if (response.ok) setView((await response.json()) as PurchaseView);
      } catch {
        // Сеть мигнула — следующий опрос через 3 секунды
      }
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [view, finished, router]);

  if (view.status === "canceled" || view.status === "refunded") {
    return (
      <div className="stack">
        <h1 className="display">Оплата не прошла</h1>
        <p className="lead">Деньги не списаны. Можно попробовать ещё раз.</p>
        <div>
          <Link className="button" href={view.reportUrl.startsWith("/pair/") ? view.reportUrl : "/me"}>
            Вернуться
          </Link>
        </div>
      </div>
    );
  }
  if (view.status === "pending") {
    return (
      <div className="stack" role="status">
        <h1 className="display">Ждём подтверждения оплаты</h1>
        <p className="lead">Обычно это занимает несколько секунд.</p>
      </div>
    );
  }
  return (
    <div className="stack" role="status">
      <h1 className="display">{view.ready ? "Разбор готов" : "Готовим разбор"}</h1>
      <p className="lead">Около минуты. Страницу можно не обновлять — когда всё будет готово, придёт сообщение.</p>
      {view.ready && (
        <div>
          <Link className="button" href={view.reportUrl}>
            Открыть разбор <span aria-hidden="true">→</span>
          </Link>
        </div>
      )}
    </div>
  );
}
