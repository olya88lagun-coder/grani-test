"use client";
import { useState } from "react";
import Link from "next/link";
import { PAIR_MAP_CONSENT_VERSION } from "@grani/core";
import { usePairShared } from "./PairSharedState";
import styles from "./pair-map.module.css";
export function PairMapConsent() {
  const { snapshot, busy, dispatch } = usePairShared(); const [accepted, setAccepted] = useState(false);
  if (!snapshot?.consentRequired) return null;
  return <aside className={styles.consent} aria-labelledby="pair-consent-title"><h3 id="pair-consent-title">Перед сохранением ответов</h3>
    <p>Личные черновики сохраняются на сервере и видны только вам. Ответы раскроются партнёру после публикации обоими. Предложения договорённостей партнёр видит сразу. Эти тексты не отправляются ИИ или в статистику.</p>
    <p>Не указывайте сведения о здоровье, интимной жизни, политических или религиозных взглядах. Отказ не закрывает купленную карту и её базовый PDF.</p>
    <label className={styles.check}><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />Я согласен(на) на хранение и раскрытие ответов карты пары</label>
    <p className={styles.note}><Link href="/consent/pair-map" target="_blank">Отдельное согласие</Link> · <Link href="/privacy" target="_blank">Политика обработки данных</Link></p>
    <button className="button" type="button" disabled={!accepted || busy} onClick={() => void dispatch({ kind: "consent", accepted: true, version: PAIR_MAP_CONSENT_VERSION }, "Отдельное согласие принято.")}>Принять отдельное согласие</button>
  </aside>;
}
