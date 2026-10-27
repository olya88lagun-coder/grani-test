"use client";

import { buildYearMap } from "@/lib/new-year-2027";
import { SAMPLE_ANSWERS } from "@/lib/new-year-cards";
import { YEAR_FAQ } from "@/lib/new-year-faq";
import styles from "./new-year.module.css";

const SAMPLE = buildYearMap(SAMPLE_ANSWERS);
const STEPS = [
  { title: "Шесть коротких вопросов", text: "О прошедшем годе и о следующем. Любой можно пропустить или ответить по-своему." },
  { title: "Личная карта 2027", text: "Слово года, опора, то, что стоит оставить в 2026, первый шаг на 10 минут и запасной план." },
  { title: "Карточки и обои", text: "Сохрани карту себе или поделись только тем, чем хочется. Ответы не уходят на сервер." },
] as const;

export function YearLanding({ onStart, disabled }: { onStart: () => void; disabled: boolean }) {
  return <>
    <section className={styles.sample} aria-labelledby="sample-title">
      <div className={styles.sectionHead}>
        <p className={styles.eyebrow}>Итоги года в одной карте</p>
        <h2 id="sample-title">Так выглядит карта</h2>
        <p className={styles.sectionLead}>Не общее «тебя ждёт успех», а история из твоих ответов. Ниже пример: он собран из готовых вариантов и не является чьим-то результатом.</p>
      </div>
      <div className={styles.paper} aria-label="Демонстрационный пример карты">
        <p className={styles.paperKicker}>Демонстрационный пример</p>
        <h3 className={styles.sampleTitle}>{SAMPLE.title}</h3>
        <p className={styles.paperWord}>Слово 2027 — <strong>{SAMPLE.word}</strong></p>
        {SAMPLE.lead && <p className={styles.paperLead}>{SAMPLE.lead}</p>}
        <div className={styles.sampleGrid}>
          <div><h4>Моя опора</h4><p>{SAMPLE.strength}</p></div>
          {SAMPLE.leave && <div><h4>{SAMPLE.leave.title}</h4><p>{SAMPLE.leave.text}</p></div>}
          <div><h4>Первый шаг</h4><p>{SAMPLE.firstStep}</p></div>
          <div><h4>Если что-то помешает</h4><p>{SAMPLE.ifThen}</p></div>
        </div>
      </div>
    </section>

    <section className={styles.steps} aria-labelledby="steps-title">
      <h2 id="steps-title">Как это работает</h2>
      <ol>{STEPS.map((step, index) => <li key={step.title}><span className={styles.sectionNumber}>{String(index + 1).padStart(2, "0")}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></li>)}</ol>
    </section>

    <section className={styles.honest} aria-labelledby="honest-title">
      <h2 id="honest-title">Это не гороскоп</h2>
      <p>Карта не предсказывает 2027-й и не обещает успеха. Она помогает сформулировать, каким ты хочешь сделать год и на что опереться.</p>
      <p>Опираемся мы на одно: план вида «если случится X, то я сделаю Y». В метаанализе Готтвитцера и Шиэна такие конкретные планы помогали чаще доводить намерение до действия. Остальное в карте — не диагноз и не прогноз, а варианты, которые можно менять.</p>
      <p className={styles.citation}>Gollwitzer, P. M., &amp; Sheeran, P. (2006). Implementation intentions and goal achievement: a meta-analysis of effects and processes. Advances in Experimental Social Psychology, 38, 69–119.</p>
    </section>

    <section className={styles.faq} aria-labelledby="faq-title">
      <h2 id="faq-title">Частые вопросы</h2>
      {YEAR_FAQ.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}
    </section>

    <section className={styles.endCta} aria-label="Начать">
      <p>Не весь год сразу.<br /><em>Один свой шаг.</em></p>
      <button type="button" className={styles.primary} onClick={onStart} disabled={disabled}>Начать с первого вопроса <span aria-hidden="true">↗</span></button>
      <p className={styles.fine}>6 вопросов · около 3 минут · бесплатно</p>
    </section>
  </>;
}
