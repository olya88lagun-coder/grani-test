"use client";
import { useEffect, useRef, useState } from "react";
import { usePairShared } from "./PairSharedState";
import styles from "./pair-map.module.css";

export function PairPdfDownload({ pairId }: { pairId: string }) {
  const { snapshot, refresh } = usePairShared();
  const [includeAnswers, setIncludeAnswers] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null), objectUrl = useRef<string | null>(null);
  const revealed = !!snapshot?.survey.mine.published && !!snapshot.survey.partner.published;
  useEffect(() => () => { controller.current?.abort(); if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);
  async function download() {
    if (controller.current) return;
    const abort = new AbortController(); controller.current = abort; setBusy(true); setMessage("Готовим ваш PDF…");
    try {
      const response = await fetch(`/api/pairs/${encodeURIComponent(pairId)}/map/pdf${includeAnswers && revealed ? "?includeAnswers=1" : ""}`, { cache: "no-store", credentials: "same-origin", signal: abort.signal });
      if (!response.ok || !response.headers.get("content-type")?.startsWith("application/pdf")) {
        if ([401,403,404].includes(response.status)) { await refresh(); setMessage("Доступ к файлу закрыт. Проверьте вход и действующее участие в паре."); }
        else setMessage(response.status === 409 ? "Общие данные изменились во время подготовки. Скачайте новую версию." : response.status === 429 ? "Можно подготовить до трёх PDF в минуту. Повторите через минуту." : "Не удалось подготовить PDF. Повторите позже.");
        return;
      }
      const blob = await response.blob();
      if (await blob.slice(0,5).text() !== "%PDF-") { setMessage("Получен неверный файл. Повторите позже."); return; }
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      const url = URL.createObjectURL(blob); objectUrl.current = url;
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "grani-pair-map.pdf"; document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => { URL.revokeObjectURL(url); if (objectUrl.current === url) objectUrl.current = null; }, 1000);
      setMessage("PDF подготовлен. Сохраните его в загрузках браузера.");
    } catch { if (!abort.signal.aborted) setMessage("Не удалось скачать PDF. Проверьте связь и повторите."); }
    finally { controller.current = null; if (!abort.signal.aborted) setBusy(false); }
  }
  return <div className={styles.pdf}><h3>Карта в PDF</h3><p>Все базовые разделы, реальные профили и договорённости, подтверждённые обоими. Готовые дополнительные главы тоже войдут в файл.</p>
    {revealed ? <label className={styles.check}><input type="checkbox" checked={includeAnswers} disabled={busy} onChange={e => setIncludeAnswers(e.target.checked)} />Добавить раскрытые ответы обоих</label> : <p className={styles.note}>Ответы можно добавить после публикации обоими. Базовый файл уже доступен.</p>}
    <button className="button" type="button" disabled={busy} onClick={() => void download()}>{busy ? "Готовим PDF…" : "Скачать карту пары в PDF"}</button>
    <p className={styles.note}>Сохранённую копию файла выход из пары или удаление ответов не удаляет. Делитесь ею по взаимному согласию.</p><p className={styles.note} role="status" aria-live="polite">{message}</p>
  </div>;
}
