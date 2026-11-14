"use client";

import type { Answers, ItemKey } from "@grani/core";
import { useEffect } from "react";
import { reachGoalOnce } from "@/lib/analytics";
import { previewFamily } from "@/lib/test-crystal";
import { ProgressCrystal, PROGRESS_FACET_COUNT } from "./ProgressCrystal";
import styles from "./test-crystal-progress.module.css";

export function TestCrystalProgress({ items, answers, done }: { items: readonly ItemKey[]; answers: Answers; done: number }) {
  const remaining = items.length - done;
  const showTeaser = remaining >= 3 && remaining <= 5;
  const reached = remaining <= 5;
  const family = done === 0 ? undefined : previewFamily(items, answers);
  useEffect(() => {
    if (reached) reachGoalOnce("fx_teaser_seen");
  }, [reached]);
  const lit = done === 0 ? 0 : Math.max(1, Math.floor((done / items.length) * PROGRESS_FACET_COUNT));

  return (
    <div className={styles.progress}>
      <div className={styles.count} role="progressbar" aria-label="Прогресс ответов" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={done}>
        <ProgressCrystal size={72} family={family} lit={lit} />
        <span>Ответов: {done} из {items.length}</span>
      </div>
      <div className={styles.teaser} data-visible={reached} aria-hidden={!reached} data-test-teaser>
        <span className={styles.silhouette}><ProgressCrystal size={46} family={family} lit={PROGRESS_FACET_COUNT} /></span>
        <div role={reached ? "status" : undefined}>
          <p className={styles.masked} aria-hidden="true">Твой тип</p>
          <p>{showTeaser ? `Результат через ${remaining} ${remaining === 5 ? "ответов" : "ответа"}` : remaining === 0 ? "Все ответы готовы" : "Твой тип скоро откроется"}</p>
        </div>
      </div>
    </div>
  );
}
