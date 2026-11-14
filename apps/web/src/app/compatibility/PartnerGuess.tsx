"use client";

import Link from "next/link";
import type { Answer } from "@grani/core";
import { useEffect, useState, useRef } from "react";
import { reachGoalOnce } from "@/lib/analytics";
import { PairFacetArt } from "@/components/PairFacetArt";
import { ANSWER_LABELS, ANSWER_VALUES } from "@/lib/test-progress";
import styles from "./partner-guess.module.css";

export type PartnerPrediction = { itemId: string; value: Answer };

type Props = {
  item: { id: string; text: string };
  inviteHref: string;
  onInvite?: (prediction: PartnerPrediction) => Promise<void>;
};

export function PartnerGuess({ item, inviteHref, onInvite }: Props) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const submitting = useRef(false);
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = section.current;
    if (!node || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      reachGoalOnce("fx_guess_seen");
      observer.disconnect();
    }, { threshold: 0.4 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function pick(value: Answer) {
    reachGoalOnce("fx_guess_pick");
    setAnswer(value);
  }

  async function invite() {
    if (answer === null || !onInvite || submitting.current) return;
    submitting.current = true;
    setPending(true);
    setFailed(false);
    try {
      await onInvite({ itemId: item.id, value: answer });
      window.location.assign(inviteHref);
    } catch {
      submitting.current = false;
      setPending(false);
      setFailed(true);
    }
  }

  return (
    <section ref={section} className={styles.panel} data-band="night" data-palette="pair" aria-labelledby="partner-guess-title">
      <div className={styles.story}>
        <h2 id="partner-guess-title">Угадай партнёра</h2>
        <PairFacetArt joined={answer !== null} preview />
        <div className={styles.feedback}>
          <p aria-hidden={answer !== null} data-active={answer === null}>Представь, что партнёр отвечает на это утверждение.</p>
          <p aria-hidden={answer === null} data-active={answer !== null}>
            {onInvite ? "Узнай, угадал ли ты. Позови партнёра." : "Прогноз готов. Позови партнёра пройти тест."}
          </p>
        </div>
        <span className={styles.status} role="status">{answer !== null ? "Прогноз выбран." : ""}</span>
      </div>
      <div className={styles.form}>
        <fieldset disabled={pending}>
          <legend>Как ответит партнёр?</legend>
          <p className={styles.question}>{item.text}</p>
          <div className={styles.options}>
            {ANSWER_VALUES.map(value => (
              <label key={value} data-selected={answer === value}>
                <input type="radio" name="partner-guess" value={value} checked={answer === value} onChange={() => pick(value)} />
                {ANSWER_LABELS[value]}
              </label>
            ))}
          </div>
        </fieldset>
        {onInvite
          ? <button type="button" className="button" disabled={answer === null || pending} onClick={invite}>{pending ? "Открываем приглашение…" : "Позвать партнёра"}</button>
          : <Link className="button" href={inviteHref} prefetch={false}>Позвать партнёра <span aria-hidden="true">→</span></Link>}
        {failed && <p role="alert">Прогноз не сохранился. Повтори попытку или <Link href={inviteHref}>открой приглашение</Link>.</p>}
      </div>
    </section>
  );
}
