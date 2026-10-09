"use client";
import { useState, type ReactNode } from "react";
import { buildPairGuide, PAIR_GUIDE_CONTENTS, pairGap, type Perspective } from "@/lib/pair-guide";
import type { PairView } from "@/lib/pair-view";
import { PairAgreements } from "./PairAgreements";
import { PairProfiles } from "./PairProfiles";
import { PairSituations } from "./PairSituations";
import { PairIcon } from "./PairIcon";
import styles from "./pair-map.module.css";

const NAV_ICONS = ["heart","profile","life","translate","talk","agreement","summary"] as const;
const STEPS = [
  { title: "Проверьте готовность", text: "Выберите спокойное время и одну тему. Спросите, готов ли партнёр сейчас обсуждать её.", phrase: "Мне важно обсудить одну вещь. Сейчас подходящее время?" },
  { title: "Назовите факт и чувство", text: "Опишите конкретный эпизод без «ты всегда». Скажите, что вы почувствовали, не объясняя за партнёра его мотивы.", phrase: "Когда наш план изменился без обсуждения, я растерялся(ась). Мне важно знать о переменах заранее." },
  { title: "Услышьте другую сторону", text: "Спросите, как ситуацию видит партнёр. Перескажите услышанное и уточните, правильно ли поняли.", phrase: "Я слышу, что тебе важна свобода менять планы. Верно? Что я ещё не учёл(ла)?" },
  { title: "Выберите маленький шаг", text: "Предложите один конкретный опыт на неделю. Назовите, когда обсудите, подошёл ли он вам обоим.", phrase: "Попробуем предупреждать об изменениях заранее и через неделю обсудим, стало ли нам удобнее?" },
];

