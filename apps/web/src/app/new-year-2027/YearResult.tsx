"use client";

import { type RefObject } from "react";
import { ANSWER_LIMIT, type YearMap, type YearEdits } from "@/lib/new-year-2027";
import { YearShare } from "./YearShare";
import styles from "./new-year.module.css";

export function YearResult({ map, edits, onEdits, titleRef, onEdit }: { map: YearMap; edits: YearEdits; onEdits: (edits: YearEdits) => void; titleRef: RefObject<HTMLHeadingElement | null>; onEdit: () => void }) {
  const firstStep = edits.firstStep ?? map.firstStep;
  return <section className={styles.result} aria-labelledby="map-title">
    <div className={styles.resultHeading}><p className={styles.eyebrow}>Твоя карта 2027</p><h1 id="map-title" ref={titleRef} tabIndex={-1}>{map.title}</h1><p>Не прогноз. Ориентир, который можно менять вместе с собой.</p></div>
    <div className={styles.paper}>
      <p className={styles.paperKicker}>В новый год я беру</p><h2>{map.direction}</h2>
      {map.reflections.length > 0 ? <details className={styles.reflections}><summary>Мой 2026 и то, что важно дальше</summary><dl>{map.reflections.map((r) => <div key={r.id}><dt>{r.label}</dt><dd>{r.text}</dd></div>)}</dl></details> : <p className={styles.paperNote}>Ты пропустил вопросы. Это общий черновик: добавь свои ответы или уточни шаг ниже.</p>}
      <div className={styles.mapSection}><span className={styles.sectionNumber}>01</span><div><h3>Мои опоры</h3><p className={styles.paperNote}>{map.profileUsed ? "Варианты с учётом твоих пяти шкал Big Five. Проверь, подходят ли они тебе: профиль не определяет твой выбор." : "По твоим ответам, без профиля Big Five. Черты личности здесь не определяются."}</p><ul className={styles.supports}>{map.supports.map((s) => <li key={s}>{s}</li>)}</ul></div></div>
      <div className={styles.mapSection}><span className={styles.sectionNumber}>02</span><div><h3>Одна личная цель</h3><p className={styles.goal}>{map.goal}</p><label className={styles.editorLabel} htmlFor="first-step">Первый шаг — уточни под себя</label><textarea id="first-step" className="ym-disable-keys" value={firstStep} onChange={(e) => onEdits({ ...edits, firstStep: e.target.value })} maxLength={ANSWER_LIMIT} rows={4} /><p className={styles.paperNote}>Лучше конкретное действие на 10 минут. При изменении цели или направления шаг соберётся заново.</p></div></div>
      <div className={styles.mapSection}><span className={styles.sectionNumber}>03</span><div><h3>Если что-то помешает</h3><label className={styles.editorLabel} htmlFor="if-then">Мой план «если — то»</label><textarea id="if-then" className="ym-disable-keys" value={edits.ifThen ?? map.ifThen} onChange={(e) => onEdits({ ...edits, ifThen: e.target.value })} maxLength={ANSWER_LIMIT} rows={4} /><p className={styles.paperNote}>Запасной маршрут, а не ещё одно требование к себе. При изменении препятствия план соберётся заново.</p></div></div>
      <p className={styles.paperClosing}>Не весь год сразу.<br /><em>Один свой шаг.</em></p>
    </div>
    <button type="button" className={styles.secondary} onClick={onEdit}>Изменить ответы</button>
    <YearShare map={map} firstStep={firstStep} />
  </section>;
}
