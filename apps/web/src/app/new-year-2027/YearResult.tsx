"use client";

import { type RefObject } from "react";
import { ANSWER_LIMIT, cleanWord, isStockWord, type YearMap, type YearEdits } from "@/lib/new-year-2027";
import { buildSlides, wallpaperWord } from "@/lib/new-year-cards";
import { trackYearEvent } from "@/lib/new-year-analytics";
import { YearCards } from "./YearCards";
import { YearShare } from "./YearShare";
import { YearWord } from "./YearWord";
import styles from "./new-year.module.css";

export type ProfileStatus = "loading" | "available" | "guest" | "missing" | "unavailable";

export function YearResult({ map, edits, onEdits, titleRef, onEdit, profileStatus }: {
  map: YearMap; edits: YearEdits; onEdits: (edits: YearEdits) => void; titleRef: RefObject<HTMLHeadingElement | null>; onEdit: () => void; profileStatus: ProfileStatus;
}) {
  const firstStep = edits.firstStep ?? map.firstStep;
  const ifThen = edits.ifThen ?? map.ifThen;
  const word = cleanWord(edits.word) || map.word;
  // An emptied textarea stays empty on screen, but cards and the share image fall back to the generated text instead of rendering blank.
  const stepText = firstStep.trim() ? firstStep : map.firstStep;
  const planText = ifThen.trim() ? ifThen : map.ifThen;
  const slides = buildSlides(map, word, stepText, planText);
  const num = (index: number) => String(index).padStart(2, "0");
  const goalIndex = map.leave ? 3 : 2;
  const hasProfile = profileStatus === "available";
  return <section className={styles.result} aria-labelledby="map-title">
    <div className={styles.resultHeading}><p className={styles.eyebrow}>Твоя карта 2027</p><h1 id="map-title" ref={titleRef} tabIndex={-1}>{map.title}</h1><p>Не прогноз. Ориентир, который можно менять вместе с собой.</p></div>
    <div className={styles.paper}>
      <p className={styles.paperKicker}>В новый год я беру</p><h2>{map.direction}</h2>
      <p className={styles.paperWord}>Слово 2027 — <strong>{word}</strong></p>
      {map.lead && <p className={styles.paperLead}>{map.lead}</p>}
      {map.reflections.length > 0 ? <details className={styles.reflections}><summary>Мой 2026 и то, что важно дальше</summary><dl>{map.reflections.map((r) => <div key={r.id}><dt>{r.label}</dt><dd>{r.text}</dd></div>)}</dl></details> : <p className={styles.paperNote}>Вопросы пропущены. Это общий черновик: добавь свои ответы или уточни шаг ниже.</p>}
      <div className={styles.mapSection}><span className={styles.sectionNumber}>{num(1)}</span><div><h3>Мои опоры</h3><p className={styles.paperNote}>{map.profileUsed ? "Варианты с учётом твоих пяти шкал Big Five. Проверь, подходят ли они тебе: профиль не определяет твой выбор." : "По твоим ответам, без профиля Big Five. Черты личности здесь не определяются."}</p>{map.strength && <p className={styles.strength}>{map.strength}</p>}<ul className={styles.supports}>{map.supports.map((s) => <li key={s}>{s}</li>)}</ul></div></div>
      {map.leave && <div className={styles.mapSection}><span className={styles.sectionNumber}>{num(2)}</span><div><h3>{map.leave.title}</h3><p className={styles.strength}>{map.leave.text}</p></div></div>}
      <div className={styles.mapSection}><span className={styles.sectionNumber}>{num(goalIndex)}</span><div><h3>Одна личная цель</h3><p className={styles.goal}>{map.goal}</p><label className={styles.editorLabel} htmlFor="first-step">Первый шаг — уточни под себя</label><textarea id="first-step" className="ym-disable-keys" value={firstStep} onChange={(e) => onEdits({ ...edits, firstStep: e.target.value })} maxLength={ANSWER_LIMIT} rows={4} /><p className={styles.paperNote}>Лучше конкретное действие на 10 минут. При изменении цели или направления шаг соберётся заново.</p></div></div>
      <div className={styles.mapSection}><span className={styles.sectionNumber}>{num(goalIndex + 1)}</span><div><h3>Если что-то помешает</h3><label className={styles.editorLabel} htmlFor="if-then">Мой план «если — то»</label><textarea id="if-then" className="ym-disable-keys" value={ifThen} onChange={(e) => onEdits({ ...edits, ifThen: e.target.value })} maxLength={ANSWER_LIMIT} rows={4} /><p className={styles.paperNote}>Запасной маршрут, а не ещё одно требование к себе. При изменении препятствия план соберётся заново.</p></div></div>
      <p className={styles.paperClosing}>Не весь год сразу.<br /><em>Один свой шаг.</em></p>
    </div>
    <button type="button" className={styles.secondary} onClick={onEdit}>Изменить ответы</button>
    <YearWord word={word} raw={edits.word ?? ""} onChange={(value) => onEdits({ ...edits, word: value })} />
    <YearCards slides={slides} wallpaperWord={wallpaperWord(word, map.word)} wordIsCustom={!isStockWord(word)} />
    <YearShare map={map} firstStep={stepText} />
    <section className={styles.nextStep} aria-labelledby="next-title">
      <h2 id="next-title">Дальше — глубже</h2>
      <p>{hasProfile ? "Твой сохранённый профиль Big Five уже учтён в опорах. Его можно посмотреть целиком." : "С результатом Big Five опоры станут точнее. Тест бесплатный: 50 утверждений, и результат остаётся у тебя."}</p>
      <a className={styles.primary} href={hasProfile ? "/me" : "/test"} onClick={() => trackYearEvent("new_year_to_test")}>{hasProfile ? "Мой результат" : "Пройти тест Big Five"} <span aria-hidden="true">↗</span></a>
    </section>
  </section>;
}
