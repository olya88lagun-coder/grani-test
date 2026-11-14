"use client";

import { useEffect, useId, useRef, useState } from "react";
import { reachGoalOnce } from "@/lib/analytics";
import styles from "./together-card-demo.module.css";

export function TogetherCardDemo({ prompt, className }: { prompt: string; className?: string }) {
  const titleId = useId();
  const nextRef = useRef<HTMLButtonElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const explicitlyTurned = useRef(false);
  const [step, setStep] = useState<"front" | "waiting" | "revealed">("front");
  const front = step === "front";
  const revealed = step === "revealed";

  useEffect(() => {
    if (explicitlyTurned.current) (front ? startRef : nextRef).current?.focus({ preventScroll: true });
  }, [front]);

  function turn() {
    explicitlyTurned.current = true;
    reachGoalOnce("fx_card_turn");
    setStep("waiting");
  }

  return (
    <article className={[className, styles.demo].filter(Boolean).join(" ")} aria-labelledby={titleId} data-card-demo={step}>
      <p className={styles.kicker}>Демо-карточка</p>
      <h3 id={titleId}>{prompt}</h3>
      <div className={styles.faces}>
        <div className={styles.front} aria-hidden={!front}>
          <p>Вспомните один момент и ответьте каждый за себя.</p>
        </div>
        <div className={styles.back} aria-hidden={front}>
          <p className={styles.answerLabel}>Пример ответа партнёра</p>
          <p className={styles.answer} data-revealed={revealed} aria-hidden={!revealed}>«Когда мы гуляли без плана и заговорились до темноты».</p>
          <p className={styles.status} role="status">{front ? "" : revealed ? "Оба ответа открыты." : "Ответ партнёра откроется после вашего."}</p>
        </div>
      </div>
      <div className={styles.actions}>
        <button type="button" className="button button--ghost" ref={startRef} tabIndex={front ? 0 : -1} aria-hidden={!front} onClick={turn}>Перевернуть карточку</button>
        <button type="button" className="button button--ghost" ref={nextRef} tabIndex={front ? -1 : 0} aria-hidden={front} onClick={() => {
          if (!revealed) reachGoalOnce("fx_card_reveal");
          setStep(revealed ? "front" : "revealed");
        }}>
          {revealed ? "Показать заново" : "Ответить в примере"}
        </button>
      </div>
    </article>
  );
}
