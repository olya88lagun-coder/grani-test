"use client";

import { useState, type RefObject } from "react";
import { ANSWER_LIMIT, type QUESTIONS } from "@/lib/new-year-2027";
import styles from "./new-year.module.css";

type Question = typeof QUESTIONS[number];
export function YearQuestion({ question, step, value, titleRef, onChange, onNext, onBack }: {
  question: Question; step: number; value: string; titleRef: RefObject<HTMLHeadingElement | null>;
  onChange: (value: string) => void; onNext: (value: string) => void; onBack: () => void;
}) {
  const [custom, setCustom] = useState(Boolean(value && !question.options.includes(value)));
  return <section className={styles.question} aria-labelledby="question-title">
    <div className={styles.progressLine}><span>Вопрос {step + 1} из 6</span><progress value={step + 1} max={6} aria-label="Прогресс вопросов" /></div>
    <h1 id="question-title" className={styles.questionTitle} ref={titleRef} tabIndex={-1}>{question.title}</h1>
    <p className={styles.questionHint} id="question-hint">{question.hint}</p>
    <form onSubmit={(e) => { e.preventDefault(); onNext(value.trim()); }}>
      <fieldset className={styles.choices} aria-describedby="question-hint"><legend className={styles.srOnly}>{question.title}</legend>
        {question.options.map((option) => <label key={option} className={styles.option}><input type="radio" name={question.id} value={option} checked={!custom && value === option} onChange={() => { setCustom(false); onChange(option); }} /><span>{option}</span><span className={styles.radioMark} aria-hidden="true" /></label>)}
        <label className={styles.option}><input type="radio" name={question.id} checked={custom} onChange={() => { setCustom(true); onChange(""); }} /><span>Свой ответ</span><span className={styles.radioMark} aria-hidden="true" /></label>
      </fieldset>
      {custom && <div className={styles.custom}><label htmlFor="year-answer">Твой ответ</label><textarea id="year-answer" className="ym-disable-keys" value={value} onChange={(e) => onChange(e.target.value)} maxLength={ANSWER_LIMIT} rows={3} autoFocus /><span className={styles.fine}>{value.length} / {ANSWER_LIMIT}</span></div>}
      <div className={styles.questionActions}><button type="button" className={styles.secondary} onClick={onBack}>Назад</button><button className={styles.primary} disabled={!value.trim()} type="submit">{step === 5 ? "Моя карта 2027" : "Дальше"}<span aria-hidden="true">↗</span></button></div>
      <button type="button" className={styles.skip} onClick={() => onNext("")}>Пропустить этот вопрос</button>
    </form>
  </section>;
}
