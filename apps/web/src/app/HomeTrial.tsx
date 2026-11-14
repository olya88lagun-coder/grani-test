"use client";

import type { Answer } from "@grani/core";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { reachGoalOnce } from "@/lib/analytics";
import { ProgressCrystal } from "@/components/ProgressCrystal";
import { ANSWER_LABELS, ANSWER_VALUES } from "@/lib/test-progress";
import styles from "./home-trial.module.css";

export type TrialAnswer = { itemId: string; value: Answer };

type Props = {
  item: { id: string; text: string };
  continueHref: string;
  onContinue?: (answer: TrialAnswer) => Promise<void>;
  remaining: number;
};

export function HomeTrial({ item, continueHref, onContinue, remaining }: Props) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const handingOff = useRef(false);
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = section.current;
    if (!node || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      reachGoalOnce("fx_trial_seen");
      observer.disconnect();
    }, { threshold: 0.4 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function pick(value: Answer) {
    reachGoalOnce("fx_trial_pick");
    setAnswer(value);
  }

  async function continueWithAnswer() {
    if (answer === null || !onContinue || handingOff.current) return;
    handingOff.current = true;
    setPending(true);
    setFailed(false);
    try {
      await onContinue({ itemId: item.id, value: answer });
      window.location.assign(continueHref);
    } catch {
      handingOff.current = false;
      setPending(false);
      setFailed(true);
    }
  }

  return (
    <section ref={section} className={styles.section} data-band="night" aria-labelledby="home-trial-title">
      <div className={styles.panel} data-answered={answer !== null}>
        <div className={styles.intro}>
          <h2 id="home-trial-title">Открой первую грань</h2>
          <div className={styles.crystal}><ProgressCrystal size={156} family={2} lit={answer === null ? 0 : 1} /></div>
          <div className={styles.feedback}>
            <p aria-hidden={answer !== null} className={answer === null ? styles.active : undefined}>Попробуй одно утверждение из теста.</p>
            <p aria-hidden={answer === null} className={answer !== null ? styles.active : undefined}>
              {onContinue ? `Ещё ${remaining} — и камень станет твоим.` : `Первая грань открыта. В полном тесте — ${remaining + 1} утверждений.`}
            </p>
          </div>
          <span className={styles.status} role="status">{answer !== null ? "Первая грань открыта." : ""}</span>
        </div>
        <div className={styles.form}>
          <fieldset disabled={pending}>
            <legend>{item.text}</legend>
            <div className={styles.options}>
              {ANSWER_VALUES.map((value) => (
                <label key={value} className={styles.option} data-selected={answer === value}>
                  <input type="radio" name="home-trial" value={value} checked={answer === value} onChange={() => pick(value)} />
                  {ANSWER_LABELS[value]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className={styles.action}>
            {onContinue ? (
              <button type="button" className="button" disabled={answer === null || pending} onClick={continueWithAnswer}>
                {pending ? "Открываем тест…" : "Продолжить тест"} <span aria-hidden="true">→</span>
              </button>
            ) : (
              <Link href={continueHref} className="button" prefetch={false}>Перейти к тесту <span aria-hidden="true">→</span></Link>
            )}
          </div>
          {failed && <p className={styles.error} role="alert">Не удалось перенести ответ. Попробуй ещё раз или <Link href={continueHref}>открой тест</Link>.</p>}
        </div>
      </div>
    </section>
  );
}
