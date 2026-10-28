"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { ANSWER_LIMIT, type QUESTIONS } from "@/lib/new-year-2027";
import styles from "./new-year.module.css";

type Question = typeof QUESTIONS[number];
// A short pause where the chosen answer fades out before the next question. Only for "what to leave behind"; skipped for reduced motion.
const DISSOLVE_MS = 850;
const prefersReducedMotion = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function YearQuestion({ question, step, value, titleRef, onChange, onNext, onBack }: {
  question: Question; step: number; value: string; titleRef: RefObject<HTMLHeadingElement | null>;
  onChange: (value: string) => void; onNext: (value: string) => void; onBack: () => void;
}) {
  const [custom, setCustom] = useState(Boolean(value && !question.options.includes(value)));
  const [dissolving, setDissolving] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  function submit() {
    const answer = value.trim();
    if (question.id !== "release" || !answer || prefersReducedMotion()) { onNext(answer); return; }
    setDissolving(true);
    timer.current = window.setTimeout(() => onNext(answer), DISSOLVE_MS);
  }
  return <section className={styles.question} aria-labelledby="question-title">
    <div className={styles.progressLine}><span>Вопрос {step + 1} из 6</span><progress value={step + 1} max={6} aria-label="Прогресс вопросов" /></div>
    <h1 id="question-title" className={styles.questionTitle} ref={titleRef} tabIndex={-1}>{question.title}</h1>
    <p className={styles.questionHint} id="question-hint">{question.hint}</p>
    <form className={dissolving ? styles.dissolving : undefined} onSubmit={(e) => { e.preventDefault(); if (!dissolving) submit(); }}>
      <fieldset className={styles.choices} aria-describedby="question-hint" disabled={dissolving}><legend className={styles.srOnly}>{question.title}</legend>
        {question.options.map((option) => <label key={option} className={styles.option}><input type="radio" name={question.id} value={option} checked={!custom && value === option} onChange={() => { setCustom(false); onChange(option); }} /><span>{option}</span><span className={styles.radioMark} aria-hidden="true" /></label>)}
        <label className={styles.option}><input type="radio" name={question.id} checked={custom} onChange={() => { setCustom(true); onChange(""); }} /><span>Свой ответ</span><span className={styles.radioMark} aria-hidden="true" /></label>
      </fieldset>
      {custom && <div className={styles.custom}><label htmlFor="year-answer">Твой ответ</label><textarea id="year-answer" className="ym-disable-keys" value={value} onChange={(e) => onChange(e.target.value)} maxLength={ANSWER_LIMIT} rows={3} autoFocus disabled={dissolving} /><span className={styles.fine}>{value.length} / {ANSWER_LIMIT}</span></div>}
      {dissolving && <p className={styles.releaseNote} role="status">Оставляем это в 2026…</p>}
      <div className={styles.questionActions}><button type="button" className={styles.secondary} disabled={dissolving} onClick={onBack}>Назад</button><button className={styles.primary} disabled={!value.trim() || dissolving} type="submit">{step === 5 ? "Моя карта 2027" : "Дальше"}<span aria-hidden="true">↗</span></button></div>
      <button type="button" className={styles.skip} disabled={dissolving} onClick={() => onNext("")}>Пропустить этот вопрос</button>
    </form>
  </section>;
}
