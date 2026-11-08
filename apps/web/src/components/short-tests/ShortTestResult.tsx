"use client";

import type { ShortTestDefinition } from "@grani/content/short-tests";
import { formatRub, PRODUCT_PRICES } from "@grani/core";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { quadrantLabels, type ShortResultView } from "@/lib/short-test-result";
import { AxisMap } from "./AxisMap";
import styles from "./short-tests.module.css";

// saved — сохранённый результат на /short/[id]: без «Пройти заново» и без кнопки разбора (покупка там своя)
export function ShortTestResult({
  test,
  view,
  onRestart,
  onOpenReport,
  focusOnMount = false,
  saved = false,
  partnerInvite = false,
}: {
  test: ShortTestDefinition;
  view: ShortResultView;
  onRestart?: () => void;
  // intent: личный разбор или позвать партнёра; ответы уходят на сервер только по этим кнопкам
  onOpenReport?: (intent: "report" | "pair") => Promise<string | null>;
  focusOnMount?: boolean;
  saved?: boolean;
  // Результат партнёра, пришедшего по приглашению: вместо покупки и приглашения — переход к общей карте
  partnerInvite?: boolean;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  async function openReport(intent: "report" | "pair") {
    if (!onOpenReport || opening) return;
    setOpening(true);
    setOpenError(null);
    const error = await onOpenReport(intent);
    if (error) {
      setOpenError(error);
      setOpening(false);
    }
  }
  // Кнопка отправки исчезла вместе с тестом: фокус переводим на результат, чтобы клавиатура и читалка не потерялись.
  // При открытии сохранённого результата фокус не трогаем — человек только зашёл на страницу
  useEffect(() => {
    if (focusOnMount) titleRef.current?.focus();
  }, [focusOnMount]);
  // Ось X — вторая ось теста, ось Y — первая: у привязанности это избегание и тревожность
  const [yAxis, xAxis] = view.axes as [ShortResultView["axes"][number], ShortResultView["axes"][number]];
  return (
    <section className={styles.result} data-band="night" aria-labelledby="short-result-title" data-testid="short-result">
      <header className={styles.resultHeader}>
        <h2 id="short-result-title" className={styles.resultTitle} ref={titleRef} tabIndex={-1}>{view.type.name}</h2>
        <p className={styles.tagline}>{view.type.tagline}</p>
      </header>
      <div className={styles.resultGrid}>
        <AxisMap xLabel={xAxis.info.label} yLabel={yAxis.info.label} x={xAxis.value} y={yAxis.value} quadrantLabels={quadrantLabels(test, xAxis.info.key, yAxis.info.key)} />
        <div className={styles.axes}>
          {view.axes.map((axis) => (
            <div key={axis.info.key} className={styles.axis}>
              <div className={styles.axisHead}>
                <span>{axis.info.label}</span>
                <b>{axis.value}%</b>
              </div>
              <div className={styles.meter} aria-hidden="true">
                <span style={{ width: `${axis.value}%` }} />
              </div>
              <p>{axis.text}</p>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.explanation}>
        <p className={styles.summary}>{view.type.summary}</p>
        <p className={styles.disclaimer}>{test.disclaimer}</p>
      </div>
      {!saved && partnerInvite && onOpenReport && (
        <div className={styles.reportOffer}>
          <button type="button" className="button" onClick={() => openReport("pair")} disabled={opening}>
            {opening ? "Открываем…" : "Увидеть общую карту"}
          </button>
          <p className={styles.disclaimer}>Нужно войти через VK и согласиться объединить результаты.</p>
        </div>
      )}
      {!saved && !partnerInvite && test.reportOffer && onOpenReport && (
        <div className={styles.reportOffer}>
          <button type="button" className="button" onClick={() => openReport("report")} disabled={opening}>
            {opening ? "Открываем…" : `Открыть личный разбор — ${formatRub(PRODUCT_PRICES.attachment_solo)}`}
          </button>
          <p className={styles.disclaimer}>{test.reportOffer.preview.slice(0, 4).join(" · ")}</p>
        </div>
      )}
      {!saved && !partnerInvite && test.pairOffer && onOpenReport && (
        <div className={styles.reportOffer}>
          <button type="button" className="button button--ghost" onClick={() => openReport("pair")} disabled={opening}>
            Пройти вдвоём с партнёром
          </button>
          <p className={styles.disclaimer}>{test.pairOffer.lead}</p>
        </div>
      )}
      {openError && (
        <p className="error" role="alert">
          {openError}
        </p>
      )}
      <div className={styles.actions}>
        <Link className={saved ? "button button--ghost" : "button"} href={`${test.path}/${view.type.slug}`}>
          Подробнее о своём типе
        </Link>
        <Link className="button button--ghost" href="/big-five-test">
          Почему у вас так — тест Big Five
        </Link>
        {onRestart && !saved && (
          <button type="button" className="button button--ghost" onClick={onRestart}>
            Пройти заново
          </button>
        )}
      </div>
    </section>
  );
}
