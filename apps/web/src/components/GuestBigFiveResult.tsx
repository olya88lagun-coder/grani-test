"use client";

import { formatRub, PRODUCT_PRICES } from "@grani/core";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { GemPortrait } from "@/components/GemPortrait";
import { ScaleMeter } from "@/components/ScaleMeter";
import type { GuestBigFiveView } from "@/lib/guest-big-five-result";
import { gemAssetDir } from "@/lib/gem-assets";
import styles from "./GuestBigFiveResult.module.css";

// Гостевой бесплатный результат: тип, кристалл и шкалы сразу; сохранение, сторис, друзья и разбор — через вход
export function GuestBigFiveResult({
  view,
  onRestart,
  focusOnMount = false,
}: {
  view: GuestBigFiveView;
  onRestart?: () => void;
  focusOnMount?: boolean;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const gemDir = gemAssetDir(view.dir);
  useEffect(() => {
    if (focusOnMount) titleRef.current?.focus();
  }, [focusOnMount]);

  return (
    <section className={styles.result} data-testid="guest-big-five-result" aria-labelledby="guest-result-title">
      <div className={styles.hero}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Твой результат</p>
          <h1 id="guest-result-title" className={styles.title} ref={titleRef} tabIndex={-1}>
            {view.name}
          </h1>
          <p className={styles.lead}>
            Тип и пять шкал уже здесь. Чтобы сохранить результат, поделиться карточкой, позвать друзей или купить разбор —
            войди через VK ID.
          </p>
          <div className={styles.heroActions}>
            <Link className="button" href="/login">
              Сохранить результат <span aria-hidden="true">→</span>
            </Link>
            <Link className="button button--ghost" href="/login">
              Карточка для сторис
            </Link>
          </div>
        </header>

        <aside className={styles.card} aria-labelledby="guest-scales">
          <div className={styles.cardHead}>
            <GemPortrait dir={gemDir} size={260} priority />
            <p className={styles.cardEyebrow}>Твой тип</p>
            <p className={styles.cardName}>{view.name}</p>
          </div>
          <h2 id="guest-scales" className={styles.cardTitle}>
            Пять шкал личности
          </h2>
          <div className={styles.scales}>
            {view.scales.map((scale) => (
              <ScaleMeter key={scale.trait} scale={{ ...scale, text: "" }} />
            ))}
          </div>
        </aside>
      </div>

      <div className={styles.actions}>
        <Link className="button button--ghost" href="/login">
          Позвать друзей
        </Link>
        <Link className="button button--ghost" href="/login">
          Полный разбор — {formatRub(PRODUCT_PRICES.full)}
        </Link>
        {onRestart && (
          <button type="button" className="button button--ghost" onClick={onRestart}>
            Пройти заново
          </button>
        )}
      </div>
      <p className={styles.note}>После входа результат сохранится в кабинет — можно вернуться к нему с любого устройства.</p>
    </section>
  );
}