export function PairGuide({ view, storageKey, children }: { view: PairView; storageKey: string; children: ReactNode }) {
  const [perspective,setPerspective] = useState<Perspective>("you");
  const [translation,setTranslation] = useState("conflict");
  const [step,setStep] = useState(0);
  const [activeSection,setActiveSection] = useState("overview");
  const guide = buildPairGuide(view,perspective);
  const translated = guide.situations.find(s => s.id === translation)!;
  function changeTranslation(direction: number) {
    const index = guide.situations.findIndex(s => s.id === translation);
    setTranslation(guide.situations[(index + direction + 8) % 8]!.id);
  }
  return <div className={styles.guide}>
    <nav className={styles.contents} aria-label="Разделы карты пары">{PAIR_GUIDE_CONTENTS.map((item,i) => <a key={item.id} href={`#${item.id}`} aria-current={activeSection === item.id ? "location" : undefined} onClick={() => setActiveSection(item.id)}><PairIcon name={NAV_ICONS[i]!} />{item.title}</a>)}</nav>

    <section id="overview" className={`${styles.section} ${styles.overviewSection}`} aria-labelledby="overview-title">
      <div className={styles.overviewCopy}><p className={styles.kicker}>01 / Главное о вашей паре</p><h2 id="overview-title">{pairGap(guide.difference) > 25 ? <>Разные подходы.<br />Общая история.</> : <>Похожие грани.<br />Ваш способ быть вместе.</>}</h2><p>Ваши ответы помогают увидеть общие черты и различия. Иногда вам удобно одно и то же, а иногда нужен разговор о потребностях каждого.</p><p>Здесь нет готового сценария отношений. Есть карта, с которой можно начать искать свой баланс.</p><p className={styles.note}>Индекс {view.score}% описывает сочетание профилей. Он не измеряет любовь и не предсказывает успех пары.</p></div>
      <div className={styles.overviewInsights}>
        <article><span className={styles.insightIcon}><PairIcon name="gem" /></span><div><h3>Ваша общая грань</h3><p>Ближе всего ответы по шкале «{guide.common.label}». Разница — {pairGap(guide.common)} из 100. Обсудите, в чём вы это узнаёте.</p></div></article>
        <article><span className={styles.insightIcon}><PairIcon name="translate" /></span><div><h3>Главное различие</h3><p>«{guide.difference.label}»: разница {pairGap(guide.difference)} из 100. {pairGap(guide.difference) > 25 ? "Возможно, вам удобны разные подходы. Это повод уточнить ожидания друг друга." : "Большого расхождения по шкалам нет. Похожие ответы всё равно не заменяют диалога."}</p></div></article>
        <article><span className={styles.insightIcon}><PairIcon name="leaf" /></span><div><h3>С чего начать</h3><p>Выберите одну жизненную ситуацию и спросите: «Что в этой подсказке похоже на нас, а что совсем не подходит?»</p></div></article>
      </div>
    </section>

    <PairProfiles view={view} onPerspectiveChange={setPerspective} />
    <PairSituations guide={guide} />

    <div className={styles.middleGrid}>
      <section id="translator" className={`${styles.section} ${styles.translatorSection}`} aria-labelledby="translator-title">
        <header className={styles.sectionHead}><div><p className={styles.kicker}>04 / Переводчик друг друга</p><h2 id="translator-title">Что за словами может стоять на самом деле?</h2></div><div className={styles.carouselControls}><button type="button" aria-label="Предыдущая тема переводчика" onClick={() => changeTranslation(-1)}>‹</button><button type="button" aria-label="Следующая тема переводчика" onClick={() => changeTranslation(1)}>›</button></div></header>
        <p className={styles.sectionIntro}>Не чтение мыслей. Возможная потребность и формулировка, которая помогает спросить о ней напрямую.</p>
        <label className={styles.selectLabel} htmlFor="translation">О чём говорим</label><select id="translation" className={styles.select} value={translation} onChange={event => setTranslation(event.target.value)}>{guide.situations.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select>
        <div className={styles.translation} aria-live="polite"><div className={styles.translationTitle}><PairIcon name="translate" /><strong>{translated.title}</strong></div><div className={styles.translationColumns}><div><p className={styles.kicker}>{guide.subject.firstName} · возможная потребность</p><p data-translation-need>{translated.need}</p></div><div><p className={styles.kicker}>{guide.other.firstName} · другая перспектива</p><p>{translated.partnerNeed}</p></div></div><div className={styles.translationPhrase}><PairIcon name="talk" /><div><h3>Как начать разговор</h3><blockquote>{translated.phrase}</blockquote></div></div><p className={styles.translationEvidence}>Гипотеза: «{translated.label}» · {translated.score} и {translated.otherScore} из 100. Проверьте её друг с другом.</p></div>
      </section>

      <section id="conversation" className={`${styles.section} ${styles.conversationSection}`} aria-labelledby="conversation-title">
        <header className={styles.sectionHead}><div><p className={styles.kicker}>05 / Карта сложных разговоров</p><h2 id="conversation-title">Разговор без взаимных обвинений</h2></div></header><p className={styles.sectionIntro}>Одна тема за раз. Четыре шага, которые можно пройти в своём темпе.</p>
        <div className={styles.steps} role="group" aria-label="Шаги разговора">{STEPS.map((item,i) => <button key={item.title} type="button" aria-pressed={step === i} onClick={() => setStep(i)}><span>0{i + 1}</span><span><strong>{item.title}</strong><small>{item.text}</small></span></button>)}</div>
        <div className={styles.stepDetail} aria-live="polite"><p className={styles.kicker}>Шаг {step + 1} из 4 · попробуйте сказать</p><blockquote>{STEPS[step]!.phrase}</blockquote></div>
      </section>
    </div>

    <div className={styles.bottomGrid}>
      <PairAgreements key={storageKey} storageKey={storageKey} />
      <section id="summary" className={`${styles.section} ${styles.summary}`} aria-labelledby="summary-title"><p className={styles.kicker}>07 / Ваш персональный итог</p><h2 id="summary-title">Вам не нужно становиться одинаковыми.</h2><p>Начните с одной ситуации. Проверьте гипотезу и выберите маленький шаг, который подходит обоим.</p><a className="button" href="#agreements">Вернуться к договорённостям <span aria-hidden="true">↗</span></a><div className={styles.pdf}><h3>Карта в PDF</h3><p>Скачивание пока недоступно. Сейчас разбор можно читать и использовать на этой странице.</p><span className={styles.badge}>Следующий этап</span></div></section>
    </div>
    {children}
    <p className={styles.reportNote}>Материалы для самопознания, не психологическая и не медицинская диагностика. Общий опрос и подтверждение договорённостей обоими пока недоступны.</p>
  </div>;
}
