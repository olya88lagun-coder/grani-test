"use client";

import { useEffect, useState } from "react";
import { PairIcon } from "./PairIcon";
import styles from "./pair-map.module.css";

const DEFAULTS = [
  "Когда разговор становится тяжёлым, мы берём паузу и называем время, когда вернёмся к нему.",
  "Раз в неделю мы сверяем планы, домашние дела и время для отдыха каждого.",
  "В трудный день мы спрашиваем: тебе нужно выговориться, помощь делом или время наедине?",
];
const MAX_LENGTH = 600;

export function PairAgreements({ storageKey }: { storageKey: string }) {
  const [drafts, setDrafts] = useState(DEFAULTS);
  const [status, setStatus] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      const values: unknown = raw ? JSON.parse(raw) : null;
      if (Array.isArray(values) && values.length === 3 && values.every(v => typeof v === "string" && v.length <= MAX_LENGTH)) {
        setDrafts(values);
        setStatus("Черновики восстановлены в этой вкладке.");
      }
    } catch { setStatus("Хранилище вкладки недоступно. Можно редактировать, но сохранить черновики не получится."); }
    setLoaded(true);
  }, [storageKey]);

  function save() {
    try { sessionStorage.setItem(storageKey, JSON.stringify(drafts)); setStatus("Черновики сохранены в этой вкладке. Партнёр их пока не видит."); }
    catch { setStatus("Не удалось сохранить. Скопируйте текст, чтобы не потерять изменения."); }
  }
  function reset() {
    setDrafts(DEFAULTS);
    try { sessionStorage.removeItem(storageKey); setStatus("Возвращены исходные формулировки."); }
    catch { setStatus("Формулировки сброшены на странице. Хранилище вкладки недоступно."); }
  }

  return (
    <section id="agreements" className={styles.section} aria-labelledby="agreements-title">
      <header className={styles.sectionHead}><div><p className={styles.kicker}>06 / Наши договорённости</p><h2 id="agreements-title">Три шага к своему балансу</h2></div></header><p className={styles.sectionIntro}>Отредактируйте заготовки и обсудите их вдвоём. Пока это ваши личные черновики.</p>
      <div className={styles.agreements}>
        {drafts.map((draft, index) => <div className={styles.agreement} key={index}>
          <label htmlFor={`agreement-${index}`}><PairIcon name={(["talk","life","heart"] as const)[index]!} /><span>0{index + 1}</span> {['Как мы спорим', 'Как мы живём вместе', 'Как мы поддерживаем'][index]}</label>
          <textarea id={`agreement-${index}`} value={draft} maxLength={MAX_LENGTH} disabled={!loaded} rows={4} onChange={event => { setDrafts(values => values.map((value, i) => i === index ? event.target.value : value)); setStatus("Есть несохранённые изменения."); }} />
          <small>{draft.length}/{MAX_LENGTH} · личный черновик</small>
        </div>)}
      </div>
      <div className={styles.actions}><button className="button" type="button" disabled={!loaded} onClick={save}>Сохранить черновики</button><button className="button button--ghost" type="button" disabled={!loaded} onClick={reset}>Вернуть заготовки</button></div>
      <p className={styles.note} role="status" aria-live="polite">{status || "Черновики сохраняются только в текущей вкладке браузера. Это не совместное подтверждение; при закрытии вкладки они могут исчезнуть."}</p>
    </section>
  );
}
