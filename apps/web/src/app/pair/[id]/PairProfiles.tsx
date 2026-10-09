"use client";
import { useState } from "react";
import { GemPortrait } from "@/components/GemPortrait";
import { gemAssetDir } from "@/lib/gem-assets";
import type { Perspective } from "@/lib/pair-guide";
import type { PairView } from "@/lib/pair-view";
import { PairIcon } from "./PairIcon";
import styles from "./pair-map.module.css";

export function PairProfiles({ view, onPerspectiveChange }: { view: PairView; onPerspectiveChange?: (value: Perspective) => void }) {
  const [mode,setMode] = useState<"overview" | Perspective>("overview");
  return <section id="profiles" className={styles.section} aria-labelledby="pair-profiles-title">
    <header className={styles.sectionHead}><div><p className={styles.kicker}>02 / Ваши профили</p><h2 id="pair-profiles-title">Где вы похожи и где разные</h2></div>{onPerspectiveChange && <div className={styles.perspective} role="group" aria-label="Чья перспектива"><button type="button" aria-pressed={mode === "overview"} onClick={() => { setMode("overview"); onPerspectiveChange("you"); }}>Общий обзор</button><button type="button" aria-pressed={mode === "you"} onClick={() => { setMode("you"); onPerspectiveChange("you"); }}>Моя · {view.you.firstName}</button><button type="button" aria-pressed={mode === "partner"} onClick={() => { setMode("partner"); onPerspectiveChange("partner"); }}>Партнёра · {view.partner.firstName}</button></div>}</header>
    <div className={styles.profileGrid}>
      {(["you","partner"] as const).map(side => { const person=view[side]; return <article key={side} className={styles.personProfile} data-person={side}><div className={styles.profilePortrait}><GemPortrait dir={gemAssetDir(person.dir)} size={156} /><span>Образ типа</span></div><div className={styles.personScales}><p className={styles.personLabel}>{side === "you" ? "Вы · " : ""}{person.firstName}</p><h3>{person.typeName}</h3>{view.rows.map(row => <div className={styles.profile} key={row.trait}><div className={styles.scaleHead}><span>{row.label}</span><b>{row[side]}</b></div><span className={styles.track} role="meter" aria-label={`${side === "you" ? "Вы" : person.firstName}: ${row.label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={row[side]}><span style={{ width: `${row[side]}%` }} /></span></div>)}</div></article>; })}
      <aside className={styles.profileInsights}><h3><PairIcon name="gem" />Ключевые наблюдения</h3><ul>{view.rows.map((row,i) => <li key={row.trait}><PairIcon name={(["leaf","agreement","profile","heart","talk"] as const)[i]!} /><span>{row.label}<small>{Math.abs(row.you-row.partner) > 25 ? "Заметное различие" : "Близкие ответы"} · разница {Math.abs(row.you-row.partner)} из 100</small></span></li>)}</ul></aside>
    </div><p className={styles.note} role="status">{mode === "overview" ? "Общий обзор двух профилей." : `Сейчас рассматриваем: ${view[mode].firstName}. Ситуации и переводчик ниже используют ту же перспективу.`} Шкалы от 0 до 100; высокое значение не означает «лучше».</p>
  </section>;
}
