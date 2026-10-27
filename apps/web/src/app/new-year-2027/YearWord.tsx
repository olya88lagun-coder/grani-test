"use client";

import { useEffect, useRef, useState } from "react";
import { cleanWord, isStockWord, WORD_LIMIT, YEAR_WORDS } from "@/lib/new-year-2027";
import styles from "./new-year.module.css";

// `raw` is what is being typed; the effective word (stock, custom or the direction default) is decided by the parent.
export function YearWord({ word, raw, onChange }: { word: string; raw: string; onChange: (value: string | null) => void }) {
  const [custom, setCustom] = useState(Boolean(cleanWord(raw)) && !isStockWord(cleanWord(raw)));
  const input = useRef<HTMLInputElement>(null);
  const focusOnOpen = useRef(false);
  // Focus moves to the field only after the person picks "Своё слово", never when a saved draft is restored.
  useEffect(() => { if (custom && focusOnOpen.current) input.current?.focus(); }, [custom]);
  return <section className={styles.wordBlock} aria-labelledby="word-title">
    <p className={styles.eyebrow}>Слово года</p>
    <h2 id="word-title">Одно слово на 2027</h2>
    <p className={styles.wordNote}>Предложено по твоему направлению. Можно выбрать другое или написать своё.</p>
    <fieldset className={styles.wordChips}>
      <legend className={styles.srOnly}>Слово года</legend>
      {YEAR_WORDS.map((option) => <label key={option} className={styles.chip}><input type="radio" name="year-word" checked={!custom && word === option} onChange={() => { setCustom(false); onChange(option); }} />{option}</label>)}
      <label className={styles.chip}><input type="radio" name="year-word" checked={custom} onChange={() => { focusOnOpen.current = true; setCustom(true); }} />Своё слово</label>
    </fieldset>
    {custom && <div className={styles.custom}>
      <label htmlFor="year-word">Твоё слово</label>
      <input id="year-word" ref={input} className="ym-disable-keys" value={raw} maxLength={WORD_LIMIT} autoComplete="off" onChange={(e) => onChange(e.target.value || null)} />
      <span className={styles.fine}>{raw.length} / {WORD_LIMIT}. {cleanWord(raw) ? "Своё слово остаётся на экране и в карточках с подтверждением. На обои оно не попадает." : `Пока слово не введено, используется «${word}».`}</span>
    </div>}
  </section>;
}
